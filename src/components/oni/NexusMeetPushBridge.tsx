import { isAdminEmail } from "@/lib/admin-authorization";
import { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, type DocumentData } from "firebase/firestore";

import { firebaseAuth, firebaseDb } from "@/integrations/firebase/client";
import { sendNexusMeetPush } from "@/lib/nexus-push.functions";

const STORAGE_KEY = "oni:nexus:last-meet-push";

function timestampKey(value: unknown) {
  if (!value || typeof value !== "object") return "";
  if ("toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    try {
      return String((value as { toMillis: () => number }).toMillis());
    } catch {
      return "";
    }
  }
  return "";
}

function stringValue(data: DocumentData, key: string) {
  const value = data[key];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Production-only admin bridge that turns a newly-created scheduled Meet into
 * one Shizuki Web Push broadcast. The first Firestore snapshot is ignored, so
 * opening/reloading the app never re-announces an existing Meet. Later edits
 * keep the original createdAt and therefore do not broadcast again.
 */
export function NexusMeetPushBridge() {
  const unsubscribeMeet = useRef<null | (() => void)>(null);

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    const stopAuth = onAuthStateChanged(firebaseAuth, (user) => {
      unsubscribeMeet.current?.();
      unsubscribeMeet.current = null;

      if (!user || !isAdminEmail(user.email)) return;

      let initialized = false;
      let previousCreatedAt = "";

      unsubscribeMeet.current = onSnapshot(
        doc(firebaseDb, "meets", "current"),
        async (snapshot) => {
          if (!snapshot.exists()) {
            initialized = true;
            previousCreatedAt = "";
            return;
          }

          const data = snapshot.data();
          const createdAt = timestampKey(data["createdAt"]);
          const status = stringValue(data, "status").toLowerCase();
          const title = stringValue(data, "title") || "ONI MEET";

          if (!initialized) {
            initialized = true;
            previousCreatedAt = createdAt;
            return;
          }

          const isAnnounceable = status === "scheduled" || status === "live";
          const isNewMeet = !!createdAt && createdAt !== previousCreatedAt;
          previousCreatedAt = createdAt;
          if (!isAnnounceable || !isNewMeet) return;

          try {
            if (localStorage.getItem(STORAGE_KEY) === createdAt) return;
          } catch {
            // Storage is an optimization only; server-side admin verification remains authoritative.
          }

          try {
            const idToken = await user.getIdToken();
            const result = await sendNexusMeetPush({
              data: { idToken, meetTitle: title, url: "/meet" },
            });
            if (!result.ok) {
              console.warn("[oni-nexus] meet push skipped", result.code, result.message);
              return;
            }
            try {
              localStorage.setItem(STORAGE_KEY, createdAt);
            } catch {
              // Ignore storage failures after a successful broadcast.
            }
            console.info("[oni-nexus] meet push", {
              sent: result.sent,
              stale: result.stale,
              failed: result.failed,
            });
          } catch (error) {
            console.warn(
              "[oni-nexus] meet push bridge failed",
              error instanceof Error ? error.message : "unknown",
            );
          }
        },
        (error) => {
          console.warn("[oni-nexus] meet watcher unavailable", error.message);
        },
      );
    });

    return () => {
      stopAuth();
      unsubscribeMeet.current?.();
      unsubscribeMeet.current = null;
    };
  }, []);

  return null;
}
