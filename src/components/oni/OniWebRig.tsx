import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import oniCharacter from "@/assets/oni-character.webp";
import type { OniState } from "@/lib/oni-emotion";
import { getOniRigAsset, getOniRigAssetCoverage } from "./oni-rig-assets";
import { ONI_RIG_EXPRESSIONS } from "./oni-rig-expression";
import { ONI_RIG_LAYERS, ONI_RIG_STATE_INTENSITY } from "./oni-rig-manifest";
import "./OniWebRig.css";

type Props = { state: OniState; glow: number; speaking?: boolean };
type RigStyle = CSSProperties & Record<`--oni-${string}`, string>;
type Look = { x: number; y: number };
const clamp = (value: number) => Math.max(-1, Math.min(1, value));

export function OniWebRig({ state, glow, speaking = false }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const targetRef = useRef<Look>({ x: 0, y: 0 });
  const currentRef = useRef<Look>({ x: 0, y: 0 });

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let running = true;
    let resetTimer = 0;

    const setTarget = (clientX: number, clientY: number) => {
      const r = root.getBoundingClientRect();
      if (!r.width || !r.height) return;
      targetRef.current = {
        x: clamp((clientX - (r.left + r.width / 2)) / (r.width / 2)),
        y: clamp((clientY - (r.top + r.height * 0.35)) / (r.height * 0.55)),
      };
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => { targetRef.current = { x: 0, y: 0 }; }, 1800);
    };
    const onPointer = (e: PointerEvent) => setTarget(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => { const t = e.touches[0]; if (t) setTarget(t.clientX, t.clientY); };
    const onVisibility = () => {
      running = !document.hidden;
      targetRef.current = { x: 0, y: 0 };
      if (running && frameRef.current === null) frameRef.current = requestAnimationFrame(tick);
    };
    const tick = () => {
      if (!running) { frameRef.current = null; return; }
      const c = currentRef.current, t = targetRef.current;
      const x = c.x + (t.x - c.x) * 0.14;
      const y = c.y + (t.y - c.y) * 0.14;
      currentRef.current = { x, y };
      root.style.setProperty("--oni-look-x", x.toFixed(3));
      root.style.setProperty("--oni-look-y", y.toFixed(3));
      frameRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      window.clearTimeout(resetTimer);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
      document.removeEventListener("visibilitychange", onVisibility);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const coverage = useMemo(() => getOniRigAssetCoverage(), []);
  const availableLayers = useMemo(() => ONI_RIG_LAYERS.map((layer) => ({ ...layer, src: getOniRigAsset(layer.id) })).filter((layer) => Boolean(layer.src)), []);
  const hasLayeredArt = coverage.complete;
  const expression = ONI_RIG_EXPRESSIONS[state];
  const style: RigStyle = {
    "--oni-look-x": "0", "--oni-look-y": "0", "--oni-glow": `${glow}`,
    "--oni-motion": `${ONI_RIG_STATE_INTENSITY[state]}`, "--oni-eye-open": `${expression.eyeOpen}`,
    "--oni-eye-smile": `${expression.eyeSmile}`, "--oni-pupil-scale": `${expression.pupilScale}`,
    "--oni-mouth-open": `${expression.mouthOpen}`, "--oni-mouth-smile": `${expression.mouthSmile}`,
    "--oni-blush": `${expression.blush}`, "--oni-head-tilt": `${expression.headTilt}deg`,
    "--oni-body-energy": `${expression.bodyEnergy}`,
  };

  return <div ref={rootRef} className={`oni-web-rig oni-web-rig--${state}${speaking ? " is-speaking" : ""}${hasLayeredArt ? " has-layered-art" : ""}`} style={style} aria-hidden="true" data-rig-mode={hasLayeredArt ? "layered" : "fallback"} data-rig-assets={`${coverage.available.length}/${coverage.total}`} data-expression={state} data-speaking={speaking ? "true" : "false"}>
    <div className="oni-web-rig__shadow" /><div className="oni-web-rig__aura" />
    <div className="oni-web-rig__body">
      {!hasLayeredArt && <img src={oniCharacter} alt="" decoding="async" draggable={false} className="oni-web-rig__fallback" />}
      {hasLayeredArt && availableLayers.map((layer) => <img key={layer.id} src={layer.src} alt="" decoding="async" draggable={false} className={`oni-web-rig__layer oni-web-rig__layer--${layer.id} oni-web-rig__physics--${layer.physics ?? "body"}`} style={{ zIndex: layer.z, transformOrigin: `${layer.anchorX}% ${layer.anchorY}%` }} />)}
      {!hasLayeredArt && <div className="oni-web-rig__face-life"><span className="oni-web-rig__eye oni-web-rig__eye--left"><i /></span><span className="oni-web-rig__eye oni-web-rig__eye--right"><i /></span><span className="oni-web-rig__mouth" /></div>}
    </div><div className="oni-web-rig__hair-flow" /><div className="oni-web-rig__particles" />
  </div>;
}
