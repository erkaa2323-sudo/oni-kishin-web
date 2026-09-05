import { useEffect, useState } from "react";

export type ParallaxState = {
  /** -1..1 pointer offset */
  px: number;
  py: number;
  /** 0..1 hero scroll progress */
  sp: number;
  ready: boolean;
};

/**
 * Subtle depth driver: pointer for desktop, scroll for everyone.
 * Pointer tracking is skipped on coarse pointers and when the user prefers
 * reduced motion.
 */
export function useParallax(): ParallaxState {
  const [state, setState] = useState<ParallaxState>({
    px: 0,
    py: 0,
    sp: 0,
    ready: false,
  });

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    let frame = 0;
    let px = 0;
    let py = 0;
    let sp = 0;

    const commit = () => {
      frame = 0;
      setState({ px, py, sp, ready: true });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(commit);
    };

    const onMove = (e: PointerEvent) => {
      px = (e.clientX / window.innerWidth) * 2 - 1;
      py = (e.clientY / window.innerHeight) * 2 - 1;
      schedule();
    };
    const onScroll = () => {
      sp = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
      schedule();
    };

    onScroll();
    setState({ px: 0, py: 0, sp, ready: true });

    if (!reduce) {
      window.addEventListener("scroll", onScroll, { passive: true });
      if (fine) window.addEventListener("pointermove", onMove, { passive: true });
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return state;
}
