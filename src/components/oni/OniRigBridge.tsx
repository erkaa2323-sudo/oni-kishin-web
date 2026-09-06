import { useEffect, useState } from "react";
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

type RigTarget = {
  element: HTMLElement;
  state: OniState;
};

function stateFromElement(element: HTMLElement): OniState {
  for (const state of STATES) {
    if (element.classList.contains(`oni-character-presence--${state}`)) return state;
  }
  return "idle";
}

function sameTargets(current: RigTarget[], next: RigTarget[]) {
  return (
    current.length === next.length &&
    current.every(
      (item, index) =>
        item.element === next[index]?.element && item.state === next[index]?.state,
    )
  );
}

/**
 * Migration bridge for the existing OniAiChamber character slots.
 * It watches only each slot's state class, avoiding body-wide mutation loops
 * and preserving one stable OniWebRig instance per slot.
 */
export function OniRigBridge() {
  const [targets, setTargets] = useState<RigTarget[]>([]);

  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(".oni-character-presence"),
    );

    const read = () => {
      const next = elements.map((element) => ({
        element,
        state: stateFromElement(element),
      }));
      setTargets((current) => (sameTargets(current, next) ? current : next));
    };

    const observers = elements.map((element) => {
      const oldBody = element.querySelector<HTMLElement>(
        ".oni-character-presence__body",
      );
      if (oldBody) oldBody.style.opacity = "0";

      const observer = new MutationObserver(read);
      observer.observe(element, {
        attributes: true,
        attributeFilter: ["class"],
      });

      return { observer, oldBody };
    });

    read();

    return () => {
      for (const { observer, oldBody } of observers) {
        observer.disconnect();
        if (oldBody) oldBody.style.opacity = "";
      }
    };
  }, []);

  return (
    <>
      {targets.map(({ element, state }, index) => {
        const visual = ONI_STATE_VISUALS[state];
        return createPortal(
          <OniWebRig
            state={state}
            glow={visual.glow}
            speaking={state === "speaking"}
          />,
          element,
          `oni-rig-${index}`,
        );
      })}
    </>
  );
}
