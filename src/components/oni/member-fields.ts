import type { AdminMemberRecord } from "@/data/admin";

export const MEMBER_ADMIN_FIELDS = [
  { key: "cpm_nickname", label: "CPM ХОЧ", required: true, max: 40 },
  { key: "cpm_id", label: "CPM ID", required: true, max: 40 },
  { key: "role", label: "ҮҮРЭГ" },
  { key: "portrait_url", label: "PROFILE ЗУРГИЙН URL", max: 500 },
  { key: "joined_at", label: "ЭЛССЭН", type: "datetime-local" as const },
  {
    key: "status",
    label: "ТӨЛӨВ",
    options: [
      { value: "active", label: "ИДЭВХТЭЙ" },
      { value: "inactive", label: "ИДЭВХГҮЙ" },
      { value: "archived", label: "АРХИВ" },
    ],
  },
];

export function mapAdminMemberRow(m: AdminMemberRecord) {
  return {
    id: m.id,
    cpm_nickname: m.cpmNickname,
    cpm_id: m.cpmId,
    role: m.role,
    portrait_url: m.portraitUrl,
    joined_at: m.joinedAt ? m.joinedAt.slice(0, 16) : "",
    status: m.status,
  };
}
