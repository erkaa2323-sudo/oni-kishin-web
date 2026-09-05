/**
 * JOIN — recruitment application configuration + data boundary.
 *
 * `submitApplication` writes to the Lovable Cloud `applications` table.
 * Public users may insert only; row-level security forbids reading
 * applications back from the client.
 */

export type ExperienceLevel = "rookie" | "regular" | "veteran";

export const EXPERIENCE_OPTIONS: { id: ExperienceLevel; label: string; code: string }[] = [
  { id: "rookie", label: "ШИНЭ", code: "ROOKIE" },
  { id: "regular", label: "ТОГТМОЛ", code: "REGULAR" },
  { id: "veteran", label: "ТУРШЛАГАТАЙ", code: "VETERAN" },
];

export type JoinInterest = "drift" | "street" | "media" | "music" | "tech";

export const INTEREST_OPTIONS: { id: JoinInterest; label: string }[] = [
  { id: "drift", label: "ДРИФТ" },
  { id: "street", label: "ГУДАМЖ" },
  { id: "media", label: "МЕДИА" },
  { id: "music", label: "ХӨГЖИМ" },
  { id: "tech", label: "ТЕХНИК" },
];

export type JoinApplication = {
  cpmNickname: string;
  cpmId: string;
  contact: string;
  experience: ExperienceLevel;
  interests: JoinInterest[];
  message: string;
};

export const CPM_ID_MAX = 40;
export const NICKNAME_MAX = 32;
export const MESSAGE_MAX = 400;

export type JoinFieldErrors = Partial<Record<keyof JoinApplication, string>>;

export function validateApplication(v: JoinApplication): JoinFieldErrors {
  const e: JoinFieldErrors = {};
  const nick = v.cpmNickname.trim();
  const id = v.cpmId.trim();
  const contact = v.contact.trim();

  if (!nick) e.cpmNickname = "CPM хоч заавал шаардлагатай.";
  else if (nick.length > NICKNAME_MAX) e.cpmNickname = `Дээд тал нь ${NICKNAME_MAX} тэмдэгт.`;

  if (!id) e.cpmId = "CPM ID заавал шаардлагатай.";
  else if (id.length > CPM_ID_MAX) e.cpmId = `Дээд тал нь ${CPM_ID_MAX} тэмдэгт.`;

  if (!contact) e.contact = "Холбоо барих мэдээлэл шаардлагатай.";
  else if (contact.length < 3) e.contact = "Хэт богино байна.";

  if (v.message.length > MESSAGE_MAX) e.message = `Дээд тал нь ${MESSAGE_MAX} тэмдэгт.`;

  return e;
}

export type SubmitResult = { ok: true; reference: string } | { ok: false; error: string };

export const JOIN_BACKEND_CONNECTED = true;

export async function submitApplication(application: JoinApplication): Promise<SubmitResult> {
  const errors = validateApplication(application);
  if (Object.keys(errors).length) {
    return { ok: false, error: "Мэдээлэл дутуу эсвэл буруу байна." };
  }

  const { applicationsService } = await import("@/services/domains");
  const interests = application.interests.join(",");
  const res = await applicationsService.submit({
    cpm_nickname: application.cpmNickname.trim(),
    cpm_id: application.cpmId.trim(),
    contact: application.contact.trim(),
    experience: [application.experience, interests].filter(Boolean).join(" | ").slice(0, 200),
    ...(application.message.trim() ? { message: application.message.trim() } : {}),
  });

  if (!res.ok) return { ok: false, error: res.error.message };
  return { ok: true, reference: res.data.id.slice(0, 8).toUpperCase() };
}
