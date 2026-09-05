/**
 * CREW roster data boundary.
 *
 * Live source: the `members` table in Lovable Cloud, read through the public
 * projection allowed by row-level security (active members only, safe columns
 * only). Nothing here fabricates members or clan statistics — an empty table
 * renders as a real empty state.
 *
 * The portrait images below are DECORATIVE ARTWORK ONLY. Command portraits
 * are assigned by public role/name and are never treated as
 * member data, identity or a database record.
 */

import crew01 from "@/assets/crew/crew-01.webp";
import crew02 from "@/assets/crew/crew-02.webp";
import crew03 from "@/assets/crew/crew-03.webp";
import crew04 from "@/assets/crew/crew-04.webp";

/** Role/category buckets used by the roster filters. */
export type CrewRoleId = "command" | "driver" | "mechanic" | "media";

export type CrewRole = {
  id: CrewRoleId;
  /** Mongolian label (primary UI language) */
  label: string;
  /** Decorative game-world code */
  code: string;
};

export const CREW_ROLES: CrewRole[] = [
  { id: "command", label: "УДИРДАХ", code: "COMMAND" },
  { id: "driver", label: "ЖОЛООЧ", code: "DRIVER" },
  { id: "mechanic", label: "МЕХАНИК", code: "MECHANIC" },
  { id: "media", label: "МЕДИА", code: "MEDIA" },
];

/** Mongolian labels admins pick from when assigning a member role. */
export const CREW_ROLE_TITLE: Record<CrewRoleId, string> = {
  command: "Удирдлага",
  driver: "Жолооч",
  mechanic: "Механик",
  media: "Медиа",
};

export type CrewStatus = "active" | "standby" | "field";

export const CREW_STATUS_LABEL: Record<CrewStatus, string> = {
  active: "ИДЭВХТЭЙ",
  standby: "БЭЛЭН",
  field: "ГАДНА",
};

export type CrewMember = {
  /** Database row id */
  id: string;
  /** Callsign / handle shown as the primary identity */
  callsign: string;
  kana?: string;
  roleId: CrewRoleId;
  /** Short Mongolian role title */
  title: string;
  status: CrewStatus;
  /** Decorative portrait artwork (not member data). */
  portrait?: string;
  bio: string;
  /** Small labelled traits shown in the HUD block */
  traits: { label: string; value: string }[];
};

function portraitFor(callsign: string, role: string | undefined, index: number): string {
  const identity = `${callsign} ${role ?? ""}`.toLowerCase();
  if (identity.includes("kitsune") || /(^|\s)leader($|\s)/.test(identity)) return crew01;
  if (identity.includes("hugo") || identity.includes("co-leader")) return crew02;
  return index % 2 === 0 ? crew03 : crew04;
}

export function parseCrewRole(value: string | undefined | null): CrewRoleId {
  const v = (value ?? "").toLowerCase();
  // Leadership (incl. Leader / Co-Leader / Deputy) → COMMAND
  if (
    v.includes("leader") ||
    v.includes("command") ||
    v.includes("captain") ||
    v.includes("owner") ||
    v.includes("удирд") ||
    v.includes("ахлагч") ||
    v.includes("тэргүүн") ||
    v.includes("дэд")
  )
    return "command";
  if (v.includes("mechanic") || v.includes("tuner") || v.includes("механ")) return "mechanic";
  if (v.includes("media") || v.includes("content") || v.includes("editor") || v.includes("медиа"))
    return "media";
  // Special Member / Member / anything else → DRIVER bucket
  return "driver";
}

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export type CrewLoad = { status: "ok"; rows: CrewMember[] } | { status: "error"; reason: string };

/** Live roster read. Only records RLS exposes publicly are returned. */
export async function fetchCrew(): Promise<CrewLoad> {
  const { membersService } = await import("@/services/domains");
  const res = await membersService.listPublic();
  if (!res.ok) return { status: "error", reason: res.error.message };

  const rows: CrewMember[] = res.data.map((m, i) => {
    const roleId = parseCrewRole(m.role);
    const joined = formatDate(m.joinedAt);
    const traits: { label: string; value: string }[] = [
      { label: "CPM ID", value: m.cpmId || "—" },
      { label: "ҮҮРЭГ", value: m.role || CREW_ROLE_TITLE[roleId] },
    ];
    if (joined) traits.push({ label: "ЭЛССЭН", value: joined });

    return {
      id: m.id,
      callsign: m.cpmNickname,
      roleId,
      title: m.role || CREW_ROLE_TITLE[roleId],
      status: "active",
      portrait: portraitFor(m.cpmNickname, m.role, i),
      bio: "",
      traits,
    };
  });

  return { status: "ok", rows };
}
