import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
  const [look, setLook] = useState<Look>({ x: 0, y: 0 });

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const setTarget = (clientX: number, clientY: number) => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      targetRef.current = {
        x: clamp((clientX - (r.left + r.width / 2)) / (r.width / 2)),
        y: clamp((clientY - (r.top + r.height * 0.35)) / (r.height * 0.55)),
      };
    };

    const onPointer = (event: PointerEvent) => setTarget(event.clientX, event.clientY);
    const onTouch = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) setTarget(touch.clientX, touch.clientY);
    };
    const onVisibility = () => {
      if (document.hidden) targetRef.current = { x: 0, y: 0 };
    };

    const tick = () => {
      const current = currentRef.current;
      const target = targetRef.current;
      const next = {
        x: current.x + (target.x - current.x) * 0.12,
        y: current.y + (target.y - current.y) * 0.12,
      };
      currentRef.current = next;
      setLook(next);
      frameRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    frameRef.current = requestAnimationFrame(tick);

    return () => {
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
  const missing = coverage.missing.join(",");
  const duplicates = (coverage.duplicateBaseNames ?? []).join(",");

  const style: RigStyle = {
    "--oni-look-x": `${look.x}`,
    "--oni-look-y": `${look.y}`,
    "--oni-glow": `${glow}`,
    "--oni-motion": `${ONI_RIG_STATE_INTENSITY[state]}`,
    "--oni-eye-open": `${expression.eyeOpen}`,
    "--oni-eye-smile": `${expression.eyeSmile}`,
    "--oni-pupil-scale": `${expression.pupilScale}`,
    "--oni-mouth-open": `${expression.mouthOpen}`,
    "--oni-mouth-smile": `${expression.mouthSmile}`,
    "--oni-blush": `${expression.blush}`,
    "--oni-head-tilt": `${expression.headTilt}deg`,
    "--oni-body-energy": `${expression.bodyEnergy}`,
  };

  return <div ref={rootRef} className={`oni-web-rig oni-web-rig--${state}${speaking ? " is-speaking" : ""}${hasLayeredArt ? " has-layered-art" : ""}`} style={style} aria-hidden="true" data-rig-mode={hasLayeredArt ? "layered" : "fallback"} data-rig-assets={`${coverage.available.length}/${coverage.total}`} data-rig-missing={missing} data-rig-duplicates={duplicates} data-expression={state} data-speaking={speaking ? "true" : "false"}>
    <div className="oni-web-rig__shadow" /><div className="oni-web-rig__aura" />
    <div className="oni-web-rig__body">
      {!hasLayeredArt && <img src={oniCharacter} alt="" decoding="async" className="oni-web-rig__fallback" />}
      {hasLayeredArt && availableLayers.map((layer) => <img key={layer.id} src={layer.src} alt="" decoding="async" draggable={false} className={`oni-web-rig__layer oni-web-rig__layer--${layer.id} oni-web-rig__physics--${layer.physics ?? "body"}`} style={{ zIndex: layer.z, transformOrigin: `${layer.anchorX}% ${layer.anchorY}%` }} />)}
      {!hasLayeredArt && <div className="oni-web-rig__face-life"><span className="oni-web-rig__eye oni-web-rig__eye--left"><i /></span><span className="oni-web-rig__eye oni-web-rig__eye--right"><i /></span><span className="oni-web-rig__mouth" /></div>}
    </div>
    <div className="oni-web-rig__hair-flow" /><div className="oni-web-rig__particles" />
  </div>;
}
