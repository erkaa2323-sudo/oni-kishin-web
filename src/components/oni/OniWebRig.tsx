import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import oniCharacter from "@/assets/oni-character.webp";
import type { OniState } from "@/lib/oni-emotion";
import { getOniRigAsset, getOniRigAssetCoverage } from "./oni-rig-assets";
import { ONI_RIG_EXPRESSIONS } from "./oni-rig-expression";
import { ONI_RIG_LAYERS, ONI_RIG_STATE_INTENSITY } from "./oni-rig-manifest";
import "./OniWebRig.css";

type Props = { state: OniState; glow: number; speaking?: boolean };
type RigStyle = CSSProperties & Record<`--oni-${string}`, string>;

export function OniWebRig({ state, glow, speaking = false }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const x = Math.max(-1, Math.min(1, (event.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      const y = Math.max(-1, Math.min(1, (event.clientY - (r.top + r.height * 0.35)) / (r.height * 0.55)));
      setLook({ x, y });
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => window.removeEventListener("pointermove", onPointer);
  }, []);

  const coverage = useMemo(() => getOniRigAssetCoverage(), []);
  const availableLayers = useMemo(
    () => ONI_RIG_LAYERS.map((layer) => ({ ...layer, src: getOniRigAsset(layer.id) })).filter((layer) => Boolean(layer.src)),
    [],
  );
  const hasLayeredArt = coverage.complete;
  const expression = ONI_RIG_EXPRESSIONS[state];
  const missing = coverage.missing.join(",");
  const duplicateBaseNames = coverage.duplicateBaseNames ?? [];
  const duplicates = duplicateBaseNames.join(",");

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

  return (
    <div
      ref={rootRef}
      className={`oni-web-rig oni-web-rig--${state}${speaking ? " is-speaking" : ""}${hasLayeredArt ? " has-layered-art" : ""}`}
      style={style}
      aria-hidden="true"
      data-rig-mode={hasLayeredArt ? "layered" : "fallback"}
      data-rig-assets={`${coverage.available.length}/${coverage.total}`}
      data-rig-missing={missing}
      data-rig-duplicates={duplicates}
      data-expression={state}
      data-speaking={speaking ? "true" : "false"}
    >
      <div className="oni-web-rig__shadow" />
      <div className="oni-web-rig__aura" />
      <div className="oni-web-rig__body">
        {!hasLayeredArt && <img src={oniCharacter} alt="" decoding="async" className="oni-web-rig__fallback" />}
        {hasLayeredArt && availableLayers.map((layer) => (
          <img key={layer.id} src={layer.src} alt="" decoding="async" draggable={false} className={`oni-web-rig__layer oni-web-rig__layer--${layer.id} oni-web-rig__physics--${layer.physics ?? "body"}`} style={{ zIndex: layer.z, transformOrigin: `${layer.anchorX}% ${layer.anchorY}%` }} />
        ))}
        {!hasLayeredArt && (
          <div className="oni-web-rig__face-life">
            <span className="oni-web-rig__eye oni-web-rig__eye--left"><i /></span>
            <span className="oni-web-rig__eye oni-web-rig__eye--right"><i /></span>
            <span className="oni-web-rig__mouth" />
          </div>
        )}
      </div>
      <div className="oni-web-rig__hair-flow" />
      <div className="oni-web-rig__particles" />
    </div>
  );
}
