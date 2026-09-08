import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "@/integrations/firebase/client";

const ADMIN_EMAIL = "erkaa130@gmail.com";
const n = (value: unknown) => Math.max(0, Number(value ?? 0));
const toIso = (value: unknown) => value && typeof value === "object" && "toDate" in value
  ? (value as { toDate: () => Date }).toDate().toISOString()
  : null;
const millis = (value: unknown) => value && typeof value === "object" && "toMillis" in value
  ? Number((value as { toMillis: () => number }).toMillis())
  : 0;

function requireAdmin() {
  const user = firebaseAuth.currentUser;
  if (!user || user.email?.trim().toLowerCase() !== ADMIN_EMAIL) throw new Error("admin_required");
  return user;
}

export type AttendanceCandidate = {
  uid: string;
  nickname: string;
  meetStartAt: string | null;
  confirmed: boolean;
};

export type EconomyWeekConfig = {
  weekId: string;
  startsAt: string | null;
  endsAt: string | null;
  enabled: boolean;
};

export type EconomySeasonConfig = {
  seasonId: string;
  startsAt: string | null;
  endsAt: string | null;
  enabled: boolean;
};

export async function listCurrentMeetAttendanceCandidates(): Promise<AttendanceCandidate[]> {
  requireAdmin();
  const [meetSnap, participantSnap, attendanceSnap] = await Promise.all([
    getDoc(doc(firebaseDb, "meets", "current")),
    getDocs(collection(firebaseDb, "meetParticipants")),
    getDocs(collection(firebaseDb, "meetAttendance")),
  ]);
  if (!meetSnap.exists()) return [];
  const currentStart = millis(meetSnap.data()["startAt"]);
  const confirmed = new Map(attendanceSnap.docs.map((row) => [row.id, millis(row.data()["meetStartAt"])]));
  return participantSnap.docs
    .filter((row) => !currentStart || millis(row.data()["meetStartAt"]) === currentStart)
    .map((row) => ({
      uid: row.id,
      nickname: String(row.data()["nick"] ?? row.data()["name"] ?? "ONI MEMBER"),
      meetStartAt: toIso(row.data()["meetStartAt"]),
      confirmed: !!currentStart && confirmed.get(row.id) === currentStart,
    }))
    .sort((a, b) => a.nickname.localeCompare(b.nickname, "mn"));
}

export async function confirmCurrentMeetAttendance(uid: string) {
  const admin = requireAdmin();
  const [meetSnap, participantSnap] = await Promise.all([
    getDoc(doc(firebaseDb, "meets", "current")),
    getDoc(doc(firebaseDb, "meetParticipants", uid)),
  ]);
  if (!meetSnap.exists() || !participantSnap.exists()) throw new Error("participant_not_found");
  const start = meetSnap.data()["startAt"];
  if (!start || millis(participantSnap.data()["meetStartAt"]) !== millis(start)) throw new Error("meet_mismatch");
  await setDoc(doc(firebaseDb, "meetAttendance", uid), {
    uid,
    meetId: "current",
    meetStartAt: start,
    confirmedAt: serverTimestamp(),
    confirmedBy: admin.uid,
  });
}

export async function revokeCurrentMeetAttendance(uid: string) {
  requireAdmin();
  await deleteDoc(doc(firebaseDb, "meetAttendance", uid));
}

export async function getEconomyWeekConfig(): Promise<EconomyWeekConfig | null> {
  requireAdmin();
  const snap = await getDoc(doc(firebaseDb, "progressionMissions", "currentWeek"));
  if (!snap.exists()) return null;
  const row = snap.data();
  return { weekId: String(row["weekId"] ?? ""), startsAt: toIso(row["startsAt"]), endsAt: toIso(row["endsAt"]), enabled: row["enabled"] === true };
}

export async function configureEconomyWeek(input: { weekId: string; startsAt: Date; endsAt: Date; enabled: boolean }) {
  const admin = requireAdmin();
  const weekId = input.weekId.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
  if (!weekId || input.endsAt.getTime() <= input.startsAt.getTime()) throw new Error("invalid_week");
  await setDoc(doc(firebaseDb, "progressionMissions", "currentWeek"), {
    weekId,
    startsAt: Timestamp.fromDate(input.startsAt),
    endsAt: Timestamp.fromDate(input.endsAt),
    enabled: input.enabled,
    updatedAt: serverTimestamp(),
    updatedBy: admin.uid,
  });
}

export async function getEconomySeasonConfig(): Promise<EconomySeasonConfig | null> {
  requireAdmin();
  const snap = await getDoc(doc(firebaseDb, "progressionMissions", "currentSeason"));
  if (!snap.exists()) return null;
  const row = snap.data();
  return { seasonId: String(row["seasonId"] ?? ""), startsAt: toIso(row["startsAt"]), endsAt: toIso(row["endsAt"]), enabled: row["enabled"] === true };
}

export async function startNewEconomySeason(input: { seasonId: string; startsAt: Date; endsAt: Date }) {
  const admin = requireAdmin();
  const seasonId = input.seasonId.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
  if (!seasonId || input.endsAt.getTime() <= input.startsAt.getTime()) throw new Error("invalid_season");
  const [profiles, currentSeason] = await Promise.all([
    getDocs(collection(firebaseDb, "progressionProfiles")),
    getDoc(doc(firebaseDb, "progressionMissions", "currentSeason")),
  ]);
  if (profiles.size > 200) throw new Error("season_batch_too_large");
  const previousSeasonId = currentSeason.exists() ? String(currentSeason.data()["seasonId"] ?? "unassigned") : "unassigned";
  const batch = writeBatch(firebaseDb);
  for (const profile of profiles.docs) {
    const row = profile.data();
    batch.set(doc(firebaseDb, "progressionSeasonArchive", `${previousSeasonId}_${profile.id}`), {
      seasonId: previousSeasonId,
      uid: profile.id,
      nickname: String(row["nickname"] ?? "ONI"),
      seasonXp: n(row["seasonXp"]),
      lifetimeXp: n(row["lifetimeXp"] ?? row["xp"]),
      rankXp: n(row["xp"]),
      prestige: n(row["prestige"]),
      archivedAt: serverTimestamp(),
      archivedBy: admin.uid,
    });
    batch.update(profile.ref, { seasonXp: 0, updatedAt: serverTimestamp() });
  }
  batch.set(doc(firebaseDb, "progressionMissions", "currentSeason"), {
    seasonId,
    startsAt: Timestamp.fromDate(input.startsAt),
    endsAt: Timestamp.fromDate(input.endsAt),
    enabled: true,
    startedAt: serverTimestamp(),
    startedBy: admin.uid,
  });
  await batch.commit();
}

export async function adjustMemberCoin(input: { uid: string; amount: number; reason: string }) {
  const admin = requireAdmin();
  const amount = Math.trunc(input.amount);
  const reason = input.reason.trim().slice(0, 160);
  if (!input.uid || !amount || !reason || Math.abs(amount) > 10000) throw new Error("invalid_adjustment");
  const profileRef = doc(firebaseDb, "progressionProfiles", input.uid);
  return runTransaction(firebaseDb, async (tx) => {
    const profile = await tx.get(profileRef);
    if (!profile.exists()) throw new Error("profile_not_found");
    const current = n(profile.data()["coin"]);
    const balanceAfter = current + amount;
    if (balanceAfter < 0) throw new Error("negative_balance");
    const nonce = crypto.randomUUID().replace(/-/g, "");
    tx.update(profileRef, { coin: balanceAfter, updatedAt: serverTimestamp() });
    tx.set(doc(firebaseDb, "progressionLedger", `admin_${input.uid}_${nonce}`), {
      uid: input.uid,
      sourceType: "admin_adjustment",
      sourceKey: nonce,
      xp: 0,
      coin: amount,
      balanceAfter,
      reason,
      awardedBy: admin.uid,
      createdAt: serverTimestamp(),
    });
    return { balanceAfter };
  });
}
