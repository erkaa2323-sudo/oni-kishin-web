import { useEffect, useRef, useState, type CSSProperties } from "react";
import oniCharacter from "@/assets/oni-character.webp";
import type { OniState } from "@/lib/oni-emotion";
import "./OniWebRig.css";

type Props = { state: OniState; glow: number; speaking?: boolean };

type RigStyle = CSSProperties & {
  "--oni-look-x": string;
  "--oni-look-y": string;
  "--oni-glow": string;
};

/**
 * Web-native ONI rig runtime.
 * Phase 1 provides gaze, blink, breathing, speaking pulse and state-driven
 * body language today. The DOM is intentionally layered so transparent
 * face/hair/mouth art can replace the fallback raster without changing the API.
 */
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
      const y = Math.max(-1, Math.min(1, (event.clientY - (r.top + r.height * .35)) / (r.height * .55)));
      setLook({ x, y });
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => window.removeEventListener("pointermove", onPointer);
  }, []);

  const style: RigStyle = {
    "--oni-look-x": `${look.x}`,
    "--oni-look-y": `${look.y}`,
    "--oni-glow": `${glow}`,
  };

  return (
    <div ref={rootRef} className={`oni-web-rig oni-web-rig--${state}${speaking ? " is-speaking" : ""}`} style={style} aria-hidden="true">
      <div className="oni-web-rig__shadow" />
      <div className="oni-web-rig__aura" />
      <div className="oni-web-rig__body">
        <img src={oniCharacter} alt="" decoding="async" className="oni-web-rig__fallback" />
        <div className="oni-web-rig__face-life">
          <span className="oni-web-rig__eye oni-web-rig__eye--left"><i /></span>
          <span className="oni-web-rig__eye oni-web-rig__eye--right"><i /></span>
          <span className="oni-web-rig__mouth" />
        </div>
      </div>
      <div className="oni-web-rig__hair-flow" />
      <div className="oni-web-rig__particles" />
    </div>
  );
}
