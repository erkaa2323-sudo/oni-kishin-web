import { useEffect, useRef, useState } from "react";

import type { OniState } from "@/lib/oni-emotion";
import { OniWebRig } from "./OniWebRig";

type Props = { state: OniState; glow: number; speaking?: boolean };

type CoreModel = {
  setParamFloat?: (id: string, value: number) => void;
};

type Model = {
  width: number;
  height: number;
  x: number;
  y: number;
  anchor: { set: (x: number, y?: number) => void };
  scale: { set: (value: number) => void };
  motion?: (group: string, index?: number) => unknown;
  expression?: (name?: string) => unknown;
  internalModel?: { coreModel?: CoreModel };
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

const STATE_EXPRESSIONS: Partial<Record<OniState, string>> = {
  listening: "f03",
  thinking: "f02",
  speaking: "f03",
  concerned: "f01",
  serious: "f02",
  happy: "f03",
  excited: "f04",
  surprised: "f04",
  music: "f03",
};

const STATE_MOTIONS: Partial<Record<OniState, Array<{ group: string; index: number }>>> = {
  idle: [
    { group: "idle", index: 0 },
    { group: "idle", index: 1 },
    { group: "idle", index: 2 },
  ],
  listening: [
    { group: "pinch_in", index: 0 },
    { group: "flick_head", index: 0 },
  ],
  thinking: [
    { group: "shake", index: 1 },
    { group: "pinch_in", index: 2 },
  ],
  speaking: [
    { group: "tap_body", index: 1 },
    { group: "flick_head", index: 1 },
  ],
  concerned: [
    { group: "pinch_out", index: 1 },
    { group: "shake", index: 0 },
  ],
  serious: [
    { group: "shake", index: 0 },
    { group: "pinch_out", index: 2 },
  ],
  happy: [
    { group: "tap_body", index: 2 },
    { group: "idle", index: 1 },
  ],
  excited: [
    { group: "shake", index: 2 },
    { group: "tap_body", index: 0 },
  ],
  surprised: [
    { group: "flick_head", index: 2 },
    { group: "pinch_out", index: 0 },
  ],
  music: [
    { group: "tap_body", index: 0 },
    { group: "shake", index: 2 },
  ],
};

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
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener("error", () => reject(new Error(`Failed: ${src}`)), { once: true });
    document.head.appendChild(script);
  });

  scriptLoads.set(src, task);
  return task;
}

function setParam(model: Model, id: string, value: number) {
  model.internalModel?.coreModel?.setParamFloat?.(id, value);
}

function setMouth(model: Model, value: number) {
  setParam(model, "PARAM_MOUTH_OPEN_Y", value);
}

function hashState(state: OniState) {
  return state.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function playState(model: Model, state: OniState, variation = 0) {
  const expression = STATE_EXPRESSIONS[state];
  if (expression) void model.expression?.(expression);

  const motions = STATE_MOTIONS[state];
  if (!motions?.length) return;
  const motion = motions[Math.abs(variation) % motions.length];
  void model.motion?.(motion.group, motion.index);
}

export function OniLive2D({ state, glow, speaking = false }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef<Model | null>(null);
  const baseSizeRef = useRef<{ width: number; height: number } | null>(null);
  const stateRef = useRef<OniState>(state);
  const speakingRef = useRef(speaking);
  const lastGestureRef = useRef<string>("");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);

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
        playState(model, stateRef.current, hashState(stateRef.current));
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
  }, []);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;
    lastGestureRef.current = "";
    playState(model, state, hashState(state) + Math.floor(performance.now() / 1000));
  }, [state, ready]);

  // Micro-behavior layer: breathing, gentle head/body sway and gaze drift.
  // These parameters are deliberately subtle so they do not fight Shizuku's
  // authored motions and physics.
  useEffect(() => {
    if (!ready) return;
    let frame = 0;

    const tick = () => {
      const model = modelRef.current;
      if (!model) return;

      const now = performance.now();
      const breath = (Math.sin(now / 1150) + 1) * 0.5;
      const headX = Math.sin(now / 2100) * (speakingRef.current ? 4.2 : 2.4);
      const headY = Math.sin(now / 2750 + 0.8) * 1.7;
      const bodyX = Math.sin(now / 3200 + 1.4) * 1.2;
      const eyeX = Math.sin(now / 1800 + 0.35) * 0.22;
      const eyeY = Math.sin(now / 2400 + 1.1) * 0.12;

      setParam(model, "PARAM_BREATH", breath);
      setParam(model, "PARAM_ANGLE_X", headX);
      setParam(model, "PARAM_ANGLE_Y", headY);
      setParam(model, "PARAM_BODY_ANGLE_X", bodyX);
      setParam(model, "PARAM_EYE_BALL_X", eyeX);
      setParam(model, "PARAM_EYE_BALL_Y", eyeY);

      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [ready]);

  // Speaking layer: non-mechanical lip-sync plus periodic gestures. The timing
  // varies so the same motion is not repeated like a fixed animation loop.
  useEffect(() => {
    const model = modelRef.current;
    if (!speaking || !model || !ready) {
      if (model) setMouth(model, 0);
      return;
    }

    let frame = 0;
    let gestureTimeout = 0;
    let gestureCount = 0;

    const mouthTick = () => {
      const current = modelRef.current;
      if (!current) return;
      const now = performance.now();
      const syllable = Math.abs(Math.sin(now / 92));
      const secondary = Math.abs(Math.sin(now / 173 + 0.9));
      const mouth = 0.08 + syllable * 0.54 + secondary * 0.22;
      setMouth(current, Math.min(0.9, mouth));
      frame = window.requestAnimationFrame(mouthTick);
    };

    const scheduleGesture = () => {
      const delay = 2600 + ((gestureCount * 977) % 1700);
      gestureTimeout = window.setTimeout(() => {
        const current = modelRef.current;
        if (!current || !speakingRef.current) return;

        const candidates = STATE_MOTIONS[stateRef.current] ?? STATE_MOTIONS.speaking ?? [];
        if (candidates.length) {
          let index = (gestureCount + hashState(stateRef.current)) % candidates.length;
          let motion = candidates[index];
          let key = `${motion.group}:${motion.index}`;
          if (key === lastGestureRef.current && candidates.length > 1) {
            index = (index + 1) % candidates.length;
            motion = candidates[index];
            key = `${motion.group}:${motion.index}`;
          }
          lastGestureRef.current = key;
          void current.motion?.(motion.group, motion.index);
        }

        gestureCount += 1;
        scheduleGesture();
      }, delay);
    };

    frame = window.requestAnimationFrame(mouthTick);
    scheduleGesture();

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(gestureTimeout);
      if (modelRef.current) setMouth(modelRef.current, 0);
    };
  }, [speaking, ready]);

  // Idle/state layer: when ONI is not speaking, occasionally play a restrained
  // state-appropriate motion so the character never looks frozen.
  useEffect(() => {
    if (!ready || speaking) return;
    let timeout = 0;
    let cycle = 0;

    const schedule = () => {
      const delay = 5200 + ((hashState(stateRef.current) + cycle * 811) % 3600);
      timeout = window.setTimeout(() => {
        const current = modelRef.current;
        if (!current || speakingRef.current) return;
        playState(current, stateRef.current, hashState(stateRef.current) + cycle + 1);
        cycle += 1;
        schedule();
      }, delay);
    };

    schedule();
    return () => window.clearTimeout(timeout);
  }, [ready, speaking, state]);

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
