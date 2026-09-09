import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "@/integrations/firebase/client";
import { fetchVehicles, type Vehicle } from "@/data/garage";
import { rankForXp, type OniProgressionProfile } from "@/lib/oni-progression";

export type SocialEventType =
  "rank_up" | "cosmetic_unlock" | "event_win" | "creator_approved" | "meet_attendance";
export type SocialEvent = {
  id: string;
  uid: string;
  nickname: string;
  type: SocialEventType;
  title: string;
  detail: string;
  targetUrl: string;
  createdAt: string | null;
  reactions: number;
};
export type PublicMemberProfile = {
  profile: OniProgressionProfile;
  rank: string;
  vehicles: Vehicle[];
  recent: SocialEvent[];
};
const n = (v: unknown) => Math.max(0, Number(v ?? 0));
const iso = (v: unknown) =>
  v && typeof v === "object" && "toDate" in v
    ? (v as { toDate: () => Date }).toDate().toISOString()
    : null;
function parseProfile(id: string, row: Record<string, unknown>): OniProgressionProfile {
  return {
    uid: id,
    nickname: String(row["nickname"] ?? "ONI"),
    xp: n(row["xp"]),
    coin: n(row["coin"]),
    lifetimeXp: n(row["lifetimeXp"]),
    seasonXp: n(row["seasonXp"]),
    prestige: n(row["prestige"]),
    meetCount: n(row["meetCount"]),
    creatorCount: n(row["creatorCount"]),
    eventCount: n(row["eventCount"]),
    unlocked: Array.isArray(row["unlocked"]) ? row["unlocked"].map(String) : [],
    equipped:
      row["equipped"] && typeof row["equipped"] === "object"
        ? (row["equipped"] as Record<string, string>)
        : {},
  };
}
function parseEvent(id: string, row: Record<string, unknown>): SocialEvent {
  return {
    id,
    uid: String(row["uid"] ?? ""),
    nickname: String(row["nickname"] ?? "ONI MEMBER"),
    type: String(row["type"] ?? "meet_attendance") as SocialEventType,
    title: String(row["title"] ?? "ONI ACTIVITY"),
    detail: String(row["detail"] ?? ""),
    targetUrl: String(row["targetUrl"] ?? "/crew"),
    createdAt: iso(row["createdAt"]),
    reactions: n(row["reactions"]),
  };
}
const activeSocialEvent = (event: SocialEvent) => event.type !== "cosmetic_unlock";

export async function fetchSocialFeed() {
  const snap = await getDocs(
    query(collection(firebaseDb, "socialEvents"), orderBy("createdAt", "desc"), limit(40)),
  );
  return snap.docs.map((x) => parseEvent(x.id, x.data())).filter(activeSocialEvent);
}
export async function fetchPublicMemberProfile(
  nickname: string,
): Promise<PublicMemberProfile | null> {
  const snap = await getDocs(
    query(
      collection(firebaseDb, "progressionProfiles"),
      where("nickname", "==", nickname),
      limit(1),
    ),
  );
  if (snap.empty) return null;
  const p = parseProfile(snap.docs[0]!.id, snap.docs[0]!.data());
  const [vehicles, recent] = await Promise.all([
    fetchVehicles(),
    getDocs(query(collection(firebaseDb, "socialEvents"), where("uid", "==", p.uid), limit(20))),
  ]);
  return {
    profile: p,
    rank: rankForXp(p.xp).name,
    vehicles:
      vehicles.status === "ok"
        ? vehicles.rows.filter(
            (v) =>
              v.ownerCallsign.toLocaleLowerCase("mn-MN") === nickname.toLocaleLowerCase("mn-MN"),
          )
        : [],
    recent: recent.docs
      .map((x) => parseEvent(x.id, x.data()))
      .filter(activeSocialEvent)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      .slice(0, 6),
  };
}
export async function reactToTarget(
  targetType: "feed" | "profile" | "gallery" | "garage",
  targetId: string,
  emoji: "🔥" | "🖤" | "⚡" | "👹",
) {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("auth_required");
  const account = await getDoc(doc(firebaseDb, "memberAccounts", user.uid));
  if (!account.exists() || account.data()["status"] !== "approved")
    throw new Error("member_required");
  const day = new Date().toISOString().slice(0, 10);
  const safeTarget = targetId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 100);
  const reactionId = `${user.uid}_${day}_${targetType}_${safeTarget}`;
  const counterId = `${user.uid}_${day}`;
  const reactionRef = doc(firebaseDb, "socialReactions", reactionId);
  const counterRef = doc(firebaseDb, "reactionDaily", counterId);
  const eventRef = targetType === "feed" ? doc(firebaseDb, "socialEvents", safeTarget) : null;
  await runTransaction(firebaseDb, async (tx) => {
    const [existing, counter, eventSnap] = await Promise.all([
      tx.get(reactionRef),
      tx.get(counterRef),
      eventRef ? tx.get(eventRef) : Promise.resolve(null),
    ]);
    if (existing.exists()) throw new Error("already_reacted");
    const count = counter.exists() ? n(counter.data()["count"]) : 0;
    if (count >= 8) throw new Error("daily_limit");
    tx.set(reactionRef, {
      uid: user.uid,
      targetType,
      targetId: safeTarget,
      emoji,
      day,
      createdAt: serverTimestamp(),
    });
    tx.set(counterRef, { uid: user.uid, day, count: count + 1, updatedAt: serverTimestamp() });
    if (eventRef && eventSnap?.exists())
      tx.update(eventRef, {
        reactions: n(eventSnap.data()["reactions"]) + 1,
        lastReactionId: reactionId,
        lastReactionKey: counterId,
        updatedAt: serverTimestamp(),
      });
  });
}
