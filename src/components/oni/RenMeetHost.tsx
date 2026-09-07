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

          // Intentionally use more of the viewport than the previous conservative
          // fit. The lower HUD now overlays the render instead of reserving a large
          // empty block, so the swordsman + dragon read as the hero of the panel.
          const mobile = width < 520;
          const safeWidth = width * (mobile ? 1.055 : 0.99);
          const safeHeight = height * (mobile ? 1.045 : 0.995);
          const scale = Math.min(safeWidth / base.width, safeHeight / base.height);

          currentModel.scale.set(scale);
          currentModel.x = width * (mobile ? 0.525 : 0.515);
          currentModel.y = height * (mobile ? 0.475 : 0.49);
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
    <div className="relative h-full min-h-0 overflow-hidden border border-crimson/20 bg-black/48 shadow-[0_20px_70px_rgba(0,0,0,0.55)] clip-notch">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(90,0,12,0.18),transparent_34%,rgba(0,0,0,0.12)_58%,rgba(90,0,12,0.12))]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_52%_64%,rgba(210,26,48,0.24),rgba(70,5,14,0.08)_35%,transparent_68%)]" />
      <div className="pointer-events-none absolute inset-x-[10%] bottom-[3.35rem] h-px bg-gradient-to-r from-transparent via-crimson/55 to-transparent" />
      <div className="pointer-events-none absolute inset-x-[20%] bottom-[3.05rem] h-7 bg-crimson/15 blur-2xl" />
      <div className="pointer-events-none absolute -right-12 top-[20%] h-40 w-40 rotate-12 border border-crimson/10 bg-crimson/5 blur-sm" />

      <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 sm:left-4">
        <span className="border-l-2 border-crimson/70 pl-2 text-[0.5rem] font-semibold tracking-[0.2em] text-white/70 sm:text-[0.55rem]">
          MEET GUARD // GANTZERT
        </span>
        <span className="hidden border border-white/10 bg-black/40 px-1.5 py-0.5 text-[0.4rem] tracking-[0.16em] text-white/35 sm:inline">
          FELIXANDER ACTIVE
        </span>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-1.5 sm:right-4">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            runtime === "ready"
              ? "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]"
              : runtime === "failed"
                ? "bg-crimson"
                : "bg-white/30"
          }`}
        />
        <span
          className={`text-[0.48rem] font-semibold tracking-[0.17em] ${
            runtime === "ready" ? "text-emerald-300/90" : runtime === "failed" ? "text-crimson" : "text-white/35"
          }`}
        >
          {runtime === "ready" ? "ONLINE" : runtime === "failed" ? "OFFLINE" : "SYNC"}
        </span>
      </div>

      <div
        ref={hostRef}
        className="pointer-events-none absolute inset-x-0 bottom-1 top-6"
        aria-label="Gantzert and Felixander Live2D Meet host"
      />

      {runtime === "loading" ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-[0.48rem] tracking-[0.22em] text-white/30">
          SUMMONING HOST…
        </div>
      ) : null}
      {runtime === "failed" ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-[0.48rem] tracking-[0.22em] text-white/30">
          HOST VISUAL OFFLINE
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/82 to-transparent px-3 pb-3 pt-12 sm:px-4">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[0.42rem] tracking-[0.2em] text-crimson/75 sm:text-[0.46rem]">
              <span>ONI // SECTOR 05</span>
              <span className="h-px w-8 bg-crimson/35" />
              <span>SWORD + DRAGON</span>
            </div>
            <p className="max-w-[84%] text-[0.61rem] leading-relaxed text-white/88 sm:text-[0.68rem]">
              {hostCopy(hostState, nickname)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-[0.72rem] font-semibold tracking-[0.08em] text-white/80 sm:text-[0.78rem]">
              {participants}/{capacity ?? "∞"}
            </div>
            <div className="mt-0.5 text-[0.4rem] tracking-[0.18em] text-white/30">RIDERS</div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute right-1.5 top-1/2 z-20 -translate-y-1/2 rotate-90 text-[0.36rem] tracking-[0.28em] text-white/15">
        ONI // ALWAYS-ON HOST
      </div>
      <span className="pointer-events-none absolute left-0 top-0 h-7 w-px bg-crimson/70" />
      <span className="pointer-events-none absolute left-0 top-0 h-px w-7 bg-crimson/70" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-7 w-px bg-crimson/45" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-px w-7 bg-crimson/45" />
    </div>
  );
}