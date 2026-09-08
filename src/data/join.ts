/**
 * JOIN — recruitment application configuration + data boundary.
 *
 * Public applicants can submit an application and later read only a tiny
 * bearer-token status projection. Private application documents stay admin-only.
 */

export type ExperienceLevel = "rookie" | "regular" | "veteran";

export const EXPERIENCE_OPTIONS: { id: ExperienceLevel; label: string; code: string }[] = [
  { id: "rookie", label: "ШИНЭ", code: "ROOKIE" },
  { id: "regular", label: "ТОГТМОЛ", code: "REGULAR" },
  { id: "veteran", label: "ТУРШЛАГАТАЙ", code: "VETERAN" },
];

const FIRESTORE_EXPERIENCE: Record<ExperienceLevel, string> = {
  rookie: "6 сараас бага",
  regular: "6 сар – 1 жил",
  veteran: "2 жилээс дээш",
};

export type JoinInterest = "drift" | "street" | "media" | "music" | "tech";

export const INTEREST_OPTIONS: { id: JoinInterest; label: string }[] = [
  { id: "drift", label: "ДРИФТ" },
  { id: "street", label: "ГУДАМЖ" },
  { id: "media", label: "МЕДИА" },
  { id: "music", label: "ХӨГЖИМ" },
  { id: "tech", label: "ТЕХНИК" },
];

export type JoinApplication = {
  lastName: string;
  firstName: string;
  age: string;
  gender: "Эрэгтэй" | "Эмэгтэй";
  cpmNickname: string;
  cpmId: string;
  direction:
    "Clean Car" | "Anime Car" | "Racer / Drifter" | "Drag Racer" | "Content Creator" | "Other";
  contactType: "Instagram" | "Discord" | "Phone";
  contact: string;
  experience: ExperienceLevel;
  interests: JoinInterest[];
  message: string;
};

export const CPM_ID_MAX = 40;
export const NICKNAME_MAX = 32;
export const MESSAGE_MAX = 400;

export const JOIN_MEMBERSHIP_WATCH_KEY = "oni_join_membership_watch_v1";
export const JOIN_MEMBERSHIP_WATCH_EVENT = "oni:join-membership-watch";

export type JoinMembershipWatch = {
  reference: string;
  cpmNickname: string;
  cpmId: string;
  savedAt: number;
  statusToken?: string;
  accepted?: boolean;
  rejected?: boolean;
  memberId?: string;
};

export type JoinMembershipStatus =
  | { state: "pending" }
  | { state: "rejected" }
  | { state: "accepted"; memberId: string; nickname: string };

export type JoinFieldErrors = Partial<Record<keyof JoinApplication, string>>;

export function validateApplication(v: JoinApplication): JoinFieldErrors {
  const e: JoinFieldErrors = {};
  const nick = v.cpmNickname.trim();
  const id = v.cpmId.trim();
  const contact = v.contact.trim();

  if (!v.lastName.trim()) e.lastName = "Овог заавал шаардлагатай.";
  if (!v.firstName.trim()) e.firstName = "Нэр заавал шаардлагатай.";
  const age = Number(v.age);
  if (!Number.isInteger(age) || age < 17 || age > 90) e.age = "Нас 17–90 хооронд байна.";

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

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedIdentity(value: string): string {
  return value.trim().toLocaleLowerCase("mn-MN");
}

export function readJoinMembershipWatch(): JoinMembershipWatch | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(JOIN_MEMBERSHIP_WATCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<JoinMembershipWatch>;
    const reference = cleanText(parsed.reference);
    const cpmNickname = cleanText(parsed.cpmNickname);
    const cpmId = cleanText(parsed.cpmId);
    const savedAt = Number(parsed.savedAt);
    if (!reference || !cpmNickname || !cpmId || !Number.isFinite(savedAt)) return null;

    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    if (!parsed.accepted && !parsed.rejected && Date.now() - savedAt > ninetyDays) {
      window.localStorage.removeItem(JOIN_MEMBERSHIP_WATCH_KEY);
      return null;
    }

    return {
      reference,
      cpmNickname,
      cpmId,
      savedAt,
      ...(cleanText(parsed.statusToken) ? { statusToken: cleanText(parsed.statusToken) } : {}),
      ...(parsed.accepted ? { accepted: true } : {}),
      ...(parsed.rejected ? { rejected: true } : {}),
      ...(cleanText(parsed.memberId) ? { memberId: cleanText(parsed.memberId) } : {}),
    };
  } catch {
    return null;
  }
}

export function saveJoinMembershipWatch(watch: JoinMembershipWatch) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(JOIN_MEMBERSHIP_WATCH_KEY, JSON.stringify(watch));
    window.dispatchEvent(new CustomEvent(JOIN_MEMBERSHIP_WATCH_EVENT));
  } catch {
    // Status tracking is a convenience layer; the application is already stored in Firestore.
  }
}

/**
 * New applications use the anonymous status projection. Historical pending
 * applications fall back to the public Crew list, so existing users are not lost.
 */
export async function checkJoinMembershipStatus(
  watch: JoinMembershipWatch,
): Promise<JoinMembershipStatus> {
  try {
    if (watch.statusToken) {
      const { readPublicApplicationStatus } = await import("@/services/application-workflow");
      const publicStatus = await readPublicApplicationStatus(watch.statusToken);
      if (publicStatus.ok) {
        if (publicStatus.data.state === "rejected") return { state: "rejected" };
        if (publicStatus.data.state === "accepted" && publicStatus.data.memberId) {
          return {
            state: "accepted",
            memberId: publicStatus.data.memberId,
            nickname: watch.cpmNickname,
          };
        }
      }
    }

    const [{ collection, getDocs, limit, query, where }, { firebaseDb }] = await Promise.all([
      import("firebase/firestore"),
      import("@/integrations/firebase/client"),
    ]);

    const find = async (field: "cpmid" | "cpmId") =>
      getDocs(query(collection(firebaseDb, "members"), where(field, "==", watch.cpmId), limit(5)));

    let snapshot = await find("cpmid");
    if (snapshot.empty) snapshot = await find("cpmId");

    const expectedNickname = normalizedIdentity(watch.cpmNickname);
    const active = snapshot.docs.find((entry) => {
      const data = entry.data() as Record<string, unknown>;
      const status = cleanText(data.status).toLowerCase();
      const memberNickname =
        cleanText(data.nick) || cleanText(data.nickname) || cleanText(data.name);
      return (
        status !== "inactive" &&
        status !== "archived" &&
        normalizedIdentity(memberNickname) === expectedNickname
      );
    });

    if (!active) return { state: "pending" };
    const data = active.data() as Record<string, unknown>;
    return {
      state: "accepted",
      memberId: active.id,
      nickname:
        cleanText(data.nick) ||
        cleanText(data.nickname) ||
        cleanText(data.name) ||
        watch.cpmNickname,
    };
  } catch {
    // Network/rules failures must never invent an acceptance or rejection.
    return { state: "pending" };
  }
}

export async function submitApplication(application: JoinApplication): Promise<SubmitResult> {
  const errors = validateApplication(application);
  if (Object.keys(errors).length) {
    return { ok: false, error: "Мэдээлэл дутуу эсвэл буруу байна." };
  }

  const { submitSecureApplication } = await import("@/services/application-workflow");
  const interests = application.interests.join(",");
  const res = await submitSecureApplication({
    last: application.lastName.trim(),
    first: application.firstName.trim(),
    age: Number(application.age),
    gender: application.gender,
    cpm_nickname: application.cpmNickname.trim(),
    cpm_id: application.cpmId.trim(),
    direction: application.direction,
    contact_type: application.contactType,
    contact: application.contact.trim(),
    experience: FIRESTORE_EXPERIENCE[application.experience],
    interests,
    ...(application.message.trim() ? { message: application.message.trim() } : {}),
  });

  if (!res.ok) return { ok: false, error: res.error.message };

  const reference = res.data.id.slice(0, 8).toUpperCase();
  saveJoinMembershipWatch({
    reference,
    cpmNickname: application.cpmNickname.trim(),
    cpmId: application.cpmId.trim(),
    savedAt: Date.now(),
    statusToken: res.data.statusToken,
  });

  return { ok: true, reference };
}
