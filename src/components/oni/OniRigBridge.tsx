import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ONI_STATE_VISUALS, type OniState } from "@/lib/oni-emotion";
import { OniWebRig } from "./OniWebRig";

const STATES: OniState[] = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "happy",
  "excited",
  "concerned",
  "serious",
  "surprised",
  "music",
];

function stateFromElement(element: HTMLElement): OniState {
  for (const state of STATES) {
    if (element.classList.contains(`oni-character-presence--${state}`)) return state;
  }
  return "idle";
}

/**
 * Safe migration bridge: mounts the new web-native rig into the existing
 * character slots without rewriting OniAiChamber. Once layered art is final,
 * the chamber can adopt OniWebRig directly and this bridge can be removed.
 */
export function OniRigBridge() {
  const [targets, setTargets] = useState<HTMLElement[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => {
      const next = Array.from(
        document.querySelectorAll<HTMLElement>(".oni-character-presence"),
      );
      setTargets((current) => {
        if (current.length === next.length && current.every((item, i) => item === next[i])) {
          return current;
        }
        return next;
      });
      setVersion((value) => value + 1);
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    for (const target of targets) {
      const image = target.querySelector<HTMLElement>(".oni-character-presence__body");
      if (image) image.style.opacity = "0";
    }
    return () => {
      for (const target of targets) {
        const image = target.querySelector<HTMLElement>(".oni-character-presence__body");
        if (image) image.style.opacity = "";
      }
    };
  }, [targets]);

  return useMemo(
    () =>
      targets.map((target, index) => {
        const state = stateFromElement(target);
        const visual = ONI_STATE_VISUALS[state];
        return createPortal(
          <OniWebRig
            key={`${index}-${version}`}
            state={state}
            glow={visual.glow}
            speaking={state === "speaking"}
          />,
          target,
        );
      }),
    [targets, version],
  );
}
