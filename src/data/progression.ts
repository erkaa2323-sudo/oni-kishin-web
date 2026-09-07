import { collection, doc, getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp, setDoc, where } from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "@/integrations/firebase/client";
import { ONI_VAULT, type OniProgressionProfile } from "@/lib/oni-progression";

const DEFAULT_EQUIPPED: Record<string, string> = {};

function parseProfile(uid: string, data: Record<string, unknown>): OniProgressionProfile {
  return {
    uid,
    nickname: String(data.nickname ?? "ONI"),
    xp: Math.max(0, Number(data.xp ?? 0)),
    coin: Math.max(0, Number(data.coin ?? 0)),
    lifetimeXp: Math.max(0, Number(data.lifetimeXp ?? data.xp ?? 0)),
    seasonXp: Math.max(0, Number(data.seasonXp ?? data.xp ?? 0)),
    prestige: Math.max(0, Number(data.prestige ?? 0)),
    unlocked: Array.isArray(data.unlocked) ? data.unlocked.map(String) : [],
    equipped: data.equipped && typeof data.equipped === "object" ? data.equipped as Record<string, string> : DEFAULT_EQUIPPED,
  };
}

export async function ensureMyProgression(): Promise<OniProgressionProfile | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  const account = await getDoc(doc(firebaseDb, "memberAccounts", user.uid));
  if (!account.exists() || account.data().status !== "approved") return null;
  const ref = doc(firebaseDb, "progressionProfiles", user.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return parseProfile(user.uid, existing.data());
  const nickname = String(account.data().nickname ?? "ONI");
  const initial = { uid: user.uid, nickname, xp: 0, coin: 0, lifetimeXp: 0, seasonXp: 0, prestige: 0, unlocked: [], equipped: {}, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await setDoc(ref, initial);
  return { uid: user.uid, nickname, xp: 0, coin: 0, lifetimeXp: 0, seasonXp: 0, prestige: 0, unlocked: [], equipped: {} };
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
    tx.update(ref, { coin: p.coin - item.price, unlocked: [...p.unlocked, item.id], updatedAt: serverTimestamp() });
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
    tx.update(ref, { equipped: { ...p.equipped, [item.category]: item.id }, updatedAt: serverTimestamp() });
  });
}

export async function getProgressionLeaderboard() {
  const snap = await getDocs(query(collection(firebaseDb, "progressionProfiles"), orderBy("seasonXp", "desc")));
  return snap.docs.slice(0, 20).map((entry) => parseProfile(entry.id, entry.data()));
}

export async function hasRewardLedger(sourceType: string, sourceId: string) {
  const user = firebaseAuth.currentUser;
  if (!user) return true;
  const snap = await getDocs(query(collection(firebaseDb, "progressionLedger"), where("uid", "==", user.uid), where("sourceKey", "==", `${sourceType}:${sourceId}`)));
  return !snap.empty;
}
