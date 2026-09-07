/**
 * CREW roster data boundary.
 *
 * Live source: the legacy ONI Firestore `members` collection, read through its
 * public projection (active members only, safe columns only).
 */

import crew01 from "@/assets/crew/crew-01.webp";
import crew02 from "@/assets/crew/crew-02.webp";
import crew03 from "@/assets/crew/crew-03.webp";
import crew04 from "@/assets/crew/crew-04.webp";

export type CrewRoleId = "command" | "driver" | "mechanic" | "media";

export type CrewRole = { id: CrewRoleId; label: string; code: string };

export const CREW_ROLES: CrewRole[] = [
  { id: "command", label: "УДИРДАХ", code: "COMMAND" },
  { id: "driver", label: "ЖОЛООЧ", code: "DRIVER" },
  { id: "mechanic", label: "МЕХАНИК", code: "MECHANIC" },
  { id: "media", label: "МЕДИА", code: "MEDIA" },
];

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
  id: string;
  callsign: string;
  kana?: string;
  roleId: CrewRoleId;
  title: string;
  status: CrewStatus;
  portrait?: string;
  bio: string;
  traits: { label: string; value: string }[];
};

function safePortraitUrl(value: string | undefined): string | undefined {
  const v = (value ?? "").trim();
  if (/^https?:\/\/\S+$/i.test(v)) return v;
  if (/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(v)) return v;
  return undefined;
}

function fallbackPortrait(callsign: string, role: string | undefined, index: number): string {
  const identity = `${callsign} ${role ?? ""}`.toLowerCase();
  if (identity.includes("kitsune") || /(^|\s)leader($|\s)/.test(identity)) return crew01;
  if (identity.includes("hugo") || identity.includes("co-leader")) return crew02;
  return index % 2 === 0 ? crew03 : crew04;
}

export function parseCrewRole(value: string | undefined | null): CrewRoleId {
  const v = (value ?? "").toLowerCase();
  if (
    v.includes("leader") || v.includes("command") || v.includes("captain") ||
    v.includes("owner") || v.includes("удирд") || v.includes("ахлагч") ||
    v.includes("тэргүүн") || v.includes("дэд")
  ) return "command";
  if (v.includes("mechanic") || v.includes("tuner") || v.includes("механ")) return "mechanic";
  if (v.includes("media") || v.includes("content") || v.includes("editor") || v.includes("медиа")) return "media";
  return "driver";
}

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export type CrewLoad = { status: "ok"; rows: CrewMember[] } | { status: "error"; reason: string };

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
      portrait: safePortraitUrl(m.portraitUrl) ?? fallbackPortrait(m.cpmNickname, m.role, i),
      bio: "",
      traits,
    };
  });

  return { status: "ok", rows };
}
