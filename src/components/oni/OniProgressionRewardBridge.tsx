import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth } from "@/integrations/firebase/client";
import { claimMeetAttendanceReward } from "@/data/progression";

export function OniProgressionRewardBridge() {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const attempt = async () => {
      if (cancelled || !firebaseAuth.currentUser) return;
      try {
        const result = await claimMeetAttendanceReward();
        if (result === "claimed") {
          window.dispatchEvent(
            new CustomEvent("oni:progression-reward", {
              detail: { source: "meet", xp: 100, coin: 50 },
            }),
          );
        }
      } catch (error) {
        console.warn(
          "[oni-progression] meet reward check failed",
          error instanceof Error ? error.message : "unknown",
        );
      }
    };

    const stopAuth = onAuthStateChanged(firebaseAuth, (user) => {
      if (timer) clearInterval(timer);
      timer = null;
      if (!user) return;
      void attempt();
      timer = setInterval(() => void attempt(), 30_000);
    });

    const onFocus = () => void attempt();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      cancelled = true;
      stopAuth();
      if (timer) clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);
  return null;
}
