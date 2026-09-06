/**
 * ONI MEET — live meet data boundary (Lovable Cloud).
 *
 * Room ID / password NEVER travel through this module. They live in the
 * isolated `meet_credentials` table which no public path can read.
 * Registration rules (deadline, capacity, duplicates) are enforced by the
 * database function `meet_register`, not only by this UI layer.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { firebaseDb } from "@/integrations/firebase/client";

export const CPM_ID_MAX = 40;
export const CPM_NICKNAME_MAX = 32;

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
  const ua = (userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "")) || "";
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);
  return isIOS ? CPM_LAUNCH_URL_IOS : CPM_LAUNCH_URL_ANDROID;
}

export type MeetLifecycle =
  "none" | "scheduled" | "starting_soon" | "open" | "closed" | "full" | "active" | "ended";

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

export type MeetLoad =
  { status: "ok"; session: MeetSession | null } | { status: "error"; reason: string };

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

/** Derived, refresh-consistent lifecycle from status + timestamps + capacity. */
export function deriveLifecycle(s: MeetSession | null, now = Date.now()): MeetLifecycle {
  if (!s) return "none";
  const starts = s.scheduledAt ? new Date(s.scheduledAt).getTime() : null;
  const ends = s.endsAt ? new Date(s.endsAt).getTime() : null;
  if (ends !== null && ends <= now) return "ended";
  const closes = s.registrationClosesAt
    ? new Date(s.registrationClosesAt).getTime()
    : s.scheduledAt
      ? new Date(s.scheduledAt).getTime()
      : null;
  if (closes !== null && closes <= now) return "closed";
  if (s.capacity !== null && s.registered >= s.capacity) return "full";
  // A mistakenly/early marked LIVE record must never make a future meet look active.
  if (starts !== null && starts > now) {
    if (starts - now <= 20 * 60 * 1000) return "starting_soon";
    return "scheduled";
  }
  if (s.status === "live" || (starts !== null && starts <= now)) return "active";
  if (starts !== null && starts - now <= 20 * 60 * 1000) return "starting_soon";
  return starts !== null ? "scheduled" : "open";
}

export function canRegister(life: MeetLifecycle): boolean {
  return life === "open" || life === "scheduled" || life === "starting_soon";
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

/** Current publicly visible meet. Returns null when none is announced. */
export async function fetchActiveMeet(): Promise<MeetLoad> {
  try {
    const snapshot = await getDoc(doc(firebaseDb, "meets", "current"));
    if (!snapshot.exists() || snapshot.data()["enabled"] !== true)
      return { status: "ok", session: null };
    const row = snapshot.data();
    const participants = await getDocs(
      query(collection(firebaseDb, "meetParticipants"), where("meetId", "==", "current")),
    );
    const value = (v: unknown): string | null => {
      if (typeof v === "string") return v;
      if (typeof v === "number") return new Date(v).toISOString();
      if (v && typeof v === "object" && "toDate" in v)
        return (v as { toDate: () => Date }).toDate().toISOString();
      return null;
    };
    return {
      status: "ok",
      session: {
        id: "current",
        title: String(row["name"] || "ONI MEET"),
        scheduledAt: value(row["startAt"]),
        endsAt: value(row["endsAt"]),
        registrationClosesAt: value(row["registrationClosesAt"]),
        capacity: typeof row["maxPlayers"] === "number" ? row["maxPlayers"] : 20,
        registered:
          typeof row["registeredCount"] === "number"
            ? row["registeredCount"]
            : participants.docs.filter((x) => x.id !== "__counter__").length,
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
    const snapshot = await getDocs(
      query(collection(firebaseDb, "meetParticipants"), where("meetId", "==", meetId)),
    );
    return snapshot.docs
      .filter((x) => x.id !== "__counter__")
      .map((x) => {
        const row = x.data();
        const joined = row["joinedAt"];
        return {
          cpmNickname: String(row["nick"] || row["name"] || "ONI MEMBER"),
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

export async function registerForMeet(
  meetId: string,
  input: VerificationInput,
): Promise<RegistrationOutcome> {
  const errors = validateVerification(input);
  if (Object.keys(errors).length || meetId !== "current") return "invalid";

  const nick = input.cpmNickname.trim();
  const cpmId = input.cpmId.trim();
  const memberQueries = await Promise.all([
    getDocs(query(collection(firebaseDb, "members"), where("cpmid", "==", cpmId), limit(2))),
    getDocs(query(collection(firebaseDb, "members"), where("cpmId", "==", cpmId), limit(2))),
  ]).catch(() => null);
  if (!memberQueries) return "error";
  const candidates = memberQueries.flatMap((snapshot) => snapshot.docs);
  const normalizedNick = nick.toLocaleLowerCase("mn-MN");
  const member = candidates.find((entry) => {
    const row = entry.data();
    const storedNick = String(row["nick"] || row["nickname"] || row["name"] || "")
      .trim()
      .toLocaleLowerCase("mn-MN");
    return storedNick === normalizedNick && row["status"] !== "inactive" && row["status"] !== "archived";
  });
  if (!member) return "invalid";
  const memberData = member.data();
  const canonicalNick = String(
    memberData["nick"] || memberData["nickname"] || memberData["name"] || nick,
  ).trim();
  const canonicalCpmId = String(memberData["cpmid"] || memberData["cpmId"] || cpmId).trim();

  const participantId = encodeURIComponent(cpmId.toLocaleLowerCase("en-US")).slice(0, 120);
  const meetRef = doc(firebaseDb, "meets", "current");
  const participantRef = doc(firebaseDb, "meetParticipants", participantId);
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
      if (participantSnapshot.exists()) return "duplicate" as const;

      const meet = meetSnapshot.data();
      const valueMs = (value: unknown): number | null => {
        if (typeof value === "string" || typeof value === "number") {
          const time = new Date(value).getTime();
          return Number.isNaN(time) ? null : time;
        }
        if (value && typeof value === "object" && "toDate" in value)
          return (value as { toDate: () => Date }).toDate().getTime();
        return null;
      };
      const now = Date.now();
      const closesAt = valueMs(meet["registrationClosesAt"] ?? meet["startAt"]);
      if (
        meet["status"] === "closed" ||
        meet["status"] === "ended" ||
        (closesAt && closesAt <= now)
      )
        return "registration_closed" as const;

      const capacity = Math.min(20, Math.max(1, Number(meet["maxPlayers"] ?? 20)));
      const slotIndex = slotSnapshots.slice(0, capacity).findIndex((slot) => !slot.exists());
      if (slotIndex < 0) return "meet_full" as const;
      const slotRef = slotRefs[slotIndex]!;

      tx.set(participantRef, {
        meetId: "current",
        meetStartAt: meet["startAt"] ?? null,
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
        participantId,
        memberId: member.id,
        createdAt: serverTimestamp(),
      });
      return "registered" as const;
    });
  } catch {
    return "error";
  }
}

/**
 * Credential reveal is intentionally NOT implemented for participants.
 * Registering with a CPM nickname/ID does not prove identity, so releasing
 * ROOM ID / PASSWORD would be unsafe. The gate stays closed until an
 * authenticated member identity exists.
 */
export const CREDENTIAL_GATE_NOTICE =
  "Өрөөний ID болон нууц үгийг зөвхөн баталгаажсан гишүүний нэвтрэлт бий болсны дараа нээнэ. Бүртгэл нь хувийн мэдээллийг баталгаажуулдаггүй тул одоогоор хаалттай байна.";
