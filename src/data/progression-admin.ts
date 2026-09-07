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

export async function grantEventReward(input: { uid: string; nickname: string; eventId: string; placement: EventRewardPlacement }) {
  const admin = firebaseAuth.currentUser;
  if (!admin || admin.email?.trim().toLowerCase() !== "erkaa130@gmail.com") throw new Error("admin_required");
  const eventId = input.eventId.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
  if (!eventId || !input.uid) throw new Error("invalid_event");
  const reward = rewardFor(input.placement);
  const profileRef = doc(firebaseDb, "progressionProfiles", input.uid);
  const ledgerRef = doc(firebaseDb, "progressionLedger", `event_${eventId}_${input.uid}`);
  return runTransaction(firebaseDb, async (tx) => {
    const [profileSnap, ledgerSnap] = await Promise.all([tx.get(profileRef), tx.get(ledgerRef)]);
    if (ledgerSnap.exists()) throw new Error("already_rewarded");
    tx.set(ledgerRef, { uid: input.uid, sourceType: reward.sourceType, sourceKey: eventId, xp: reward.xp, coin: reward.coin, placement: input.placement, createdAt: Timestamp.now(), awardedBy: admin.uid });
    if (profileSnap.exists()) {
      const p = profileSnap.data();
      tx.update(profileRef, {
        xp: Number(p["xp"] ?? 0) + reward.xp,
        coin: Number(p["coin"] ?? 0) + reward.coin,
        lifetimeXp: Number(p["lifetimeXp"] ?? p["xp"] ?? 0) + reward.xp,
        seasonXp: Number(p["seasonXp"] ?? p["xp"] ?? 0) + reward.xp,
        eventCount: Number(p["eventCount"] ?? 0) + 1,
        updatedAt: Timestamp.now(),
      });
    } else {
      tx.set(profileRef, { uid: input.uid, nickname: input.nickname || "ONI MEMBER", xp: reward.xp, coin: reward.coin, lifetimeXp: reward.xp, seasonXp: reward.xp, prestige: 0, meetCount: 0, creatorCount: 0, eventCount: 1, unlocked: [], equipped: {}, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    }
    return { xp: reward.xp, coin: reward.coin };
  });
}
