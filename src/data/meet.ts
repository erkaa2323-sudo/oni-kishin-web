/**
 * ONI MEET — Firestore-backed meet data boundary.
 *
 * Room ID / password are kept in the protected `meetCredentials` collection.
 * Firestore Rules remain the authority for registration, capacity and access.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { fetchMemberAccount } from "@/data/member-auth";
import { firebaseAuth, firebaseDb } from "@/integrations/firebase/client";

export const CPM_ID_MAX = 40;
export const CPM_NICKNAME_MAX = 32;
export const MEET_REGISTRATION_GRACE_MS = 20 * 60 * 1000;

/**
 * Configurable launch target for Car Parking Multiplayer. No unofficial or
 * unverified deep-link scheme is invented, and credentials are NEVER put in
 * a URL. Falls back to the official store listing.
 */
export const CPM_LAUNCH_URL_ANDROID =
  "https://play.google.com/store/apps/details?id=com.olzhass.carparking.multyplayer";
/** Generic App Store search — no unverified app id is invented. */
export const CPM_LAUNCH_URL_IOS = "https://apps.apple.com/search?term=car%20parking%20multiplayer";
/** Default (non-mobile) target. */
export const CPM_LAUNCH_URL = CPM_LAUNCH_URL_ANDROID;
export const CPM_LAUNCH_FALLBACK_LABEL = "CAR PARKING MULTIPLAYER НЭЭХ";

/** Platform-safe store target; iOS users are never sent to Google Play. */
export function cpmLaunchUrl(userAgent?: string): string {
  const ua =
    (userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "")) || "";
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);
  return isIOS ? CPM_LAUNCH_URL_IOS : CPM_LAUNCH_URL_ANDROID;
}

export type MeetLifecycle =
  | "none"
  | "scheduled"
  | "starting_soon"
  | "open"
  | "closed"
  | "full"
  | "active"
  | "ended";

export type MeetSession = {
  id: string;
  title: string;
  scheduledAt: string | null;
  endsAt: string | null;
  registrationClosesAt: string | null;
  capacity: number | null;
  registered: number;
  status: "scheduled" | "live";
};

export type MeetParticipant = {
  cpmNickname: string;
  registeredAt: string;
};

export type MeetCredentials = { roomId: string; password: string };

export type MeetLoad =
  | { status: "ok"; session: MeetSession | null }
  | { status: "error"; reason: string };

export type VerificationInput = {
  cpmNickname: string;
  cpmId: string;
};

export type MeetFieldErrors = Partial<Record<keyof VerificationInput, string>>;

export type RegistrationOutcome =
  | "registered"
  | "duplicate"
  | "meet_full"
  | "registration_closed"
  | "no_active_meet"
  | "invalid"
  | "error";

export function validateVerification(v: VerificationInput): MeetFieldErrors {
  const e: MeetFieldErrors = {};
  const nick = v.cpmNickname.trim();
  const id = v.cpmId.trim();
  if (!nick) e.cpmNickname = "CPM NICKNAME заавал шаардлагатай.";
  else if (nick.length < 2) e.cpmNickname = "Хамгийн багадаа 2 тэмдэгт.";
  else if (nick.length > CPM_NICKNAME_MAX)
    e.cpmNickname = `Дээд тал нь ${CPM_NICKNAME_MAX} тэмдэгт.`;
  if (!id) e.cpmId = "CPM ID заавал шаардлагатай.";
  else if (id.length > CPM_ID_MAX) e.cpmId = `Дээд тал нь ${CPM_ID_MAX} тэмдэгт.`;
  return e;
}

function timestampMs(value: unknown): number | null {
  if (typeof value === "string" || typeof value === "number") {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
  }
  if (value && typeof value === "object") {
    if (
      "toMillis" in value &&
      typeof (value as { toMillis?: unknown }).toMillis === "function"
    )
      return (value as { toMillis: () => number }).toMillis();
    if (
      "toDate" in value &&
      typeof (value as { toDate?: unknown }).toDate === "function"
    )
      return (value as { toDate: () => Date }).toDate().getTime();
  }
  return null;
}

function sameMeetStart(left: unknown, right: unknown): boolean {
  const a = timestampMs(left);
  const b = timestampMs(right);
  return a !== null && b !== null && a === b;
}

function effectiveRegistrationCloseMs(s: MeetSession): number | null {
  if (s.registrationClosesAt) return new Date(s.registrationClosesAt).getTime();
  if (!s.scheduledAt) return null;
  return new Date(s.scheduledAt).getTime() + MEET_REGISTRATION_GRACE_MS;
}

/** Derived, refresh-consistent lifecycle from status + timestamps + capacity. */
export function deriveLifecycle(s: MeetSession | null, now = Date.now()): MeetLifecycle {
  if (!s) return "none";
  const starts = s.scheduledAt ? new Date(s.scheduledAt).getTime() : null;
  const ends = s.endsAt ? new Date(s.endsAt).getTime() : null;
  if (ends !== null && ends <= now) return "ended";
  const closes = effectiveRegistrationCloseMs(s);
  if (closes !== null && closes <= now) return "closed";
  if (s.capacity !== null && s.registered >= s.capacity) return "full";
  // A mistakenly/early marked LIVE record must never make a future meet look active.
  if (starts !== null && starts > now) {
    if (starts - now <= MEET_REGISTRATION_GRACE_MS) return "starting_soon";
    return "scheduled";
  }
  if (s.status === "live" || (starts !== null && starts <= now)) return "active";
  return starts !== null ? "scheduled" : "open";
}

export function canRegister(life: MeetLifecycle): boolean {
  return (
    life === "open" ||
    life === "scheduled" ||
    life === "starting_soon" ||
    life === "active"
  );
}

export const LIFECYCLE_LABEL: Record<MeetLifecycle, string> = {
  none: "ИДЭВХТЭЙ УУЛЗАЛТ АЛГА",
  scheduled: "ТӨЛӨВЛӨГДСӨН",
  starting_soon: "УДАХГҮЙ ЭХЭЛНЭ",
  open: "БҮРТГЭЛ НЭЭЛТТЭЙ",
  closed: "БҮРТГЭЛ ХААГДСАН",
  full: "БАГТААМЖ ДҮҮРСЭН",
  active: "УУЛЗАЛТ ЯВАГДАЖ БАЙНА",
  ended: "ДУУССАН",
};

export const REGISTRATION_MESSAGE: Record<RegistrationOutcome, string> = {
  registered: "Бүртгэл амжилттай. Таны нэр оролцогчдын жагсаалтад нэмэгдлээ.",
  duplicate: "Энэ CPM ID аль хэдийн бүртгэгдсэн байна.",
  meet_full: "Уулзалтын багтаамж дүүрсэн байна.",
  registration_closed: "Бүртгэлийн хугацаа дууссан байна.",
  no_active_meet: "Одоогоор идэвхтэй уулзалт байхгүй байна.",
  invalid: "Оруулсан мэдээлэл буруу байна.",
  error: "Бүртгэл хийх үед алдаа гарлаа. Дахин оролдоно уу.",
};

function snapshotCredentials(
  data: Record<string, unknown> | undefined,
): MeetCredentials | null {
  if (!data) return null;
  const roomId = String(data["roomId"] ?? "").trim();
  const password = String(data["password"] ?? "").trim();
  return roomId && password ? { roomId, password } : null;
}

/** Current publicly visible meet. Returns null when none is announced. */
export async function fetchActiveMeet(): Promise<MeetLoad> {
  try {
    const snapshot = await getDoc(doc(firebaseDb, "meets", "current"));
    if (!snapshot.exists() || snapshot.data()["enabled"] !== true)
      return { status: "ok", session: null };
    const row = snapshot.data();
    const participants = await getDocs(
      query(collection(firebaseDb, "meetRoster"), where("meetId", "==", "current")),
    );
    const value = (v: unknown): string | null => {
      if (typeof v === "string") return v;
      if (typeof v === "number") return new Date(v).toISOString();
      if (v && typeof v === "object" && "toDate" in v)
        return (v as { toDate: () => Date }).toDate().toISOString();
      return null;
    };
    const scheduledAt = value(row["startAt"]);
    const explicitClose = value(row["registrationClosesAt"]);
    const registrationClosesAt =
      explicitClose ??
      (scheduledAt
        ? new Date(new Date(scheduledAt).getTime() + MEET_REGISTRATION_GRACE_MS).toISOString()
        : null);
    const registered = participants.docs.filter(
      (entry) =>
        entry.id !== "__counter__" &&
        sameMeetStart(entry.data()["meetStartAt"], row["startAt"]),
    ).length;
    return {
      status: "ok",
      session: {
        id: "current",
        title: String(row["title"] || row["name"] || "ONI MEET"),
        scheduledAt,
        endsAt: value(row["endsAt"]),
        registrationClosesAt,
        capacity: typeof row["maxPlayers"] === "number" ? row["maxPlayers"] : 20,
        // Only the current start timestamp belongs to this Meet. Stale rows from
        // a previous `current` session are deliberately ignored.
        registered,
        status: row["status"] === "live" ? "live" : "scheduled",
      },
    };
  } catch {
    return { status: "error", reason: "Сүлжээний алдаа гарлаа." };
  }
}

/** Safe public participant list — nicknames only, no CPM ID, no credentials. */
export async function fetchParticipants(meetId: string): Promise<MeetParticipant[]> {
  try {
    const [meetSnapshot, snapshot] = await Promise.all([
      getDoc(doc(firebaseDb, "meets", "current")),
      getDocs(query(collection(firebaseDb, "meetRoster"), where("meetId", "==", meetId))),
    ]);
    if (!meetSnapshot.exists()) return [];
    const meetStartAt = meetSnapshot.data()["startAt"];
    return snapshot.docs
      .filter(
        (entry) =>
          entry.id !== "__counter__" && sameMeetStart(entry.data()["meetStartAt"], meetStartAt),
      )
      .map((entry) => {
        const row = entry.data();
        const joined = row["joinedAt"];
        return {
          cpmNickname: String(
            row["nickname"] || row["nick"] || row["name"] || "ONI MEMBER",
          ),
          registeredAt:
            joined && typeof joined.toDate === "function"
              ? joined.toDate().toISOString()
              : new Date().toISOString(),
        };
      });
  } catch {
    return [];
  }
}

/** Restore the signed-in rider's current Meet registration after refresh/reopen. */
export async function fetchCurrentMeetRegistration(meetId: string): Promise<boolean> {
  const user = firebaseAuth.currentUser;
  if (!user || meetId !== "current") return false;
  try {
    const [meetSnapshot, participantSnapshot] = await Promise.all([
      getDoc(doc(firebaseDb, "meets", "current")),
      getDoc(doc(firebaseDb, "meetParticipants", user.uid)),
    ]);
    return (
      meetSnapshot.exists() &&
      participantSnapshot.exists() &&
      participantSnapshot.data()["meetId"] === meetId &&
      sameMeetStart(participantSnapshot.data()["meetStartAt"], meetSnapshot.data()["startAt"])
    );
  } catch {
    return false;
  }
}

export async function registerForMeet(
  meetId: string,
  input: VerificationInput,
): Promise<RegistrationOutcome> {
  const errors = validateVerification(input);
  if (Object.keys(errors).length || meetId !== "current") return "invalid";

  const nick = input.cpmNickname.trim();
  const cpmId = input.cpmId.trim();
  const user = firebaseAuth.currentUser;
  if (!user) return "invalid";
  const account = await fetchMemberAccount(user.uid).catch(() => null);
  if (
    !account ||
    account.status !== "approved" ||
    account.nickname.toLocaleLowerCase("mn-MN") !== nick.toLocaleLowerCase("mn-MN") ||
    account.cpmId !== cpmId
  )
    return "invalid";
  const member = await getDoc(doc(firebaseDb, "members", account.memberId)).catch(() => null);
  if (!member?.exists()) return "invalid";
  const memberData = member.data();
  if (memberData["status"] === "inactive" || memberData["status"] === "archived")
    return "invalid";
  const canonicalNick = String(
    memberData["nick"] || memberData["nickname"] || memberData["name"] || nick,
  ).trim();
  const canonicalCpmId = String(
    memberData["cpmid"] || memberData["cpmId"] || cpmId,
  ).trim();

  const participantId = user.uid;
  const meetRef = doc(firebaseDb, "meets", "current");
  const participantRef = doc(firebaseDb, "meetParticipants", participantId);
  const rosterRef = doc(firebaseDb, "meetRoster", participantId);
  try {
    return await runTransaction(firebaseDb, async (tx) => {
      const slotRefs = Array.from({ length: 20 }, (_, index) =>
        doc(firebaseDb, "meetSlots", `current_${String(index + 1).padStart(2, "0")}`),
      );
      const [meetSnapshot, participantSnapshot, ...slotSnapshots] = await Promise.all([
        tx.get(meetRef),
        tx.get(participantRef),
        ...slotRefs.map((slotRef) => tx.get(slotRef)),
      ]);
      if (!meetSnapshot.exists() || meetSnapshot.data()["enabled"] !== true)
        return "no_active_meet" as const;

      const meet = meetSnapshot.data();
      if (
        participantSnapshot.exists() &&
        sameMeetStart(participantSnapshot.data()["meetStartAt"], meet["startAt"])
      )
        return "duplicate" as const;

      const now = Date.now();
      const startAt = timestampMs(meet["startAt"]);
      if (startAt === null) return "invalid" as const;
      const explicitClose = timestampMs(meet["registrationClosesAt"]);
      const closesAt = explicitClose ?? startAt + MEET_REGISTRATION_GRACE_MS;
      if (meet["status"] === "closed" || meet["status"] === "ended" || closesAt <= now)
        return "registration_closed" as const;

      const capacity = Math.min(20, Math.max(1, Number(meet["maxPlayers"] ?? 20)));
      const slotIndex = slotSnapshots
        .slice(0, capacity)
        .findIndex(
          (slot) =>
            !slot.exists() || !sameMeetStart(slot.data()["meetStartAt"], meet["startAt"]),
        );
      if (slotIndex < 0) return "meet_full" as const;
      const slotRef = slotRefs[slotIndex]!;

      tx.set(participantRef, {
        meetId: "current",
        meetStartAt: meet["startAt"],
        memberId: member.id,
        nick: canonicalNick,
        name: canonicalNick,
        cpmId: canonicalCpmId,
        joinedAt: serverTimestamp(),
        source: "website",
        slotId: slotRef.id,
      });
      tx.set(slotRef, {
        meetId: "current",
        meetStartAt: meet["startAt"],
        participantId,
        memberId: member.id,
        createdAt: serverTimestamp(),
      });
      tx.set(rosterRef, {
        meetId: "current",
        meetStartAt: meet["startAt"],
        nickname: canonicalNick,
        joinedAt: serverTimestamp(),
      });
      return "registered" as const;
    });
  } catch {
    return "error";
  }
}

export async function fetchMeetCredentialsForMember(
  meetId: string,
): Promise<MeetCredentials | null> {
  const user = firebaseAuth.currentUser;
  if (!user || meetId !== "current") return null;
  try {
    const snapshot = await getDoc(doc(firebaseDb, "meetCredentials", meetId));
    return snapshot.exists() ? snapshotCredentials(snapshot.data()) : null;
  } catch {
    return null;
  }
}

/**
 * Realtime room access. Call only once the lifecycle is `active`; Firestore
 * Rules intentionally reject credential reads before the Meet start time.
 */
export function subscribeMeetCredentialsForMember(
  meetId: string,
  onChange: (credentials: MeetCredentials | null) => void,
): Unsubscribe {
  const user = firebaseAuth.currentUser;
  if (!user || meetId !== "current") {
    onChange(null);
    return () => undefined;
  }

  return onSnapshot(
    doc(firebaseDb, "meetCredentials", meetId),
    (snapshot) => onChange(snapshot.exists() ? snapshotCredentials(snapshot.data()) : null),
    () => onChange(null),
  );
}

export const CREDENTIAL_GATE_NOTICE =
  "Өрөөний ID болон нууц үг зөвхөн Admin-аар баталгаажсан, тухайн Meet-д бүртгүүлсэн Crew аккаунтад нээгдэнэ.";
