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
const integerReward = (value: unknown) => Math.max(0, Math.floor(Number(value ?? 0)));
const signedInteger = (value: unknown) => Math.trunc(Number(value ?? 0));
const millis = (value: unknown) =>
  value && typeof value === "object" && "toMillis" in value
    ? Number((value as { toMillis: () => number }).toMillis())
    : 0;

export async function adjustManualProgression(input: {
  uid: string;
  nickname: string;
  xp: number;
  coin: number;
  reason?: string;
}) {
  const admin = firebaseAuth.currentUser;
  if (!admin || !isAdminEmail(admin.email)) throw new Error("admin_required");

  const xp = signedInteger(input.xp);
  const coin = signedInteger(input.coin);
  if (!input.uid || (xp === 0 && coin === 0)) throw new Error("invalid_adjustment");
  if (Math.abs(xp) > 1_000_000 || Math.abs(coin) > 1_000_000)
    throw new Error("adjustment_too_large");

  const rewardId = `admin_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const profileRef = doc(firebaseDb, "progressionProfiles", input.uid);
  const ledgerRef = doc(firebaseDb, "progressionLedger", rewardId);
  const reason = input.reason?.trim().slice(0, 180) || "Админы XP / ONI засвар";

  return runTransaction(firebaseDb, async (tx) => {
    const profileSnap = await tx.get(profileRef);
    if (!profileSnap.exists()) {
      if (xp < 0 || coin < 0) throw new Error("profile_not_found");
      tx.set(profileRef, {
        uid: input.uid,
        nickname: input.nickname || "ONI MEMBER",
        xp,
        coin,
        lifetimeXp: xp,
        seasonXp: xp,
        prestige: 0,
        meetCount: 0,
        creatorCount: 0,
        eventCount: 0,
        unlocked: [],
        equipped: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      tx.set(ledgerRef, {
        uid: input.uid,
        sourceType: "admin_adjustment",
        sourceKey: rewardId,
        xp,
        coin,
        xpAfter: xp,
        balanceAfter: coin,
        reason,
        createdAt: Timestamp.now(),
        awardedBy: admin.uid,
      });
      return { xp, coin, xpAfter: xp, balanceAfter: coin };
    }

    const p = profileSnap.data();
    const currentXp = n(p["xp"]);
    const currentCoin = n(p["coin"]);
    const xpAfter = currentXp + xp;
    const balanceAfter = currentCoin + coin;
    if (xpAfter < 0) throw new Error("negative_xp");
    if (balanceAfter < 0) throw new Error("negative_balance");

    const lifetimeBefore = n(p["lifetimeXp"] ?? p["xp"]);
    const seasonBefore = n(p["seasonXp"] ?? p["xp"]);
    const lifetimeAfter = Math.max(0, lifetimeBefore + xp);
    const seasonAfter = Math.max(0, seasonBefore + xp);

    tx.update(profileRef, {
      xp: xpAfter,
      coin: balanceAfter,
      lifetimeXp: lifetimeAfter,
      seasonXp: seasonAfter,
      updatedAt: Timestamp.now(),
    });
    tx.set(ledgerRef, {
      uid: input.uid,
      sourceType: "admin_adjustment",
      sourceKey: rewardId,
      xp,
      coin,
      xpAfter,
      balanceAfter,
      reason,
      createdAt: Timestamp.now(),
      awardedBy: admin.uid,
    });

    return { xp, coin, xpAfter, balanceAfter };
  });
}

export async function grantManualReward(input: {
  uid: string;
  nickname: string;
  xp: number;
  coin: number;
  reason?: string;
}) {
  const xp = integerReward(input.xp);
  const coin = integerReward(input.coin);
  if (xp === 0 && coin === 0) throw new Error("invalid_reward");
  const result = await adjustManualProgression({ ...input, xp, coin });
  return { xp, coin, balanceAfter: result.balanceAfter, xpAfter: result.xpAfter };
}

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
