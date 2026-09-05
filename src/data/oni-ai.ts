/**
 * ONI AI + MUSIC data boundary.
 *
 * Music metadata is read live from the published `music_tracks` rows in
 * Lovable Cloud. Nothing is fabricated: an empty table renders an empty
 * playlist. The ONI Brain reply below is an explicit offline shell.
 */

export type OniTrack = {
  id: string;
  /** Display title (Mongolian primary) */
  title: string;
  /** Decorative english/latin subtitle */
  subtitle: string;
  /** Performer as stored on the record */
  artist: string;
  /** Duration in seconds (0 = unknown) */
  duration: number;
  /** Optional audio URL. When absent the player runs in preview mode. */
  src?: string;
  tag: string;
};

/** Placeholder shown only when the live playlist is empty — never played. */
export const EMPTY_TRACK: OniTrack = {
  id: "none",
  title: "ТРЭК АЛГА",
  subtitle: "NO TRACKS",
  artist: "—",
  duration: 0,
  tag: "EMPTY",
};

export type TrackLoad = { status: "ok"; rows: OniTrack[] } | { status: "error"; reason: string };

/** Live playlist from the published `music_tracks` metadata. */
export async function fetchTracks(): Promise<TrackLoad> {
  const { musicService } = await import("@/services/domains");
  const res = await musicService.listPublished();
  if (!res.ok) return { status: "error", reason: res.error.message };
  return {
    status: "ok",
    rows: res.data.map((t) => ({
      id: t.id,
      title: t.title,
      subtitle: t.artist ?? "",
      artist: t.artist ?? "—",
      duration: t.durationSeconds ?? 0,
      ...(t.sourceUrl ? { src: t.sourceUrl } : {}),
      tag: "ONI",
    })),
  };
}

/** Quick prompts offered by the ONI Brain assistant shell. */
export const ONI_SUGGESTIONS: string[] = [
  "Кланы тухай товч танилцуул",
  "Гаражийн машинуудыг жагсаа",
  "Элсэлтийн шаардлага юу вэ?",
  "Дараагийн уулзалт хэзээ бэ?",
];

export type OniMessage = {
  id: string;
  role: "user" | "oni";
  text: string;
};

/**
 * ONI AI has NO service, query or tool path to `meet_credentials`, and it
 * refuses credential requests outright before any other handling.
 */
const CREDENTIAL_PATTERN =
  /(pass\s*word|пасс|нууц\s*үг|password|pass\s*хэд|room\s*id|өрөө.*(id|код)|(id|код).*өрөө)/i;

export const CREDENTIAL_REFUSAL =
  "Уулзалтын ROOM ID болон нууц үгийг би хэзээ ч дамжуулахгүй. Эдгээр нь хамгаалагдсан бөгөөд зөвхөн УУЛЗАЛТ хэсгийн хамгаалалттай хандалтаар нээгдэнэ.";

/** Defense-in-depth credential guard, shared with the ONI Brain router. */
export function isCredentialRequest(input: string): boolean {
  return CREDENTIAL_PATTERN.test(input);
}

/** Fallback reply used only if the brain router fails. */
export function draftOniReply(input: string): string {
  const q = input.trim();
  if (!q) return "Асуултаа бичнэ үү.";
  if (CREDENTIAL_PATTERN.test(q)) return CREDENTIAL_REFUSAL;
  return `ONI BRAIN холболт хараахан идэвхжээгүй байна. Таны асуулт бүртгэгдлээ: «${q}». Backend холбогдмогц бодит хариу энд гарна.`;
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
