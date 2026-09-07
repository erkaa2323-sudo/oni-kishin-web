import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { ONI_STATE_VISUALS, inferReplyState, type OniState } from "@/lib/oni-emotion";
import { OniLive2D } from "./OniLive2D";

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

function latestOniReply() {
  const logs = Array.from(document.querySelectorAll<HTMLElement>('[role="log"]'));
  for (let logIndex = logs.length - 1; logIndex >= 0; logIndex -= 1) {
    const rows = Array.from(logs[logIndex].children) as HTMLElement[];
    for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex -= 1) {
      const text = rows[rowIndex].innerText?.trim() ?? "";
      if (!text.includes("ONI SHIZUKI")) continue;
      const clean = text.replace(/^ONI SHIZUKI\s*/i, "").trim();
      if (clean && !clean.includes("Бодож байна")) return clean;
    }
  }
  return "";
}

function replySegments(text: string) {
  const pieces = text
    .split(/(?<=[.!?。！？])\s+|\n+/u)
    .map((piece) => piece.trim())
    .filter(Boolean);

  if (pieces.length <= 4) return pieces;

  const grouped: string[] = [];
  const size = Math.ceil(pieces.length / 4);
  for (let index = 0; index < pieces.length; index += size) {
    grouped.push(pieces.slice(index, index + size).join(" "));
  }
  return grouped;
}

function AdaptiveLive2D({ state }: { state: OniState }) {
  const [displayState, setDisplayState] = useState<OniState>(state);

  useEffect(() => {
    const timers: number[] = [];
    setDisplayState(state);

    if (state !== "speaking") {
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    }

    const reply = latestOniReply();
    const segments = replySegments(reply);
    if (!segments.length) {
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    }

    // Keep the opening speaking beat, then let the face/body react to each
    // semantic chunk while lip-sync continues for the entire speaking phase.
    let elapsed = 420;
    segments.forEach((segment, index) => {
      const emotion = inferReplyState("", segment);
      const delay = Math.min(1450, Math.max(760, 560 + segment.length * 13));
      const timer = window.setTimeout(() => setDisplayState(emotion), elapsed);
      timers.push(timer);
      elapsed += delay + (index % 2) * 90;
    });

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [state]);

  const visual = ONI_STATE_VISUALS[displayState];
  return (
    <OniLive2D
      state={displayState}
      glow={visual.glow}
      speaking={state === "speaking"}
    />
  );
}

/**
 * Bridges the existing ONI AI character slots to the real Live2D renderer.
 * During a reply, AdaptiveLive2D reads the visible ONI answer in small semantic
 * chunks and changes expression/motion without interrupting lip-sync.
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
      {targets.map(({ element, state }, index) =>
        createPortal(
          <AdaptiveLive2D state={state} />,
          element,
          `oni-live2d-${index}`,
        ),
      )}
    </>
  );
}
