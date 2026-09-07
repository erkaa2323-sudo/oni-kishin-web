import { useEffect, useRef, useState } from "react";

import type { MeetLifecycle } from "@/data/meet";

type RegistrationState = "idle" | "sending" | "denied" | "registered";
type HostState = "idle" | "open" | "live" | "loading" | "registered" | "full" | "closed";

type Props = {
  life: MeetLifecycle;
  registrationState: RegistrationState;
  nickname?: string;
  participants: number;
  capacity: number | null;
};

type Model = {
  width: number;
  height: number;
  x: number;
  y: number;
  anchor: { set: (x: number, y?: number) => void };
  scale: { set: (value: number) => void };
  motion?: (group: string, index?: number) => unknown;
  destroy?: (options?: unknown) => void;
};

type Pixi = {
  Application: new (options: Record<string, unknown>) => {
    stage: { addChild: (model: Model) => void };
    renderer: { resize: (width: number, height: number) => void };
    destroy: (removeView?: boolean, options?: Record<string, unknown>) => void;
  };
  live2d?: { Live2DModel?: { from: (url: string, options?: Record<string, unknown>) => Promise<Model> } };
};

declare global {
  interface Window {
    PIXI?: Pixi;
    Live2D?: unknown;
  }
}

const PIXI_URL = "https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js";
const CORE_URL = "https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js";
const DISPLAY_URL = "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism2.min.js";
const MODEL_URL =
  "https://cdn.jsdelivr.net/gh/zenghongtu/live2d-model-assets@e8d97080d37a31d2813a56caa6776ae722c4b489/assets/moc/Gantzert_Felixander/Gantzert_Felixander.model.json";
const LOAD_TIMEOUT_MS = 15_000;

const scriptLoads = new Map<string, Promise<void>>();

function loadScript(src: string) {
  const cached = scriptLoads.get(src);
  if (cached) return cached;

  const task = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-oni-meet-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.oniMeetSrc = src;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });

  scriptLoads.set(src, task);
  void task.catch(() => scriptLoads.delete(src));
  return task;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function resolveHostState(life: MeetLifecycle, registrationState: RegistrationState): HostState {
  if (registrationState === "registered") return "registered";
  if (registrationState === "sending") return "loading";
  if (life === "active") return "live";
  if (life === "open" || life === "starting_soon") return "open";
  if (life === "full") return "full";
  if (life === "closed" || life === "ended") return "closed";
  return "idle";
}

function hostCopy(state: HostState, nickname?: string) {
  const rider = nickname?.trim() || "Rider";
  if (state === "registered") return `${rider}, Meet access бэлэн боллоо.`;
  if (state === "loading") return "Бүртгэлийг шалгаж байна…";
  if (state === "live") return "ONI MEET эхэлсэн. Room access-аа шалгаарай.";
  if (state === "open") return "Бүртгэл нээлттэй. Crew аккаунтаа баталгаажуулаад нэгдээрэй.";
  if (state === "full") return "Meet дүүрсэн байна. Дараагийн мэдээллийг эндээс хүлээнэ үү.";
  if (state === "closed") return "Энэ Meet-ийн бүртгэл хаагдсан байна.";
  return "Gantzert ба Felixander дараагийн ONI MEET-ийг хүлээж байна.";
}

function playHostMotion(model: Model, state: HostState) {
  try {
    if (state === "idle") {
      void model.motion?.("idle", 0);
      return;
    }

    const index =
      state === "open"
        ? 0
        : state === "live"
          ? 1
          : state === "loading"
            ? 2
            : state === "closed" || state === "full"
              ? 3
              : 4;
    void model.motion?.("", index);
  } catch {
    // Motion failure must never take down the host renderer.
  }
}

export function RenMeetHost({ life, registrationState, nickname, participants, capacity }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef<Model | null>(null);
  const baseSizeRef = useRef<{ width: number; height: number } | null>(null);
  const [runtime, setRuntime] = useState<"loading" | "ready" | "failed">("loading");
  const hostState = resolveHostState(life, registrationState);

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    let app: InstanceType<Pixi["Application"]> | undefined;

    void (async () => {
      try {
        await withTimeout(
          (async () => {
            if (!window.PIXI?.Application) await loadScript(PIXI_URL);
            if (!window.Live2D) await loadScript(CORE_URL);
            if (!window.PIXI?.live2d?.Live2DModel) await loadScript(DISPLAY_URL);
          })(),
          LOAD_TIMEOUT_MS,
          "Live2D runtime",
        );
        if (cancelled || !hostRef.current) return;

        const PIXI = window.PIXI;
        const Live2DModel = PIXI?.live2d?.Live2DModel;
        if (!PIXI || !Live2DModel) throw new Error("Cubism2 runtime unavailable");

        const host = hostRef.current;
        const canvas = document.createElement("canvas");
        canvas.className = "h-full w-full";
        canvas.setAttribute("aria-hidden", "true");
        host.replaceChildren(canvas);

        app = new PIXI.Application({
          view: canvas,
          transparent: true,
          antialias: true,
          autoStart: true,
          resolution: Math.min(window.devicePixelRatio || 1, window.innerWidth < 640 ? 1.2 : 1.6),
          autoDensity: true,
        });

        const model = await withTimeout(
          Live2DModel.from(MODEL_URL, { autoInteract: false }),
          LOAD_TIMEOUT_MS,
          "Gantzert model",
        );
        if (cancelled) {
          model.destroy?.({ children: true, texture: true, baseTexture: true });
          return;
        }

        model.anchor.set(0.5, 0.5);
        model.scale.set(1);
        baseSizeRef.current = {
          width: Math.max(model.width, 1),
          height: Math.max(model.height, 1),
        };
        modelRef.current = model;
        app.stage.addChild(model);

        const fit = () => {
          const currentHost = hostRef.current;
          const currentModel = modelRef.current;
          const base = baseSizeRef.current;
          if (!currentHost || !currentModel || !base || !app) return;

          const width = Math.max(1, currentHost.clientWidth);
          const height = Math.max(1, currentHost.clientHeight);
          app.renderer.resize(width, height);

          // Keep the swordsman and dragon fully inside the frame while using as
          // much of the small mobile viewport as possible. The bottom HUD was
          // deliberately compacted so the model can occupy almost the full card.
          const safeWidth = width * (width < 520 ? 0.965 : 0.94);
          const safeHeight = height * (width < 520 ? 0.975 : 0.95);
          const scale = Math.min(safeWidth / base.width, safeHeight / base.height);

          currentModel.scale.set(scale);
          currentModel.x = width * 0.5;
          currentModel.y = height * (width < 520 ? 0.515 : 0.51);
        };

        fit();
        observer = new ResizeObserver(fit);
        observer.observe(host);
        playHostMotion(model, hostState);
        if (!cancelled) setRuntime("ready");
      } catch (error) {
        console.error("[ONI Meet] Gantzert + Felixander load failed", error);
        if (!cancelled) setRuntime("failed");
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      modelRef.current?.destroy?.({ children: true, texture: true, baseTexture: true });
      modelRef.current = null;
      baseSizeRef.current = null;
      app?.destroy(true, { children: true, texture: true, baseTexture: true });
    };
  }, []);

  useEffect(() => {
    if (runtime !== "ready" || !modelRef.current) return;
    playHostMotion(modelRef.current, hostState);
  }, [hostState, runtime]);

  useEffect(() => {
    if (runtime !== "ready") return;
    const timer = window.setInterval(() => {
      if (hostState === "idle" && modelRef.current) playHostMotion(modelRef.current, "idle");
    }, 9_000);
    return () => window.clearInterval(timer);
  }, [hostState, runtime]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden border border-white/12 bg-black/38 shadow-2xl shadow-crimson/10 clip-notch">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_58%,rgba(180,20,38,0.20),rgba(52,4,12,0.08)_34%,transparent_64%)]" />
      <div className="pointer-events-none absolute inset-x-[8%] bottom-[4.05rem] h-px bg-gradient-to-r from-transparent via-crimson/35 to-transparent" />
      <div className="pointer-events-none absolute inset-x-[18%] bottom-[3.92rem] h-5 bg-crimson/10 blur-xl" />

      <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 sm:left-4">
        <span className="text-[0.5rem] font-semibold tracking-[0.18em] text-white/55 sm:text-[0.54rem]">
          GANTZERT + FELIXANDER
        </span>
        <span className="border border-white/10 bg-black/35 px-1.5 py-0.5 text-[0.42rem] tracking-[0.15em] text-white/35">
          SWORD / DRAGON
        </span>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-1.5 sm:right-4">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            runtime === "ready"
              ? "bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.7)]"
              : runtime === "failed"
                ? "bg-crimson"
                : "bg-white/30"
          }`}
        />
        <span
          className={`text-[0.48rem] font-semibold tracking-[0.16em] ${
            runtime === "ready" ? "text-emerald-300/80" : runtime === "failed" ? "text-crimson" : "text-white/35"
          }`}
        >
          {runtime === "ready" ? "ONLINE" : runtime === "failed" ? "OFFLINE" : "SYNC"}
        </span>
      </div>

      <div
        ref={hostRef}
        className="pointer-events-none absolute inset-x-0 bottom-[3.95rem] top-7"
        aria-label="Gantzert and Felixander Live2D Meet host"
      />

      {runtime === "loading" ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-[0.48rem] tracking-[0.2em] text-white/30">
          SUMMONING HOST…
        </div>
      ) : null}
      {runtime === "failed" ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-[0.48rem] tracking-[0.2em] text-white/30">
          HOST VISUAL OFFLINE
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-2 bottom-2 z-10 border border-white/10 bg-black/58 px-3 py-2.5 backdrop-blur-md sm:inset-x-3 sm:px-4">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-[0.62rem] leading-relaxed text-white/88 sm:text-[0.68rem]">
            {hostCopy(hostState, nickname)}
          </p>
          <span className="shrink-0 font-mono text-[0.5rem] tracking-[0.12em] text-white/42 sm:text-[0.54rem]">
            {participants}/{capacity ?? "∞"}
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3 text-[0.44rem] tracking-[0.16em] text-white/30 sm:text-[0.48rem]">
          <span>ALWAYS-ON MEET GUARD</span>
          <span>RIDERS</span>
        </div>
      </div>

      <span className="pointer-events-none absolute left-0 top-0 h-5 w-px bg-crimson/50" />
      <span className="pointer-events-none absolute left-0 top-0 h-px w-5 bg-crimson/50" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-5 w-px bg-crimson/35" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-px w-5 bg-crimson/35" />
    </div>
  );
}
