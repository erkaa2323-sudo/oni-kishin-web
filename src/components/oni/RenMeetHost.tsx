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
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
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
      state === "open" ? 0 : state === "live" ? 1 : state === "loading" ? 2 : state === "closed" || state === "full" ? 3 : 4;
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
          resolution: Math.min(window.devicePixelRatio || 1, window.innerWidth < 640 ? 1.25 : 1.6),
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
        baseSizeRef.current = { width: Math.max(model.width, 1), height: Math.max(model.height, 1) };
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
          const scale = Math.min((width * 0.94) / base.width, (height * 0.90) / base.height);
          currentModel.scale.set(scale);
          currentModel.x = width * 0.5;
          currentModel.y = height * 0.51;
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
    <div className="relative h-full min-h-0 overflow-hidden border border-white/10 bg-black/30 shadow-2xl shadow-crimson/10 clip-notch">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(255,65,85,0.14),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-x-4 top-3 z-10 flex items-center justify-between gap-3 text-[0.54rem] font-semibold tracking-[0.16em] text-white/55 sm:text-[0.56rem]">
        <span>GANTZERT + FELIXANDER / MEET HOST</span>
        <span className={runtime === "ready" ? "text-emerald-300/80" : runtime === "failed" ? "text-crimson" : "text-white/40"}>
          {runtime === "ready" ? "ONLINE" : runtime === "failed" ? "OFFLINE" : "SYNC"}
        </span>
      </div>

      <div ref={hostRef} className="pointer-events-none absolute inset-x-0 bottom-[5.25rem] top-6" aria-label="Gantzert and Felixander Live2D Meet host" />

      {runtime === "loading" ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-[0.52rem] tracking-[0.18em] text-white/35">
          SUMMONING HOST…
        </div>
      ) : null}
      {runtime === "failed" ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-[0.52rem] tracking-[0.18em] text-white/35">
          HOST VISUAL OFFLINE
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 border border-white/10 bg-black/45 px-4 py-3 backdrop-blur-md sm:inset-x-5">
        <p className="text-[0.68rem] leading-relaxed text-white/85 sm:text-xs">{hostCopy(hostState, nickname)}</p>
        <div className="mt-2 flex items-center justify-between gap-3 text-[0.5rem] tracking-[0.16em] text-white/35 sm:text-[0.55rem]">
          <span>SWORD + DRAGON HOST</span>
          <span>
            {participants} / {capacity ?? "∞"} RIDERS
          </span>
        </div>
      </div>
    </div>
  );
}
