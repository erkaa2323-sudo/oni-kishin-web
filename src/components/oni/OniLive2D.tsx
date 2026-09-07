import { useEffect, useRef, useState } from "react";

import type { OniState } from "@/lib/oni-emotion";
import { OniWebRig } from "./OniWebRig";

type Props = { state: OniState; glow: number; speaking?: boolean };

type Model = {
  width: number;
  height: number;
  x: number;
  y: number;
  anchor: { set: (x: number, y?: number) => void };
  scale: { set: (value: number) => void };
  motion?: (group: string, index?: number) => unknown;
  expression?: (name?: string) => unknown;
  internalModel?: { coreModel?: { setParamFloat?: (id: string, value: number) => void } };
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
const MODEL_URL = "https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@0.4.0/test/assets/shizuku/shizuku.model.json";

const scriptLoads = new Map<string, Promise<void>>();

function loadScript(src: string) {
  const cached = scriptLoads.get(src);
  if (cached) return cached;

  const task = new Promise<void>((resolve, reject) => {
    const selector = `script[data-oni-live2d-src="${src}"]`;
    const existing = document.querySelector<HTMLScriptElement>(selector);
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed: ${src}`)), { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.oniLive2dSrc = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed: ${src}`)), { once: true });
    document.head.appendChild(script);
  });

  scriptLoads.set(src, task);
  return task;
}

function setMouth(model: Model, value: number) {
  model.internalModel?.coreModel?.setParamFloat?.("PARAM_MOUTH_OPEN_Y", value);
}

function setState(model: Model, state: OniState) {
  const expressions: Partial<Record<OniState, string>> = {
    concerned: "f01",
    serious: "f02",
    happy: "f03",
    speaking: "f03",
    excited: "f04",
    surprised: "f04",
  };
  const expression = expressions[state];
  if (expression) void model.expression?.(expression);

  if (state === "excited" || state === "music") void model.motion?.("tap_body", 0);
  if (state === "surprised") void model.motion?.("flick_head", 0);
  if (state === "happy") void model.motion?.("idle", 1);
}

export function OniLive2D({ state, glow, speaking = false }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef<Model | null>(null);
  const baseSizeRef = useRef<{ width: number; height: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    let app: InstanceType<Pixi["Application"]> | undefined;

    void (async () => {
      try {
        await loadScript(PIXI_URL);
        await loadScript(CORE_URL);
        await loadScript(DISPLAY_URL);
        if (cancelled || !hostRef.current) return;

        const PIXI = window.PIXI;
        const Live2DModel = PIXI?.live2d?.Live2DModel;
        if (!PIXI || !Live2DModel) throw new Error("Live2D runtime unavailable");

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
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          autoDensity: true,
        });

        const model = await Live2DModel.from(MODEL_URL, { autoInteract: true });
        if (cancelled) return;
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
          const baseSize = baseSizeRef.current;
          if (!currentHost || !currentModel || !baseSize || !app) return;

          const width = Math.max(1, currentHost.clientWidth);
          const height = Math.max(1, currentHost.clientHeight);
          app.renderer.resize(width, height);

          // Keep the entire character inside the slot. Use the original model
          // dimensions so ResizeObserver callbacks never compound the scale.
          const safeWidth = width * 0.78;
          const safeHeight = height * 0.86;
          const scale = Math.min(safeWidth / baseSize.width, safeHeight / baseSize.height);

          currentModel.scale.set(scale);
          currentModel.x = width * 0.5;
          currentModel.y = height * 0.51;
        };

        fit();
        resizeObserver = new ResizeObserver(fit);
        resizeObserver.observe(host);
        setState(model, state);
        setReady(true);
      } catch (error) {
        console.error("[ONI Live2D] Shizuku load failed", error);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      modelRef.current?.destroy?.({ children: true, texture: true, baseTexture: true });
      modelRef.current = null;
      baseSizeRef.current = null;
      app?.destroy(true, { children: true, texture: true, baseTexture: true });
    };
    // State is synchronized by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (modelRef.current) setState(modelRef.current, state);
  }, [state]);

  useEffect(() => {
    const model = modelRef.current;
    if (!speaking || !model) {
      if (model) setMouth(model, 0);
      return;
    }

    let frame = 0;
    const tick = () => {
      const current = modelRef.current;
      if (!current) return;
      setMouth(current, 0.12 + Math.abs(Math.sin(performance.now() / 95)) * 0.72);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      if (modelRef.current) setMouth(modelRef.current, 0);
    };
  }, [speaking, ready]);

  if (failed) return <OniWebRig state={state} glow={glow} speaking={speaking} />;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-label="ONI Live2D Shizuku">
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          opacity: Math.min(1, Math.max(0.15, glow)),
          background: "radial-gradient(45% 42% at 50% 58%, oklch(0.55 0.215 25.5 / 0.28), transparent 74%)",
        }}
      />
      <div ref={hostRef} className="absolute inset-0" />
      {!ready ? (
        <div className="absolute inset-x-0 bottom-4 text-center text-[0.55rem] tracking-[0.2em] text-muted-foreground/70">
          LIVE2D INITIALIZING
        </div>
      ) : null}
    </div>
  );
}
