import { useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "./OniWorldTransition.css";

const WORLD_ORDER = ["/", "/crew", "/garage", "/meet", "/oni-ai"] as const;

type WorldRoute = (typeof WORLD_ORDER)[number];
type Direction = "forward" | "backward" | "neutral";

function normalizeWorldRoute(pathname: string): WorldRoute | null {
  if (pathname === "/") return "/";
  return WORLD_ORDER.find((route) => route !== "/" && pathname.startsWith(route)) ?? null;
}

function routeDirection(previous: WorldRoute | null, next: WorldRoute | null): Direction {
  if (!previous || !next || previous === next) return "neutral";
  const from = WORLD_ORDER.indexOf(previous);
  const to = WORLD_ORDER.indexOf(next);
  if (from < 0 || to < 0) return "neutral";
  return to > from ? "forward" : "backward";
}

function detectAdaptiveFx() {
  if (typeof window === "undefined") return "full";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const compact = window.matchMedia("(max-width: 820px)").matches;
  const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency || 8;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return reduced || (compact && coarse && (cores <= 4 || memory <= 4)) ? "lite" : "full";
}

export function OniWorldTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currentWorld = useMemo(() => normalizeWorldRoute(pathname), [pathname]);
  const previousWorld = useRef<WorldRoute | null>(currentWorld);
  const [direction, setDirection] = useState<Direction>("neutral");
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const quality = detectAdaptiveFx();
    document.documentElement.dataset["oniFx"] = quality;

    const refresh = () => {
      document.documentElement.dataset["oniFx"] = detectAdaptiveFx();
    };
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    media.addEventListener?.("change", refresh);
    window.addEventListener("orientationchange", refresh, { passive: true });
    return () => {
      media.removeEventListener?.("change", refresh);
      window.removeEventListener("orientationchange", refresh);
    };
  }, []);

  useEffect(() => {
    const nextDirection = routeDirection(previousWorld.current, currentWorld);
    previousWorld.current = currentWorld;
    setDirection(nextDirection);
    setTransitioning(true);

    const frame = requestAnimationFrame(() => {
      document.documentElement.dataset["oniWorld"] = currentWorld ?? "other";
    });
    const timer = window.setTimeout(() => setTransitioning(false), 520);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [pathname, currentWorld]);

  return (
    <div
      className="oni-world-shell"
      data-direction={direction}
      data-transitioning={transitioning ? "true" : "false"}
    >
      <div className="oni-world-ambient" aria-hidden="true">
        <span className="oni-world-ambient__glow" />
        <span className="oni-world-ambient__depth" />
        <span className="oni-world-ambient__grain" />
      </div>
      <div key={pathname} className="oni-world-scene">
        {children}
      </div>
      <div className="oni-world-wipe" aria-hidden="true" />
    </div>
  );
}