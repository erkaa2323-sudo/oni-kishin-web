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

type RigTarget = { element: HTMLElement; state: OniState };

function stateFromElement(element: HTMLElement): OniState {
  for (const state of STATES)
    if (element.classList.contains(`oni-character-presence--${state}`)) return state;
  return "idle";
}

function isVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return (
    style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0
  );
}

function sameTargets(current: RigTarget[], next: RigTarget[]) {
  return (
    current.length === next.length &&
    current.every(
      (item, index) => item.element === next[index]?.element && item.state === next[index]?.state,
    )
  );
}

function latestOniReply() {
  const logs = Array.from(document.querySelectorAll<HTMLElement>('[role="log"]')).filter(isVisible);
  for (let logIndex = logs.length - 1; logIndex >= 0; logIndex -= 1) {
    const log = logs[logIndex];
    if (!log) continue;
    const rows = Array.from(log.children) as HTMLElement[];
    for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex -= 1) {
      const row = rows[rowIndex];
      if (!row) continue;
      const text = row.innerText?.trim() ?? "";
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
  for (let index = 0; index < pieces.length; index += size)
    grouped.push(pieces.slice(index, index + size).join(" "));
  return grouped;
}

function AdaptiveLive2D({ state }: { state: OniState }) {
  const [displayState, setDisplayState] = useState<OniState>(state);

  useEffect(() => {
    const timers: number[] = [];
    setDisplayState(state);
    if (state !== "speaking") return () => timers.forEach((timer) => window.clearTimeout(timer));
    const segments = replySegments(latestOniReply());
    if (!segments.length) return () => timers.forEach((timer) => window.clearTimeout(timer));
    let elapsed = 420;
    segments.forEach((segment, index) => {
      const emotion = inferReplyState("", segment);
      const delay = Math.min(1450, Math.max(760, 560 + segment.length * 13));
      timers.push(window.setTimeout(() => setDisplayState(emotion), elapsed));
      elapsed += delay + (index % 2) * 90;
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [state]);

  const visual = ONI_STATE_VISUALS[displayState];
  return <OniLive2D state={displayState} glow={visual.glow} speaking={state === "speaking"} />;
}

/** Mount one Live2D renderer only into the currently visible mobile/desktop chamber. */
export function OniRigBridge() {
  const [targets, setTargets] = useState<RigTarget[]>([]);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(".oni-character-presence"));
    const read = () => {
      const visible = elements.filter(isVisible);
      const active = visible.length ? visible : elements.slice(0, 1);
      const next = active
        .slice(0, 1)
        .map((element) => ({ element, state: stateFromElement(element) }));
      setTargets((current) => (sameTargets(current, next) ? current : next));
    };
    const observers = elements.map((element) => {
      const oldBody = element.querySelector<HTMLElement>(".oni-character-presence__body");
      const observer = new MutationObserver(read);
      observer.observe(element, { attributes: true, attributeFilter: ["class", "style"] });
      return { observer, oldBody };
    });
    const resizeObserver = new ResizeObserver(read);
    elements.forEach((element) => resizeObserver.observe(element));
    window.addEventListener("resize", read, { passive: true });
    read();
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", read);
      for (const { observer, oldBody } of observers) {
        observer.disconnect();
        if (oldBody) oldBody.style.opacity = "";
      }
    };
  }, []);

  // Both responsive chat logs exist in the DOM. Observe both, but scroll only the
  // visible one so mobile replies never get sent to the hidden desktop log ref.
  useEffect(() => {
    const logs = Array.from(document.querySelectorAll<HTMLElement>('[role="log"]'));
    const scrollVisible = () => {
      const log = logs.find(isVisible);
      if (log)
        requestAnimationFrame(() => log.scrollTo({ top: log.scrollHeight, behavior: "smooth" }));
    };
    const observers = logs.map((log) => {
      const observer = new MutationObserver(scrollVisible);
      observer.observe(log, { childList: true, subtree: true });
      return observer;
    });
    window.addEventListener("resize", scrollVisible, { passive: true });
    scrollVisible();
    return () => {
      observers.forEach((observer) => observer.disconnect());
      window.removeEventListener("resize", scrollVisible);
    };
  }, []);

  useEffect(() => {
    const all = Array.from(document.querySelectorAll<HTMLElement>(".oni-character-presence"));
    for (const element of all) {
      const oldBody = element.querySelector<HTMLElement>(".oni-character-presence__body");
      if (oldBody)
        oldBody.style.opacity = targets.some((target) => target.element === element) ? "0" : "";
    }
  }, [targets]);

  return (
    <>
      {targets.map(({ element, state }) =>
        createPortal(<AdaptiveLive2D state={state} />, element, "oni-live2d-active"),
      )}
    </>
  );
}
