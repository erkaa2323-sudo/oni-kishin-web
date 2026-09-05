/**
 * ONI MEET — live meet data boundary (Lovable Cloud).
 *
 * Room ID / password NEVER travel through this module. They live in the
 * isolated `meet_credentials` table which no public path can read.
 * Registration rules (deadline, capacity, duplicates) are enforced by the
 * database function `meet_register`, not only by this UI layer.
 */

import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
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

export type MeetLifecycle = "none" | "scheduled" | "open" | "closed" | "full" | "active" | "ended";

export type MeetSession = {
  id: string;
  title: string;
  scheduledAt: string | null;
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
  if (s.status === "live") return "active";
  const closes = s.registrationClosesAt
    ? new Date(s.registrationClosesAt).getTime()
    : s.scheduledAt
      ? new Date(s.scheduledAt).getTime()
      : null;
  if (closes !== null && closes <= now) return "closed";
  if (s.capacity !== null && s.registered >= s.capacity) return "full";
  return "open";
}

export function canRegister(life: MeetLifecycle): boolean {
  return life === "open";
}

export const LIFECYCLE_LABEL: Record<MeetLifecycle, string> = {
  none: "ИДЭВХТЭЙ УУЛЗАЛТ АЛГА",
  scheduled: "ТӨЛӨВЛӨГДСӨН",
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
    if (!snapshot.exists() || snapshot.data().enabled !== true)
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
        title: String(row.name || "ONI MEET"),
        scheduledAt: value(row.startAt),
        registrationClosesAt: null,
        capacity: typeof row.maxPlayers === "number" ? row.maxPlayers : 20,
        registered: participants.docs.filter((x) => x.id !== "__counter__").length,
        status: "live",
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
        const joined = row.joinedAt;
        return {
          cpmNickname: String(row.nick || row.name || "ONI MEMBER"),
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

/**
 * Legacy registration is intentionally fail-closed for now. Public meet data
 * can be read safely, but writes stay disabled until they can be routed through
 * an authenticated server boundary instead of exposing privileged credentials
 * in the browser.
 */
export async function registerForMeet(
  _meetId: string,
  _input: VerificationInput,
): Promise<RegistrationOutcome> {
  return "error";
}

/**
 * Credential reveal is intentionally NOT implemented for participants.
 * Registering with a CPM nickname/ID does not prove identity, so releasing
 * ROOM ID / PASSWORD would be unsafe. The gate stays closed until an
 * authenticated member identity exists.
 */
export const CREDENTIAL_GATE_NOTICE =
  "Өрөөний ID болон нууц үгийг зөвхөн баталгаажсан гишүүний нэвтрэлт бий болсны дараа нээнэ. Бүртгэл нь хувийн мэдээллийг баталгаажуулдаггүй тул одоогоор хаалттай байна.";
