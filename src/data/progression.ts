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
import { ONI_REWARDS, type ProgressionLedgerEntry } from "@/lib/progression-rewards";

const DEFAULT_EQUIPPED: Record<string, string> = {};
const number = (value: unknown) => Math.max(0, Number(value ?? 0));

function parseProfile(uid: string, data: Record<string, unknown>): OniProgressionProfile {
  const unlocked = data["unlocked"];
  const equipped = data["equipped"];
  return {
    uid,
    nickname: String(data["nickname"] ?? "ONI"),
    xp: number(data["xp"]),
    coin: number(data["coin"]),
    lifetimeXp: number(data["lifetimeXp"] ?? data["xp"]),
    seasonXp: number(data["seasonXp"] ?? data["xp"]),
    prestige: number(data["prestige"]),
    meetCount: number(data["meetCount"]),
    creatorCount: number(data["creatorCount"]),
    eventCount: number(data["eventCount"]),
    unlocked: Array.isArray(unlocked) ? unlocked.map(String) : [],
    equipped:
      equipped && typeof equipped === "object"
        ? (equipped as Record<string, string>)
        : DEFAULT_EQUIPPED,
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

export async function ensureMyProgression(): Promise<OniProgressionProfile | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  const account = await getDoc(doc(firebaseDb, "memberAccounts", user.uid));
  if (!account.exists() || account.data()["status"] !== "approved") return null;
  const ref = doc(firebaseDb, "progressionProfiles", user.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return parseProfile(user.uid, existing.data());
  const nickname = String(account.data()["nickname"] ?? "ONI");
  const profile = blankProfile(user.uid, nickname);
  await setDoc(ref, { ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return profile;
}

export async function getMyProgression() {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(firebaseDb, "progressionProfiles", user.uid));
  return snap.exists() ? parseProfile(user.uid, snap.data()) : ensureMyProgression();
}

export async function unlockVaultItem(itemId: string) {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("auth_required");
  const item = ONI_VAULT.find((entry) => entry.id === itemId);
  if (!item) throw new Error("item_not_found");
  const ref = doc(firebaseDb, "progressionProfiles", user.uid);
  await runTransaction(firebaseDb, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("profile_required");
    const p = parseProfile(user.uid, snap.data());
    if (p.unlocked.includes(item.id)) throw new Error("already_unlocked");
    if (p.xp < item.minXp) throw new Error("rank_required");
    if (p.coin < item.price) throw new Error("coin_required");
    tx.update(ref, {
      coin: p.coin - item.price,
      unlocked: [...p.unlocked, item.id],
      updatedAt: serverTimestamp(),
    });
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
    const p = parseProfile(user.uid, snap.data());
    if (!p.unlocked.includes(item.id)) throw new Error("unlock_required");
    tx.update(ref, {
      equipped: { ...p.equipped, [item.category]: item.id },
      updatedAt: serverTimestamp(),
    });
  });
}

export async function claimMeetAttendanceReward(): Promise<
  "claimed" | "already" | "not_ready" | "unavailable"
> {
  const user = firebaseAuth.currentUser;
  if (!user) return "unavailable";
  const profile = await ensureMyProgression();
  if (!profile) return "unavailable";
  const meetRef = doc(firebaseDb, "meets", "current");
  const participantRef = doc(firebaseDb, "meetParticipants", user.uid);
  const claimRef = doc(firebaseDb, "progressionMeetClaims", user.uid);
  const profileRef = doc(firebaseDb, "progressionProfiles", user.uid);
  return runTransaction(firebaseDb, async (tx) => {
    const [meetSnap, participantSnap, claimSnap, profileSnap] = await Promise.all([
      tx.get(meetRef),
      tx.get(participantRef),
      tx.get(claimRef),
      tx.get(profileRef),
    ]);
    if (!meetSnap.exists() || !participantSnap.exists() || !profileSnap.exists())
      return "unavailable" as const;
    const meet = meetSnap.data();
    const participant = participantSnap.data();
    const start = meet["startAt"];
    if (!start || participant["meetStartAt"]?.toMillis?.() !== start.toMillis?.())
      return "unavailable" as const;
    if (start.toMillis() > Date.now() || meet["status"] === "ended" || meet["status"] === "closed")
      return "not_ready" as const;
    if (claimSnap.exists() && claimSnap.data()["meetStartAt"]?.toMillis?.() === start.toMillis())
      return "already" as const;
    const p = parseProfile(user.uid, profileSnap.data());
    const nonce = crypto.randomUUID().replace(/-/g, "");
    const reward = ONI_REWARDS.meetAttendance;
    tx.set(claimRef, {
      uid: user.uid,
      meetStartAt: start,
      claimNonce: nonce,
      updatedAt: serverTimestamp(),
    });
    tx.set(doc(firebaseDb, "progressionLedger", `${user.uid}_${nonce}`), {
      uid: user.uid,
      sourceType: "meet_attendance",
      sourceKey: nonce,
      xp: reward.xp,
      coin: reward.coin,
      meetStartAt: start,
      createdAt: serverTimestamp(),
    });
    tx.update(profileRef, {
      xp: p.xp + reward.xp,
      coin: p.coin + reward.coin,
      lifetimeXp: p.lifetimeXp + reward.xp,
      seasonXp: p.seasonXp + reward.xp,
      meetCount: p.meetCount + 1,
      updatedAt: serverTimestamp(),
    });
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
  const snap = await getDocs(
    query(collection(firebaseDb, "progressionLedger"), where("uid", "==", user.uid)),
  );
  return snap.docs.map((entry) => {
    const row = entry.data();
    const created = row["createdAt"];
    return {
      id: entry.id,
      uid: String(row["uid"] ?? ""),
      sourceType: String(row["sourceType"] ?? ""),
      sourceKey: String(row["sourceKey"] ?? ""),
      xp: number(row["xp"]),
      coin: number(row["coin"]),
      createdAt:
        created && typeof created.toDate === "function" ? created.toDate().toISOString() : null,
    };
  });
}

export async function getProgressionLeaderboard() {
  const snap = await getDocs(
    query(collection(firebaseDb, "progressionProfiles"), orderBy("seasonXp", "desc")),
  );
  return snap.docs.slice(0, 20).map((entry) => parseProfile(entry.id, entry.data()));
}
