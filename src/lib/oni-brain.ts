/**
 * ONI BRAIN — deterministic, backend-connected assistant core.
 *
 * SECURITY / STRUCTURAL ISOLATION
 * This module imports ONLY public-safe data paths:
 *   - membersService.listPublic()   (active members, public projection)
 *   - garageService.listPublished() (published vehicles)
 *   - musicService.listPublished()  (published tracks)
 *   - fetchActiveMeet()             (credential-free public RPC)
 * There is NO import, query, table reference or tool path to
 * `meet_credentials`, room_id, room_password, applications, audit logs,
 * profiles, user_roles or any secret. A credential refusal runs first as
 * defense-in-depth. Nothing is invented: missing data is reported as missing.
 */

import { CREDENTIAL_REFUSAL, isCredentialRequest } from "@/data/oni-ai";
import { deriveLifecycle, fetchActiveMeet, LIFECYCLE_LABEL, type MeetSession } from "@/data/meet";
import { inferReplyState, type OniState } from "@/lib/oni-emotion";
import { hasStem, normalizeInput, type NormalizedInput } from "@/lib/oni-normalize";

export type BrainReply = {
  text: string;
  state?: OniState;
  sources?: Array<{ url: string; title: string }>;
};

/** One bounded conversation turn handed in by the UI. Never persisted here. */
export type BrainTurn = { role: "user" | "oni"; text: string };

const NO_DATA = "Одоогоор бүртгэгдсэн мэдээлэл алга байна.";

function fmtDate(iso: string | null): string {
  if (!iso) return "цаг тодорхойгүй";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "цаг тодорхойгүй";
  return d.toLocaleString("mn-MN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countdown(iso: string | null): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(diff)) return "";
  if (diff <= 0) return "хугацаа болсон";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} өдөр ${h % 24} цаг үлдлээ`;
  if (h > 0) return `${h} цаг ${m} мин үлдлээ`;
  return `${m} мин үлдлээ`;
}

async function meetAnswer(): Promise<BrainReply> {
  const load = await fetchActiveMeet();
  if (load.status === "error")
    return {
      text: "Уулзалтын мэдээлэл ачаалж чадсангүй. Дараа дахин оролдоно уу.",
      state: "concerned",
    };
  const s: MeetSession | null = load.session;
  if (!s) return { text: "Одоогоор зарлагдсан идэвхтэй уулзалт алга байна.", state: "idle" };
  const life = deriveLifecycle(s);
  const cap = s.capacity === null ? "хязгааргүй" : `${s.registered}/${s.capacity}`;
  const close = s.registrationClosesAt
    ? ` Бүртгэл хаагдах: ${fmtDate(s.registrationClosesAt)} (${countdown(s.registrationClosesAt)}).`
    : "";
  return {
    text:
      `«${s.title}» — ${LIFECYCLE_LABEL[life]}. Эхлэх: ${fmtDate(s.scheduledAt)}` +
      (s.scheduledAt ? ` (${countdown(s.scheduledAt)})` : "") +
      `. Бүртгэгдсэн: ${cap}.${close} Бүртгүүлэхийг УУЛЗАЛТ хэсгээс хийнэ.`,
    state: life === "open" ? "excited" : "serious",
  };
}

async function membersAnswer(): Promise<BrainReply> {
  const { membersService } = await import("@/services/domains");
  const res = await membersService.listPublic();
  if (!res.ok) return { text: "Гишүүдийн мэдээлэл ачаалж чадсангүй.", state: "concerned" };
  if (res.data.length === 0) return { text: `Гишүүд: ${NO_DATA}`, state: "idle" };
  const names = res.data
    .slice(0, 8)
    .map((m) => m.cpmNickname)
    .join(", ");
  const more = res.data.length > 8 ? ` (+${res.data.length - 8})` : "";
  return {
    text: `Идэвхтэй гишүүд: ${res.data.length}. ${names}${more}. Дэлгэрэнгүйг КРЮ хэсгээс үзнэ үү.`,
    state: "happy",
  };
}

async function garageAnswer(): Promise<BrainReply> {
  const { garageService } = await import("@/services/domains");
  const res = await garageService.listPublished();
  if (!res.ok) return { text: "Гаражийн мэдээлэл ачаалж чадсангүй.", state: "concerned" };
  if (res.data.length === 0) return { text: `Гараж: ${NO_DATA}`, state: "idle" };
  const list = res.data
    .slice(0, 6)
    .map((v) => `${v.model}${v.ownerName ? ` — ${v.ownerName}` : ""}`)
    .join("; ");
  return {
    text: `Нийтэлсэн машин: ${res.data.length}. ${list}. Бүрэн жагсаалт ГАРАЖ хэсэгт.`,
    state: "excited",
  };
}

async function musicAnswer(): Promise<BrainReply> {
  const { musicService } = await import("@/services/domains");
  const res = await musicService.listPublished();
  if (!res.ok) return { text: "Хөгжмийн мэдээлэл ачаалж чадсангүй.", state: "concerned" };
  if (res.data.length === 0) return { text: `Плейлист: ${NO_DATA}`, state: "idle" };
  const list = res.data
    .slice(0, 5)
    .map((t) => t.title)
    .join(", ");
  return { text: `Плейлистэд ${res.data.length} трек байна: ${list}.`, state: "music" };
}

async function statsAnswer(): Promise<BrainReply> {
  const { membersService, garageService, musicService } = await import("@/services/domains");
  const [m, g, t, meet] = await Promise.all([
    membersService.listPublic(),
    garageService.listPublished(),
    musicService.listPublished(),
    fetchActiveMeet(),
  ]);
  const n = (r: { ok: boolean; data?: unknown[] }) => (r.ok && r.data ? r.data.length : "—");
  const meetLine =
    meet.status === "ok" && meet.session
      ? `Идэвхтэй уулзалт: «${meet.session.title}» (${LIFECYCLE_LABEL[deriveLifecycle(meet.session)]}).`
      : "Идэвхтэй уулзалт: алга.";
  return {
    text: `ONI & KISHIN төлөв — Гишүүд: ${n(m)} · Машин: ${n(g)} · Трек: ${n(t)}. ${meetLine}`,
    state: "serious",
  };
}

const HELP =
  "Би клан хамаарах нийтийн мэдээллийг хариулна: гишүүд, гараж, хөгжим, уулзалтын цаг/багтаамж/бүртгэлийн төлөв, элсэлт. Хамгаалагдсан мэдээлэл (ROOM ID, нууц үг) би хэзээ ч дамжуулахгүй.";

/* ----------------------------------------------------------- intent layer */

type Intent =
  "greet" | "meet" | "members" | "garage" | "music" | "stats" | "join" | "identity" | "help";

/** Pure keyword classification over the normalized (translit-aware) haystack. */
function classify(n: NormalizedInput): Intent | null {
  if (
    hasStem(
      n,
      "сайн уу",
      "саин уу",
      "саинуу",
      "сайн байна уу",
      "саин баина",
      "сайнуу",
      "хэлло",
      "хело",
      "хай",
      "мэнд",
      "йо ",
      "йоу",
    )
  )
    return "greet";
  if (hasStem(n, "уулзалт", "меет", "цуглаан", "хэзээ", "цоунтдовн", "бүртгэл", "багтаамж"))
    return "meet";
  if (hasStem(n, "гишүү", "мембер", "црэв", "крю", "бүрэлдэхүүн", "хэн хэн")) return "members";
  if (hasStem(n, "гараж", "гараш", "машин", "цар", "авто", "унаа")) return "garage";
  if (hasStem(n, "хөгжим", "хогжим", "мусиц", "трэк", "трац", "плейлист", "дуу")) return "music";
  if (
    hasStem(
      n,
      "статистик",
      "тоо",
      "төлөв",
      "стат",
      "статус",
      "хэдэн",
      "хураангуй",
      "танилцуул",
      "клан",
      "они анд кишин",
    )
  )
    return "stats";
  if (hasStem(n, "элс", "жоин", "анкет", "шаардлага", "яаж орох", "элсэх")) return "join";
  if (hasStem(n, "чи хэн", "вхо аре йоу", "они ай", "они браин", "чамайг хэн")) return "identity";
  if (hasStem(n, "тусла", "юу чадах", "хэлп", "заавар")) return "help";
  return null;
}

/** Short, referential follow-ups that should inherit the previous intent. */
function isFollowUp(n: NormalizedInput): boolean {
  const words = n.clean.split(" ").filter(Boolean);
  if (words.length > 6) return false;
  return hasStem(
    n,
    "тэр",
    "тэд",
    "тэгээд",
    "тэгэд",
    "дахиад",
    "дэлгэрэнгүй",
    "дэлгэрэнгуй",
    "цааш",
    "өөр",
    "яг",
    "хэд",
    "хэн бэ",
    "жагса",
    "нэр",
  );
}

const REPLIES: Record<Intent, () => Promise<BrainReply>> = {
  greet: async () => ({
    text: "Сайн уу. ONI BRAIN онлайн байна. Гишүүд, гараж, хөгжим, уулзалтын мэдээллээс юуг мэдмээр байна?",
    state: "happy",
  }),
  meet: meetAnswer,
  members: membersAnswer,
  garage: garageAnswer,
  music: musicAnswer,
  stats: statsAnswer,
  join: async () => ({
    text: "Элсэхийн тулд ЭЛСЭЛТ хэсгээс анкетаа бөглөнө: CPM nickname, CPM ID, холбоо барих суваг. Хүсэлтийг админ баг хянаж хариу өгнө. Би шийдвэр гаргах эрхгүй.",
    state: "serious",
  }),
  identity: async () => ({
    text: "Би ONI BRAIN — ONI & KISHIN кланы дижитал туслах. Зөвхөн нийтэд нээлттэй өгөгдөл дээр тулгуурлан хариулна.",
    state: "happy",
  }),
  help: async () => ({ text: HELP, state: "serious" }),
};

/** Last intent found in the bounded history — used to resolve follow-ups. */
function lastIntent(history: BrainTurn[]): Intent | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const turn = history[i];
    if (!turn || turn.role !== "user") continue;
    const found = classify(normalizeInput(turn.text));
    if (found && found !== "greet") return found;
  }
  return null;
}

/**
 * Guarded general-conversation fallback. Runs ONLY when no deterministic
 * public-data intent matched and the credential refusal has already passed.
 * Returns null when the built-in model is unavailable, so the local answer
 * stays in charge.
 */
async function generalFallback(raw: string, history: BrainTurn[]): Promise<BrainReply | null> {
  try {
    const { oniGeneralChat } = await import("@/lib/oni-chat.functions");
    const { membersService, garageService, musicService } = await import("@/services/domains");
    const [members, garage, music, meet] = await Promise.all([
      membersService.listPublic(),
      garageService.listPublished(),
      musicService.listPublished(),
      fetchActiveMeet(),
    ]);
    const publicContext = JSON.stringify({
      clan: "ONI AND KISHIN / CPM",
      members: members.ok
        ? members.data.map((member) => ({
            nickname: member.cpmNickname,
            role: member.role ?? "member",
          }))
        : "unavailable",
      garage: garage.ok
        ? garage.data.map((vehicle) => ({
            model: vehicle.model,
            owner: vehicle.ownerName ?? null,
            build: vehicle.build ?? null,
          }))
        : "unavailable",
      music: music.ok
        ? music.data.map((track) => ({ title: track.title, artist: track.artist ?? null }))
        : "unavailable",
      meet:
        meet.status === "ok" && meet.session
          ? {
              title: meet.session.title,
              scheduledAt: meet.session.scheduledAt,
              registrationClosesAt: meet.session.registrationClosesAt,
              capacity: meet.session.capacity,
              registered: meet.session.registered,
              lifecycle: deriveLifecycle(meet.session),
            }
          : null,
    }).slice(0, 6000);
    const turns = [...history.slice(-10), { role: "user" as const, text: raw }]
      .filter((t) => t.text.trim().length > 0)
      .map((t) => ({
        role: (t.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: t.text.slice(0, 1200),
      }));
    const res = await oniGeneralChat({ data: { turns, publicContext } });
    if (!res.ok) return null;
    // Defense in depth: never relay a model answer that drifted into credentials.
    if (isCredentialRequest(res.text)) return { text: CREDENTIAL_REFUSAL, state: "serious" };
    // Character reacts to BOTH sides of the exchange, not a frozen pose.
    return { text: res.text, state: inferReplyState(raw, res.text), sources: res.sources };
  } catch {
    return null;
  }
}

/**
 * History-aware routing over safe live data.
 *
 * Order: credential refusal -> deterministic public-data intent (authoritative)
 * -> follow-up resolution from bounded history -> guarded general fallback ->
 * local non-command-like answer. `history` is read-only and never stored.
 */
export async function answerOni(input: string, history: BrainTurn[] = []): Promise<BrainReply> {
  const n = normalizeInput(input);
  if (!n.raw) return { text: "Асуултаа бичнэ үү.", state: "listening" };
  if (isCredentialRequest(n.raw) || isCredentialRequest(n.haystack))
    return { text: CREDENTIAL_REFUSAL, state: "serious" };

  const bounded = history.slice(-10);

  const direct = classify(n);
  // Factual intents stay deterministic and authoritative. Conversational
  // intents (greeting, identity, help) prefer the live model for a natural,
  // non-canned voice, falling back to the local line when it's unavailable.
  const CONVERSATIONAL: Intent[] = ["greet", "identity", "help"];
  if (direct && !CONVERSATIONAL.includes(direct)) return REPLIES[direct]();
  if (direct && CONVERSATIONAL.includes(direct)) {
    const general = await generalFallback(n.raw, bounded);
    return general ?? REPLIES[direct]();
  }

  if (isFollowUp(n)) {
    const prior = lastIntent(bounded);
    if (prior) return REPLIES[prior]();
  }

  const general = await generalFallback(n.raw, bounded);
  if (general) return general;

  return {
    text: `Үүнд яг таарах баталгаатай өгөгдөл надад алга байна. ${HELP}`,
    state: "concerned",
  };
}
