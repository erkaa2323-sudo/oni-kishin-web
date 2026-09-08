import { isAdminEmail } from "@/lib/admin-authorization";
import { doc, runTransaction, Timestamp } from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "@/integrations/firebase/client";
import { ONI_REWARDS } from "@/lib/progression-rewards";

export type EventRewardPlacement = "participation" | "third" | "second" | "first";

const rewardFor = (placement: EventRewardPlacement) => {
  if (placement === "first") return { ...ONI_REWARDS.eventFirst, sourceType: "event_first" };
  if (placement === "second") return { ...ONI_REWARDS.eventSecond, sourceType: "event_second" };
  if (placement === "third") return { ...ONI_REWARDS.eventThird, sourceType: "event_third" };
  return { ...ONI_REWARDS.eventParticipation, sourceType: "event_participation" };
};

const n = (value: unknown) => Math.max(0, Number(value ?? 0));
const millis = (value: unknown) =>
  value && typeof value === "object" && "toMillis" in value
    ? Number((value as { toMillis: () => number }).toMillis())
    : 0;

export async function grantEventReward(input: {
  uid: string;
  nickname: string;
  eventId: string;
  placement: EventRewardPlacement;
}) {
  const admin = firebaseAuth.currentUser;
  if (!admin || !isAdminEmail(admin.email)) throw new Error("admin_required");
  const eventId = input.eventId
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 80);
  if (!eventId || !input.uid) throw new Error("invalid_event");
  const reward = rewardFor(input.placement);
  const profileRef = doc(firebaseDb, "progressionProfiles", input.uid);
  const ledgerRef = doc(firebaseDb, "progressionLedger", `event_${eventId}_${input.uid}`);
  const socialRef = doc(firebaseDb, "socialEvents", `event_${eventId}_${input.uid}`);
  const configRef = doc(firebaseDb, "progressionMissions", "currentWeek");
  const weeklyRef = doc(firebaseDb, "progressionWeekly", input.uid);
  return runTransaction(firebaseDb, async (tx) => {
    const [profileSnap, ledgerSnap, configSnap, weeklySnap] = await Promise.all([
      tx.get(profileRef),
      tx.get(ledgerRef),
      tx.get(configRef),
      tx.get(weeklyRef),
    ]);
    if (ledgerSnap.exists()) throw new Error("already_rewarded");
    const currentCoin = profileSnap.exists() ? n(profileSnap.data()["coin"]) : 0;
    const balanceAfter = currentCoin + reward.coin;
    tx.set(ledgerRef, {
      uid: input.uid,
      sourceType: reward.sourceType,
      sourceKey: eventId,
      xp: reward.xp,
      coin: reward.coin,
      balanceAfter,
      placement: input.placement,
      createdAt: Timestamp.now(),
      awardedBy: admin.uid,
    });
    if (profileSnap.exists()) {
      const p = profileSnap.data();
      tx.update(profileRef, {
        xp: n(p["xp"]) + reward.xp,
        coin: balanceAfter,
        lifetimeXp: n(p["lifetimeXp"] ?? p["xp"]) + reward.xp,
        seasonXp: n(p["seasonXp"] ?? p["xp"]) + reward.xp,
        eventCount: n(p["eventCount"]) + 1,
        updatedAt: Timestamp.now(),
      });
    } else {
      tx.set(profileRef, {
        uid: input.uid,
        nickname: input.nickname || "ONI MEMBER",
        xp: reward.xp,
        coin: balanceAfter,
        lifetimeXp: reward.xp,
        seasonXp: reward.xp,
        prestige: 0,
        meetCount: 0,
        creatorCount: 0,
        eventCount: 1,
        unlocked: [],
        equipped: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    if (configSnap.exists()) {
      const config = configSnap.data();
      const weekId = String(config["weekId"] ?? "");
      const start = millis(config["startsAt"]);
      const end = millis(config["endsAt"]);
      const now = Date.now();
      if (config["enabled"] === true && weekId && start && end && now >= start && now < end) {
        const old =
          weeklySnap.exists() && String(weeklySnap.data()["weekId"] ?? "") === weekId
            ? weeklySnap.data()
            : null;
        tx.set(weeklyRef, {
          uid: input.uid,
          weekId,
          meet: n(old?.["meet"]),
          creator: n(old?.["creator"]),
          activity: n(old?.["activity"]) + 1,
          lastSourceType: reward.sourceType,
          lastSourceKey: eventId,
          updatedAt: Timestamp.now(),
        });
      }
    }

    const label =
      input.placement === "first"
        ? "1-р байр"
        : input.placement === "second"
          ? "2-р байр"
          : input.placement === "third"
            ? "3-р байр"
            : "Event оролцоо";
    tx.set(socialRef, {
      uid: input.uid,
      nickname: input.nickname || "ONI MEMBER",
      type: "event_win",
      title: `${input.nickname || "ONI MEMBER"} · ${label}`,
      detail: `${eventId} · +${reward.xp} XP · +${reward.coin} ONI`,
      targetUrl: "/crew",
      reactions: 0,
      createdAt: Timestamp.now(),
    });
    return { xp: reward.xp, coin: reward.coin };
  });
}
