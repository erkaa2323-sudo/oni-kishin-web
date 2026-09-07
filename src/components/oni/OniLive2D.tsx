import { useEffect, useRef, useState } from "react";

import type { OniState } from "@/lib/oni-emotion";
import { OniWebRig } from "./OniWebRig";

type Props = {
  state: OniState;
  glow: number;
  speaking?: boolean;
};

type Live2DModelLike = {
  width: number;
  height: number;
  x: number;
  y: number;
  anchor: { set: (x: number, y?: number) => void };
  scale: { set: (value: number) => void };
  motion?: (group: string, index?: number) => Promise<unknown> | unknown;
  expression?: (name?: string) => Promise<unknown> | unknown;
  internalModel?: {
    coreModel?: {
      setParamFloat?: (id: string, value: number) => void;
      setParameterValueById?: (id: string, value: number) => void;
    };
  };
  destroy?: (options?: unknown) => void;
};

type PixiLike = {
  Application: new (options: Record<string, unknown>) => {
    stage: { addChild: (model: Live2DModelLike) => void };
    renderer: { resize: (width: number, height: number) => void };
    view?: HTMLCanvasElement;
    destroy: (removeView?: boolean, stageOptions?: Record<string, unknown>) => void;
  };
  live2d?: {
    Live2DModel?: {
      from: (url: string, options?: Record<string, unknown>) => Promise<Live2DModelLike>;
    };
  };
};

declare global {
  interface Window {
    PIXI?: PixiLike;
    Live2D?: unknown;
  }
}

const PIXI_URL = "https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js";
const CUBISM2_CORE_URL = "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/core/live2d.min.js";
const LIVE2D_DISPLAY_URL = "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism2.min.js";
const SHIZUKU_MODEL_URL =
  "https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@0.4.0/test/assets/shizuku/shizuku.model.json";

const loadedScripts = new Map<string, Promise<void>>();

function loadScript(src: string) {
  const existing = loadedScripts.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const already = document.querySelector<HTMLScriptElement>(`script[data-oni-live2d-src="${src}"]`);
    if (already) {
      if (already.dataset.loaded === "true") resolve();
      else {
        already.addEventListener("load", () => resolve(), { once: true });
        already.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), {
          once: true,
        });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.oniLive2dSrc = src;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), {
      once: true,
    });
    document.head.appendChild(script);
  });

  loadedScripts.set(src, promise);
  return promise;
}

function driveMouth(model: Live2DModelLike, value: number) {
  const core = model.internalModel?.coreModel;
  if (!core) return;
  core.setParamFloat?.("PARAM_MOUTH_OPEN_Y", value);
  core.setParameterValueById?.("ParamMouthOpenY", value);
}

function applyState(model: Live2DModelLike, state: OniState) {
  const expressionMap: Partial<Record<OniState, string>> = {
    happy: "f03",
    excited: "f04",
    concerned: "f01",
    serious: "f02",
    surprised: "f04",
    speaking: "f03",
  };

  const expression = expressionMap[state];
  if (expression) void model.expression?.(expression);

  if (state === "excited" || state === "music") {
    void model.motion?.("tap_body", 0);
  } else if (state === "surprised") {
    void model.motion?.("flick_head", 0);
  } else if (state === "happy") {
    void model.motion?.("idle", 1);
  }
}

export function OniLive2D({ state, glow, speaking = false }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef<Live2DModelLike | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let app:
      | {
          stage: { addChild: (model: Live2DModelLike) => void };
          renderer: { resize: (width: number, height: number) => void };
          destroy: (removeView?: boolean, stageOptions?: Record<string, unknown>) => void;
        }
      | undefined;
    let observer: ResizeObserver | undefined;

    const start = async () => {
      try {
        await loadScript(PIXI_URL);
        await loadScript(CUBISM2_CORE_URL);
        await loadScript(LIVE2D_DISPLAY_URL);
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
          autoStart: true,
          transparent: true,
          antialias: true,
          resizeTo: host,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          autoDensity: true,
        });

        const model = await Live2DModel.from(SHIZUKU_MODEL_URL, { autoInteract: true });
        if (cancelled) {
          model.destroy?.({ children: true, texture: true, baseTexture: true });
          app.destroy(true, { children: true, texture: true, baseTexture: true });
          return;
        }

        model.anchor.set(0.5, 0.5);
        modelRef.current = model;
        app.stage.addChild(model);

        const fit = () => {
          if (!hostRef.current || !modelRef.current || !app) return;
          const width = Math.max(1, hostRef.current.clientWidth);
          const height = Math.max(1, hostRef.current.clientHeight);
          app.renderer.resize(width, height);
          const current = modelRef.current;
          const scale = Math.min(width / Math.max(current.width, 1), height / Math.max(current.height, 1)) * 1.12;
          current.scale.set(scale);
          current.x = width * 0.5;
          current.y = height * 0.56;
        };

        fit();
        observer = new ResizeObserver(fit);
        observer.observe(host);
        applyState(model, state);
        setReady(true);
      } catch (error) {
        console.error("[ONI Live2D] Shizuku failed to load", error);
        if (!cancelled) setFailed(true);
      }
    };

    void start();

    return () => {
      cancelled = true;
      observer?.disconnect();
      modelRef.current?.destroy?.({ children: true, texture: true, baseTexture: true });
      modelRef.current = null;
      app?.destroy(true, { children: true, texture: true, baseTexture: true });
    };
    // State changes are handled by the lightweight effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (modelRef.current) applyState(modelRef.current, state);
  }, [state]);

  useEffect(() => {
    if (!speaking || !modelRef.current) {
      if (modelRef.current) driveMouth(modelRef.current, 0);
      return;
    }

    let frame = 0;
    const tick = () => {
      const model = modelRef.current;
      if (!model) return;
      const now = performance.now() / 1000;
      driveMouth(model, 0.16 + Math.abs(Math.sin(now * 10.5)) * 0.68);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      if (modelRef.current) driveMouth(modelRef.current, 0);
    };
  }, [speaking]);

  if (failed) {
    return <OniWebRig state={state} glow={glow} speaking={speaking} />;
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-label="ONI Live2D Shizuku">
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{
          opacity: Math.min(1, Math.max(0.15, glow)),
          background:
            "radial-gradient(45% 42% at 50% 58%, oklch(0.55 0.215 25.5 / 0.28), transparent 74%)",
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
