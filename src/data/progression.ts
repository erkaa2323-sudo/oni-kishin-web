import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "@/integrations/firebase/client";
import { ONI_VAULT, type OniProgressionProfile } from "@/lib/oni-progression";
import {
  ONI_REWARDS,
  achievementById,
  weeklyMissionById,
  type AchievementId,
  type ProgressionLedgerEntry,
  type SeasonConfig,
  type WeeklyConfig,
  type WeeklyProgress,
} from "@/lib/progression-rewards";

const DEFAULT_EQUIPPED: Record<string, string> = {};
const MAX_PRESTIGE = 3;
const PRESTIGE_XP = 26_000;
const nonNegative = (value: unknown) => Math.max(0, Number(value ?? 0));
const signed = (value: unknown) => Number(value ?? 0) || 0;
const toMillis = (value: unknown) => value && typeof value === "object" && "toMillis" in value
  ? Number((value as { toMillis: () => number }).toMillis())
  : 0;
const toIso = (value: unknown) => value && typeof value === "object" && "toDate" in value
  ? (value as { toDate: () => Date }).toDate().toISOString()
  : null;

export function parseProgressionProfile(uid: string, data: Record<string, unknown>): OniProgressionProfile {
  const unlocked = data["unlocked"];
  const equipped = data["equipped"];
  return {
    uid,
    nickname: String(data["nickname"] ?? "ONI"),
    xp: nonNegative(data["xp"]),
    coin: nonNegative(data["coin"]),
    lifetimeXp: nonNegative(data["lifetimeXp"] ?? data["xp"]),
    seasonXp: nonNegative(data["seasonXp"] ?? data["xp"]),
    prestige: nonNegative(data["prestige"]),
    meetCount: nonNegative(data["meetCount"]),
    creatorCount: nonNegative(data["creatorCount"]),
    eventCount: nonNegative(data["eventCount"]),
    unlocked: Array.isArray(unlocked) ? unlocked.map(String) : [],
    equipped: equipped && typeof equipped === "object" ? equipped as Record<string, string> : DEFAULT_EQUIPPED,
  };
}

const blankProfile = (uid: string, nickname: string) => ({
  uid,
  nickname,
  xp: 0,
  coin: 0,
  lifetimeXp: 0,
  seasonXp: 0,
  prestige: 0,
  meetCount: 0,
  creatorCount: 0,
  eventCount: 0,
  unlocked: [],
  equipped: {},
});

function achievementEligible(id: AchievementId, profile: OniProgressionProfile) {
  if (id === "first-blood") return profile.meetCount >= 1;
  if (id === "night-rider") return profile.meetCount >= 10;
  if (id === "content-creator") return profile.creatorCount >= 5;
  if (id === "collector") return profile.unlocked.length >= 5;
  if (id === "kishin") return profile.lifetimeXp >= 8_500;
  return profile.lifetimeXp >= 26_000;
}

export async function ensureMyProgression(): Promise<OniProgressionProfile | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  const account = await getDoc(doc(firebaseDb, "memberAccounts", user.uid));
  if (!account.exists() || account.data()["status"] !== "approved") return null;
  const ref = doc(firebaseDb, "progressionProfiles", user.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return parseProgressionProfile(user.uid, existing.data());
  const nickname = String(account.data()["nickname"] ?? "ONI");
  const profile = blankProfile(user.uid, nickname);
  await setDoc(ref, { ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return profile;
}

export async function getMyProgression() {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(firebaseDb, "progressionProfiles", user.uid));
  return snap.exists() ? parseProgressionProfile(user.uid, snap.data()) : ensureMyProgression();
}

export async function getCurrentWeeklyConfig(): Promise<WeeklyConfig | null> {
  const snap = await getDoc(doc(firebaseDb, "progressionMissions", "currentWeek"));
  if (!snap.exists()) return null;
  const row = snap.data();
  return {
    weekId: String(row["weekId"] ?? ""),
    startsAt: toIso(row["startsAt"]),
    endsAt: toIso(row["endsAt"]),
    enabled: row["enabled"] === true,
  };
}

export async function getCurrentSeasonConfig(): Promise<SeasonConfig | null> {
  const snap = await getDoc(doc(firebaseDb, "progressionMissions", "currentSeason"));
  if (!snap.exists()) return null;
  const row = snap.data();
  return {
    seasonId: String(row["seasonId"] ?? ""),
    startsAt: toIso(row["startsAt"]),
    endsAt: toIso(row["endsAt"]),
    enabled: row["enabled"] === true,
  };
}

export async function getMyWeeklyProgress(): Promise<WeeklyProgress | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(firebaseDb, "progressionWeekly", user.uid));
  if (!snap.exists()) return null;
  const row = snap.data();
  return {
    uid: user.uid,
    weekId: String(row["weekId"] ?? ""),
    meet: nonNegative(row["meet"]),
    creator: nonNegative(row["creator"]),
    activity: nonNegative(row["activity"]),
  };
}

export async function getMyWeeklyClaims(weekId: string): Promise<Set<string>> {
  const user = firebaseAuth.currentUser;
  if (!user || !weekId) return new Set();
  const snapshot = await getDocs(query(
    collection(firebaseDb, "progressionMissionClaims"),
    where("uid", "==", user.uid),
    where("weekId", "==", weekId),
  ));
  return new Set(snapshot.docs.map((row) => String(row.data()["missionId"] ?? "")).filter(Boolean));
}

export async function claimWeeklyMission(missionId: string): Promise<"claimed" | "already" | "not_ready" | "unavailable"> {
  const user = firebaseAuth.currentUser;
  const mission = weeklyMissionById(missionId);
  if (!user || !mission) return "unavailable";
  const configRef = doc(firebaseDb, "progressionMissions", "currentWeek");
  const weeklyRef = doc(firebaseDb, "progressionWeekly", user.uid);
  const profileRef = doc(firebaseDb, "progressionProfiles", user.uid);
  return runTransaction(firebaseDb, async (tx) => {
    const [configSnap, weeklySnap, profileSnap] = await Promise.all([tx.get(configRef), tx.get(weeklyRef), tx.get(profileRef)]);
    if (!configSnap.exists() || !weeklySnap.exists() || !profileSnap.exists()) return "unavailable" as const;
    const config = configSnap.data();
    const weekId = String(config["weekId"] ?? "");
    const startsAt = toMillis(config["startsAt"]);
    const endsAt = toMillis(config["endsAt"]);
    const now = Date.now();
    if (!weekId || config["enabled"] !== true || !startsAt || !endsAt || now < startsAt || now >= endsAt) return "not_ready" as const;
    const weekly = weeklySnap.data();
    if (String(weekly["weekId"] ?? "") !== weekId) return "not_ready" as const;
    const progressValue = mission.kind === "meet"
      ? nonNegative(weekly["meet"])
      : mission.kind === "creator"
        ? nonNegative(weekly["creator"])
        : nonNegative(weekly["activity"]);
    if (progressValue < mission.target) return "not_ready" as const;
    const claimRef = doc(firebaseDb, "progressionMissionClaims", `${user.uid}_${weekId}_${mission.id}`);
    const claimSnap = await tx.get(claimRef);
    if (claimSnap.exists()) return "already" as const;
    const profile = parseProgressionProfile(user.uid, profileSnap.data());
    const balanceAfter = profile.coin + mission.rewardCoin;
    const ledgerRef = doc(firebaseDb, "progressionLedger", `mission_${user.uid}_${weekId}_${mission.id}`);
    tx.set(claimRef, { uid: user.uid, weekId, missionId: mission.id, rewardCoin: mission.rewardCoin, createdAt: serverTimestamp() });
    tx.set(ledgerRef, {
      uid: user.uid,
      sourceType: "weekly_mission",
      sourceKey: `${weekId}_${mission.id}`,
      xp: 0,
      coin: mission.rewardCoin,
      balanceAfter,
      weekId,
      missionId: mission.id,
      createdAt: serverTimestamp(),
    });
    tx.update(profileRef, { coin: balanceAfter, updatedAt: serverTimestamp() });
    return "claimed" as const;
  });
}

export async function getMyAchievementClaims(): Promise<Set<AchievementId>> {
  const user = firebaseAuth.currentUser;
  if (!user) return new Set();
  const snapshot = await getDocs(query(collection(firebaseDb, "progressionAchievementClaims"), where("uid", "==", user.uid)));
  return new Set(snapshot.docs.map((row) => String(row.data()["achievementId"] ?? "") as AchievementId).filter((id) => achievementById(id) !== null));
}

export async function claimAchievement(achievementId: AchievementId): Promise<"claimed" | "already" | "not_ready" | "unavailable"> {
  const user = firebaseAuth.currentUser;
  if (!user || !achievementById(achievementId)) return "unavailable";
  const profileRef = doc(firebaseDb, "progressionProfiles", user.uid);
  const claimRef = doc(firebaseDb, "progressionAchievementClaims", `${user.uid}_${achievementId}`);
  return runTransaction(firebaseDb, async (tx) => {
    const [profileSnap, claimSnap] = await Promise.all([tx.get(profileRef), tx.get(claimRef)]);
    if (!profileSnap.exists()) return "unavailable" as const;
    if (claimSnap.exists()) return "already" as const;
    const profile = parseProgressionProfile(user.uid, profileSnap.data());
    if (!achievementEligible(achievementId, profile)) return "not_ready" as const;
    tx.set(claimRef, {
      uid: user.uid,
      achievementId,
      meetCount: profile.meetCount,
      creatorCount: profile.creatorCount,
      unlockedCount: profile.unlocked.length,
      lifetimeXp: profile.lifetimeXp,
      claimedAt: serverTimestamp(),
    });
    return "claimed" as const;
  });
}

export async function claimPrestige(): Promise<"claimed" | "max" | "not_ready" | "unavailable"> {
  const user = firebaseAuth.currentUser;
  if (!user) return "unavailable";
  const profileRef = doc(firebaseDb, "progressionProfiles", user.uid);
  return runTransaction(firebaseDb, async (tx) => {
    const profileSnap = await tx.get(profileRef);
    if (!profileSnap.exists()) return "unavailable" as const;
    const profile = parseProgressionProfile(user.uid, profileSnap.data());
    if (profile.prestige >= MAX_PRESTIGE) return "max" as const;
    if (profile.xp < PRESTIGE_XP) return "not_ready" as const;
    const nextPrestige = profile.prestige + 1;
    const claimRef = doc(firebaseDb, "progressionPrestigeClaims", `${user.uid}_${nextPrestige}`);
    const claimSnap = await tx.get(claimRef);
    if (claimSnap.exists()) return "max" as const;
    const ledgerRef = doc(firebaseDb, "progressionLedger", `prestige_${user.uid}_${nextPrestige}`);
    tx.set(claimRef, {
      uid: user.uid,
      prestige: nextPrestige,
      previousXp: profile.xp,
      lifetimeXp: profile.lifetimeXp,
      createdAt: serverTimestamp(),
    });
    tx.set(ledgerRef, {
      uid: user.uid,
      sourceType: "prestige",
      sourceKey: String(nextPrestige),
      xp: 0,
      coin: 0,
      balanceAfter: profile.coin,
      prestige: nextPrestige,
      createdAt: serverTimestamp(),
    });
    tx.update(profileRef, { xp: 0, prestige: nextPrestige, updatedAt: serverTimestamp() });
    return "claimed" as const;
  });
}

export async function unlockVaultItem(itemId: string) {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("auth_required");
  const item = ONI_VAULT.find((entry) => entry.id === itemId);
  if (!item) throw new Error("item_not_found");
  const ref = doc(firebaseDb, "progressionProfiles", user.uid);
  const spendRef = doc(firebaseDb, "progressionLedger", `spend_${user.uid}_${item.id}`);
  await runTransaction(firebaseDb, async (tx) => {
    const [snap, spendSnap] = await Promise.all([tx.get(ref), tx.get(spendRef)]);
    if (!snap.exists()) throw new Error("profile_required");
    const p = parseProgressionProfile(user.uid, snap.data());
    if (p.unlocked.includes(item.id) || spendSnap.exists()) throw new Error("already_unlocked");
    if (p.xp < item.minXp) throw new Error("rank_required");
    if (p.coin < item.price) throw new Error("coin_required");
    const balanceAfter = p.coin - item.price;
    tx.update(ref, { coin: balanceAfter, unlocked: [...p.unlocked, item.id], updatedAt: serverTimestamp() });
    tx.set(spendRef, { uid: user.uid, sourceType: "vault_spend", sourceKey: item.id, itemId: item.id, xp: 0, coin: -item.price, balanceAfter, createdAt: serverTimestamp() });
    tx.set(doc(firebaseDb, "socialEvents", `${user.uid}_cosmetic_${item.id}`), {
      uid: user.uid,
      nickname: p.nickname,
      type: "cosmetic_unlock",
      itemId: item.id,
      title: `${p.nickname} шинэ cosmetic unlock хийлээ`,
      detail: `${item.name} · ${item.rarity}`,
      targetUrl: "/progression",
      reactions: 0,
      createdAt: serverTimestamp(),
    });
  });
}

export async function equipVaultItem(itemId: string) {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("auth_required");
  const item = ONI_VAULT.find((entry) => entry.id === itemId);
  if (!item) throw new Error("item_not_found");
  const ref = doc(firebaseDb, "progressionProfiles", user.uid);
  await runTransaction(firebaseDb, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("profile_required");
    const p = parseProgressionProfile(user.uid, snap.data());
    if (!p.unlocked.includes(item.id)) throw new Error("unlock_required");
    tx.update(ref, { equipped: { ...p.equipped, [item.category]: item.id }, updatedAt: serverTimestamp() });
  });
}

export async function claimMeetAttendanceReward(): Promise<"claimed" | "already" | "not_ready" | "unavailable"> {
  const user = firebaseAuth.currentUser;
  if (!user) return "unavailable";
  const profile = await ensureMyProgression();
  if (!profile) return "unavailable";
  const meetRef = doc(firebaseDb, "meets", "current");
  const participantRef = doc(firebaseDb, "meetParticipants", user.uid);
  const attendanceRef = doc(firebaseDb, "meetAttendance", user.uid);
  const claimRef = doc(firebaseDb, "progressionMeetClaims", user.uid);
  const profileRef = doc(firebaseDb, "progressionProfiles", user.uid);
  const configRef = doc(firebaseDb, "progressionMissions", "currentWeek");
  const weeklyRef = doc(firebaseDb, "progressionWeekly", user.uid);
  return runTransaction(firebaseDb, async (tx) => {
    const [meetSnap, participantSnap, attendanceSnap, claimSnap, profileSnap, configSnap, weeklySnap] = await Promise.all([
      tx.get(meetRef),
      tx.get(participantRef),
      tx.get(attendanceRef),
      tx.get(claimRef),
      tx.get(profileRef),
      tx.get(configRef),
      tx.get(weeklyRef),
    ]);
    if (!meetSnap.exists() || !participantSnap.exists() || !profileSnap.exists()) return "unavailable" as const;
    const meet = meetSnap.data();
    const participant = participantSnap.data();
    const start = meet["startAt"];
    const startMs = toMillis(start);
    if (!start || !startMs || toMillis(participant["meetStartAt"]) !== startMs) return "unavailable" as const;
    if (startMs > Date.now()) return "not_ready" as const;
    if (!attendanceSnap.exists() || toMillis(attendanceSnap.data()["meetStartAt"]) !== startMs) return "not_ready" as const;
    if (claimSnap.exists() && toMillis(claimSnap.data()["meetStartAt"]) === startMs) return "already" as const;
    const p = parseProgressionProfile(user.uid, profileSnap.data());
    const nonce = crypto.randomUUID().replace(/-/g, "");
    const reward = ONI_REWARDS.meetAttendance;
    const balanceAfter = p.coin + reward.coin;
    tx.set(claimRef, { uid: user.uid, meetStartAt: start, claimNonce: nonce, updatedAt: serverTimestamp() });
    tx.set(doc(firebaseDb, "progressionLedger", `${user.uid}_${nonce}`), {
      uid: user.uid,
      sourceType: "meet_attendance",
      sourceKey: nonce,
      xp: reward.xp,
      coin: reward.coin,
      balanceAfter,
      meetStartAt: start,
      createdAt: serverTimestamp(),
    });
    tx.update(profileRef, {
      xp: p.xp + reward.xp,
      coin: balanceAfter,
      lifetimeXp: p.lifetimeXp + reward.xp,
      seasonXp: p.seasonXp + reward.xp,
      meetCount: p.meetCount + 1,
      updatedAt: serverTimestamp(),
    });
    if (configSnap.exists()) {
      const config = configSnap.data();
      const weekId = String(config["weekId"] ?? "");
      const startsAt = toMillis(config["startsAt"]);
      const endsAt = toMillis(config["endsAt"]);
      if (weekId && config["enabled"] === true && startsAt && endsAt && startMs >= startsAt && startMs < endsAt) {
        const previous = weeklySnap.exists() && String(weeklySnap.data()["weekId"] ?? "") === weekId ? weeklySnap.data() : null;
        tx.set(weeklyRef, {
          uid: user.uid,
          weekId,
          meet: nonNegative(previous?.["meet"]) + 1,
          creator: nonNegative(previous?.["creator"]),
          activity: nonNegative(previous?.["activity"]) + 1,
          lastSourceType: "meet_attendance",
          lastSourceKey: nonce,
          updatedAt: serverTimestamp(),
        });
      }
    }
    tx.set(doc(firebaseDb, "socialEvents", `${user.uid}_meet_${nonce}`), {
      uid: user.uid,
      nickname: p.nickname,
      type: "meet_attendance",
      sourceKey: nonce,
      title: `${p.nickname} ONI Meet-д оролцлоо`,
      detail: `+${reward.xp} XP · +${reward.coin} ONI`,
      targetUrl: "/meet",
      reactions: 0,
      createdAt: serverTimestamp(),
    });
    return "claimed" as const;
  });
}

export async function getMyProgressionLedger(): Promise<ProgressionLedgerEntry[]> {
  const user = firebaseAuth.currentUser;
  if (!user) return [];
  const snap = await getDocs(query(collection(firebaseDb, "progressionLedger"), where("uid", "==", user.uid)));
  return snap.docs.map((entry) => {
    const row = entry.data();
    return {
      id: entry.id,
      uid: String(row["uid"] ?? ""),
      sourceType: String(row["sourceType"] ?? ""),
      sourceKey: String(row["sourceKey"] ?? ""),
      xp: signed(row["xp"]),
      coin: signed(row["coin"]),
      balanceAfter: row["balanceAfter"] == null ? null : nonNegative(row["balanceAfter"]),
      createdAt: toIso(row["createdAt"]),
    };
  });
}

export async function getProgressionLeaderboard() {
  const snap = await getDocs(query(collection(firebaseDb, "progressionProfiles"), orderBy("seasonXp", "desc")));
  return snap.docs.slice(0, 20).map((entry) => parseProgressionProfile(entry.id, entry.data()));
}
