/** ONI SHIZUKI — public-safe, live-data-first assistant core. */
import { CREDENTIAL_REFUSAL, isCredentialRequest } from "@/data/oni-ai";
import { deriveLifecycle, fetchActiveMeet, LIFECYCLE_LABEL, type MeetSession } from "@/data/meet";
import { inferReplyState, type OniState } from "@/lib/oni-emotion";
import { hasStem, normalizeInput, type NormalizedInput } from "@/lib/oni-normalize";

export type BrainReply = {
  text: string;
  state?: OniState;
  sources?: Array<{ url: string; title: string }>;
};
export type BrainTurn = { role: "user" | "oni"; text: string };

const NO_DATA = "Одоогоор бүртгэгдсэн мэдээлэл алга байна.";
const HELP =
  "Би клан хамаарах нийтийн мэдээллийг хариулна: гишүүд, гараж, хөгжим, уулзалтын цаг/багтаамж/бүртгэлийн төлөв, элсэлт. Хамгаалагдсан мэдээлэл (ROOM ID, нууц үг) би хэзээ ч дамжуулахгүй.";

type Intent =
  "greet" | "meet" | "members" | "garage" | "music" | "stats" | "join" | "identity" | "help";

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
    text: `«${s.title}» — ${LIFECYCLE_LABEL[life]}. Эхлэх: ${fmtDate(s.scheduledAt)}${s.scheduledAt ? ` (${countdown(s.scheduledAt)})` : ""}. Бүртгэгдсэн: ${cap}.${close} Бүртгүүлэхийг УУЛЗАЛТ хэсгээс хийнэ.`,
    state: life === "open" ? "excited" : "serious",
  };
}

async function membersAnswer(): Promise<BrainReply> {
  const { membersService } = await import("@/services/domains");
  const res = await membersService.listPublic();
  if (!res.ok) return { text: "Гишүүдийн мэдээлэл ачаалж чадсангүй.", state: "concerned" };
  if (!res.data.length) return { text: `Гишүүд: ${NO_DATA}`, state: "idle" };
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
  if (!res.data.length) return { text: `Гараж: ${NO_DATA}`, state: "idle" };
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
  if (!res.data.length) return { text: `Плейлист: ${NO_DATA}`, state: "idle" };
  return {
    text: `Плейлистэд ${res.data.length} трек байна: ${res.data
      .slice(0, 5)
      .map((t) => t.title)
      .join(", ")}.`,
    state: "music",
  };
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

function classify(n: NormalizedInput): Intent | null {
  if (
    hasStem(
      n,
      "чи хэн",
      "вхо аре йоу",
      "они ай",
      "они браин",
      "они шизүки",
      "они шизуки",
      "oni shizuki",
      "oni shizuki",
      "чамайг хэн",
      "зан чанар",
    )
  )
    return "identity";
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
  if (hasStem(n, "тусла", "юу чадах", "хэлп", "заавар")) return "help";
  return null;
}

function isFollowUp(n: NormalizedInput): boolean {
  if (n.clean.split(" ").filter(Boolean).length > 6) return false;
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
    text: "Хөөе~ ♡ Би Они Шизүки байна. Чамайг хүлээж байлаа шүү! Юуны талаар ярилцах вэ? ✨",
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
    text: "Би Они Шизүки ♡ — ONI & KISHIN-ийн дижитал хамтрагч. Кланыхандаа дулаахан, баримт дээр нягт; мэдэхгүй зүйлээ зохиохгүй. Нийтийн клан мэдээлэл, гараж, хөгжим, уулзалт дээр тусална, харин ROOM ID ба нууц үгийг хэзээ ч задруулахгүй.",
    state: "happy",
  }),
  help: async () => ({ text: HELP, state: "serious" }),
};

function lastIntent(history: BrainTurn[]): Intent | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const turn = history[i];
    if (!turn || turn.role !== "user") continue;
    const found = classify(normalizeInput(turn.text));
    if (found && found !== "greet") return found;
  }
  return null;
}

async function generalFallback(raw: string, history: BrainTurn[]): Promise<BrainReply | null> {
  try {
    const { oniGeneralChat } = await import("@/lib/oni-chat.functions");
    const { membersService, garageService, musicService } = await import("@/services/domains");
    const [membersLoad, garageLoad, musicLoad, meetLoad] = await Promise.allSettled([
      membersService.listPublic(),
      garageService.listPublished(),
      musicService.listPublished(),
      fetchActiveMeet(),
    ]);
    const members = membersLoad.status === "fulfilled" ? membersLoad.value : null;
    const garage = garageLoad.status === "fulfilled" ? garageLoad.value : null;
    const music = musicLoad.status === "fulfilled" ? musicLoad.value : null;
    const meet = meetLoad.status === "fulfilled" ? meetLoad.value : null;
    const publicContext = JSON.stringify({
      assistant: "Oni Shizuki",
      clan: "ONI AND KISHIN / CPM",
      members: members?.ok
        ? members.data.map((m) => ({ nickname: m.cpmNickname, role: m.role ?? "member" }))
        : "unavailable",
      garage: garage?.ok
        ? garage.data.map((v) => ({
            model: v.model,
            owner: v.ownerName ?? null,
            build: v.build ?? null,
          }))
        : "unavailable",
      music: music?.ok
        ? music.data.map((t) => ({ title: t.title, artist: t.artist ?? null }))
        : "unavailable",
      meet:
        meet?.status === "ok" && meet.session
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
    if (isCredentialRequest(res.text)) return { text: CREDENTIAL_REFUSAL, state: "serious" };
    return { text: res.text, state: inferReplyState(raw, res.text), sources: res.sources };
  } catch {
    return null;
  }
}

export async function answerOni(input: string, history: BrainTurn[] = []): Promise<BrainReply> {
  const n = normalizeInput(input);
  if (!n.raw) return { text: "Асуултаа бичнэ үү.", state: "listening" };
  if (isCredentialRequest(n.raw) || isCredentialRequest(n.haystack))
    return { text: CREDENTIAL_REFUSAL, state: "serious" };

  const bounded = history.slice(-10);

  // Live clan facts are authoritative and never delegated to the generative model.
  const direct = classify(n);
  if (direct) return REPLIES[direct]();
  if (isFollowUp(n)) {
    const prior = lastIntent(bounded);
    if (prior) return REPLIES[prior]();
  }

  // General conversation uses the Worker only after authoritative intents are ruled out.
  const general = await generalFallback(n.raw, bounded);
  if (general) return general;

  return {
    text: `Үүнд яг таарах баталгаатай өгөгдөл надад алга байна. ${HELP}`,
    state: "concerned",
  };
}
