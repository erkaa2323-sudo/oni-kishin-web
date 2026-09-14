import { useEffect } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";

import { watchMemberAuth, type MemberAccountStatus } from "@/data/member-auth";
import { firebaseDb } from "@/integrations/firebase/client";
import {
  cancelNativeNotification,
  clearNativeNotificationBadge,
  hasNativeNotificationBridge,
  requestNativeNotificationPermission,
  scheduleNativeNotification,
  showNativeNotification,
  type NativeNotificationPath,
} from "@/lib/native-notifications";
import { rankForXp } from "@/lib/oni-progression";

const ALLOWED_PATHS = new Set<NativeNotificationPath>([
  "/meet",
  "/profile",
  "/garage",
  "/street-ops",
  "/gallery",
  "/admin",
]);

function nativePath(value: unknown, fallback: NativeNotificationPath): NativeNotificationPath {
  const path = String(value ?? "").split(/[?#]/, 1)[0] as NativeNotificationPath;
  return ALLOWED_PATHS.has(path) ? path : fallback;
}

function dateFrom(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  return null;
}

function numberFrom(row: DocumentData, key: string) {
  const value = Number(row[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function formatDelta(value: number, label: string) {
  if (!value) return "";
  return `${value > 0 ? "+" : ""}${value} ${label}`;
}

function syncMeetNotifications(
  row: DocumentData,
  previousIds: Set<string>,
  remember: (ids: Set<string>) => void,
) {
  const startAt = dateFrom(row["startAt"]);
  const status = String(row["status"] ?? "scheduled");
  const enabled = row["enabled"] !== false;
  const active = enabled && startAt && status !== "ended" && status !== "closed";
  const nextIds = new Set<string>();

  if (!active || !startAt) {
    for (const id of previousIds) cancelNativeNotification(id);
    remember(nextIds);
    return;
  }

  const stamp = startAt.getTime();
  const reminderId = `oni-meet-reminder-${stamp}`;
  const liveId = `oni-meet-live-${stamp}`;
  const title = String(row["title"] ?? "ONI MEET").trim() || "ONI MEET";
  const now = Date.now();
  const reminderAt = new Date(stamp - 10 * 60 * 1000);

  nextIds.add(reminderId);
  nextIds.add(liveId);
  for (const id of previousIds) {
    if (!nextIds.has(id)) cancelNativeNotification(id);
  }

  if (reminderAt.getTime() > now + 5_000) {
    scheduleNativeNotification({
      id: reminderId,
      title: "ONI HUB · MEET 10 МИНУТЫН ДАРАА",
      body: `${title} эхлэхэд 10 минут үлдлээ. Crew channel-д бэлэн байгаарай.`,
      url: "/meet",
      fireAt: reminderAt,
    });
  } else {
    cancelNativeNotification(reminderId);
  }

  if (stamp > now + 5_000) {
    scheduleNativeNotification({
      id: liveId,
      title: "ONI HUB · MEET ЭХЭЛЛЭЭ",
      body: `${title} одоо нээгдлээ. Notification дээр дарж Meet рүү шууд орно.`,
      url: "/meet",
      fireAt: startAt,
    });
  } else {
    cancelNativeNotification(liveId);
  }

  remember(nextIds);
}

/**
 * Native shells do not rely on browser PushManager. This bridge mirrors the
 * already-authorized ONI Firestore state into OS notifications while the app
 * is running and schedules Meet reminders in the OS so they survive normal
 * backgrounding. Existing PWA/Web Push remains the remote transport for web
 * installs; native APNs/FCM credentials are intentionally not embedded here.
 */
export function OniNativeNotificationBridge() {
  useEffect(() => {
    if (!hasNativeNotificationBridge()) return undefined;

    clearNativeNotificationBadge();

    let accountStatus: MemberAccountStatus | null = null;
    let stopProfile: (() => void) | null = null;
    let stopMeet: (() => void) | null = null;
    let stopSocial: (() => void) | null = null;
    let scheduledMeetIds = new Set<string>();

    const stopRealtime = () => {
      stopProfile?.();
      stopMeet?.();
      stopSocial?.();
      stopProfile = null;
      stopMeet = null;
      stopSocial = null;
    };

    const stopAuth = watchMemberAuth(
      ({ user, account }) => {
        const previousStatus = accountStatus;
        accountStatus = account?.status ?? null;

        if (previousStatus && previousStatus !== "approved" && account?.status === "approved") {
          showNativeNotification({
            id: `oni-account-approved-${Date.now()}`,
            title: "ONI HUB · CREW ACCOUNT",
            body: `${account.nickname || "ONI member"}, таны Crew account баталгаажлаа.`,
            url: "/profile",
          });
        }

        stopRealtime();
        if (!user || !account || account.status !== "approved") return;
        requestNativeNotificationPermission();

        let profileReady = false;
        let lastXp = 0;
        let lastCoin = 0;
        let lastRank = "";
        stopProfile = onSnapshot(
          doc(firebaseDb, "progressionProfiles", user.uid),
          (snapshot) => {
            if (!snapshot.exists()) return;
            const row = snapshot.data();
            const xp = numberFrom(row, "xp");
            const coin = numberFrom(row, "coin");
            const rank = rankForXp(xp).name;
            if (!profileReady) {
              profileReady = true;
              lastXp = xp;
              lastCoin = coin;
              lastRank = rank;
              return;
            }

            const xpDelta = xp - lastXp;
            const coinDelta = coin - lastCoin;
            if (rank !== lastRank) {
              showNativeNotification({
                id: `oni-rank-${Date.now()}`,
                title: "ONI HUB · RANK UP",
                body: `${account.nickname}, шинэ rank: ${rank}.`,
                url: "/profile",
              });
            } else if (xpDelta || coinDelta) {
              const changes = [formatDelta(xpDelta, "XP"), formatDelta(coinDelta, "ONI")]
                .filter(Boolean)
                .join(" · ");
              showNativeNotification({
                id: `oni-progression-${Date.now()}`,
                title: "ONI HUB · PROGRESSION",
                body: changes,
                url: "/profile",
              });
            }
            lastXp = xp;
            lastCoin = coin;
            lastRank = rank;
          },
          () => undefined,
        );

        stopMeet = onSnapshot(
          doc(firebaseDb, "meets", "current"),
          (snapshot) => {
            syncMeetNotifications(snapshot.exists() ? snapshot.data() : {}, scheduledMeetIds, (ids) => {
              scheduledMeetIds = ids;
            });
          },
          () => undefined,
        );

        let socialReady = false;
        stopSocial = onSnapshot(
          query(collection(firebaseDb, "socialEvents"), orderBy("createdAt", "desc"), limit(20)),
          (snapshot) => {
            if (!socialReady) {
              socialReady = true;
              return;
            }
            for (const change of snapshot.docChanges()) {
              if (change.type !== "added") continue;
              const row = change.doc.data();
              const type = String(row["type"] ?? "");
              if (type !== "event_win" && type !== "creator_approved") continue;
              showNativeNotification({
                id: `oni-social-${change.doc.id}`,
                title:
                  type === "event_win"
                    ? "ONI HUB · STREET OPS"
                    : "ONI HUB · CREATOR APPROVED",
                body: String(row["detail"] ?? row["title"] ?? "ONI activity шинэчлэгдлээ."),
                url: nativePath(
                  row["targetUrl"],
                  type === "event_win" ? "/street-ops" : "/gallery",
                ),
              });
            }
          },
          () => undefined,
        );
      },
      () => undefined,
    );

    const onVisible = () => {
      if (document.visibilityState === "visible") clearNativeNotificationBadge();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopAuth();
      stopRealtime();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
