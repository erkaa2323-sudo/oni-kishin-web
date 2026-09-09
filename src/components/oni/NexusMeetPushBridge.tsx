import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";

import { firebaseAuth, firebaseDb } from "@/integrations/firebase/client";
import { isAdminIdentity } from "@/lib/admin-authorization";

type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function notifyAdmin(body: string) {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("ONI HUB · ШИНЭ ХҮСЭЛТ", {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: "oni-admin-request",
      });
    }
  }
}

/**
 * Meet push delivery has a single source of truth: the successful admin
 * `meet.create` action. This bridge no longer broadcasts Meet events.
 *
 * It now provides a separate, read-only admin watcher for incoming Join and
 * Crew-account requests. The first snapshot is ignored so opening Admin never
 * re-notifies old records; only records added afterwards raise the badge/event.
 */
export function NexusMeetPushBridge() {
  useEffect(() => {
    let stopApplications: (() => void) | null = null;
    let stopAccounts: (() => void) | null = null;
    let pendingBadge = 0;

    const stopAuth = onAuthStateChanged(firebaseAuth, (user) => {
      stopApplications?.();
      stopAccounts?.();
      stopApplications = null;
      stopAccounts = null;
      pendingBadge = 0;

      if (!user) return;
      void user
        .getIdTokenResult()
        .then((token) => {
          if (!isAdminIdentity(user.email, token.claims)) return;

          let applicationsReady = false;
          let accountsReady = false;
          const raise = (detail: { kind: "application" | "member_account"; id: string }) => {
            pendingBadge += 1;
            void (navigator as BadgeNavigator).setAppBadge?.(pendingBadge).catch(() => undefined);
            window.dispatchEvent(new CustomEvent("oni:admin-request", { detail }));
            notifyAdmin(
              detail.kind === "application"
                ? "Шинэ элсэлтийн анкет ирлээ."
                : "Шинэ Crew account баталгаажуулах хүсэлт ирлээ.",
            );
          };

          stopApplications = onSnapshot(collection(firebaseDb, "applications"), (snapshot) => {
            if (!applicationsReady) {
              applicationsReady = true;
              return;
            }
            for (const change of snapshot.docChanges()) {
              if (change.type === "added" && change.doc.data()["status"] === "Шинэ") {
                raise({ kind: "application", id: change.doc.id });
              }
            }
          });

          stopAccounts = onSnapshot(collection(firebaseDb, "memberAccounts"), (snapshot) => {
            if (!accountsReady) {
              accountsReady = true;
              return;
            }
            for (const change of snapshot.docChanges()) {
              if (change.type === "added" && change.doc.data()["status"] === "pending") {
                raise({ kind: "member_account", id: change.doc.id });
              }
            }
          });
        })
        .catch(() => undefined);
    });

    const clearBadge = () => {
      if (document.visibilityState === "visible") {
        pendingBadge = 0;
        void (navigator as BadgeNavigator).clearAppBadge?.().catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", clearBadge);

    return () => {
      stopAuth();
      stopApplications?.();
      stopAccounts?.();
      document.removeEventListener("visibilitychange", clearBadge);
    };
  }, []);

  return null;
}
