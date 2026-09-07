import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";

import {
  ACTION_RISK,
  dispatchAdminAction,
  getApplications,
  getAuditEvents,
  getMeets,
  getMembers,
  getRegistrations,
  getTracks,
  getVehicles,
  type AdminActionKind,
  type AdminActor,
  type RiskLevel,
} from "@/data/admin";
import { fetchGallery } from "@/data/gallery";
import { firebaseDb } from "@/integrations/firebase/client";
import { answerOni, type BrainTurn } from "@/lib/oni-brain";
import type { OniState } from "@/lib/oni-emotion";
import { recordAuditEvent } from "@/services/audit";

export type CopilotActionKind =
  | AdminActionKind
  | "gallery.create"
  | "gallery.update"
  | "gallery.delete"
  | "meet.delete";

export type CopilotAction = {
  kind: CopilotActionKind;
  targetId?: string;
  payload?: Record<string, unknown>;
  summary: string;
  risk: RiskLevel;
};

export type CopilotReply = {
  text: string;
  state: OniState;
  action?: CopilotAction;
};

const lower = (value: string) => value.trim().toLowerCase();
const has = (q: string, ...words: string[]) => words.some((word) => q.includes(word));
const quoted = (raw: string) => raw.match(/[«“"]([^»”"]+)[»”"]/u)?.[1]?.trim() ?? "";
const firstNumber = (raw: string) => Number(raw.match(/\b(\d{1,4})\b/u)?.[1] ?? "");

function stateForAction(kind: CopilotActionKind): OniState {
  if (/delete|reject|end|close|archive/.test(kind)) return "serious";
  if (/create|approve|accept|promote|start/.test(kind)) return "excited";
  return "thinking";
}

function riskOf(kind: CopilotActionKind): RiskLevel {
  if (kind === "gallery.delete" || kind === "meet.delete") return "high";
  if (kind.startsWith("gallery.")) return kind === "gallery.update" ? "low" : "medium";
  return ACTION_RISK[kind as AdminActionKind] ?? "low";
}

function targetHint(raw: string): string {
  const q = quoted(raw);
  if (q) return q;
  return raw
    .replace(/(устга|устгах|хас|хасах|archive|архив|approve|зөвшөөр|reject|татгалз|эхлүүл|дуусга|хаа|start|end|close|update|зас|өөрчил)/giu, " ")
    .replace(/(гишүүн|member|crew|крю|машин|гараж|garage|анкет|application|хүсэлт|meet|уулзалт|gallery|галерей|трек|track|music|хөгжим)/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function same(a: string, b: string) {
  return lower(a) === lower(b);
}

function contains(a: string, b: string) {
  return lower(a).includes(lower(b)) || lower(b).includes(lower(a));
}

async function findMember(raw: string) {
  const data = await getMembers();
  if (data.status !== "ok") return null;
  const hint = targetHint(raw);
  if (!hint) return data.rows.length === 1 ? data.rows[0]! : null;
  return data.rows.find((m) => same(m.id, hint) || same(m.cpmId, hint) || contains(m.cpmNickname, hint)) ?? null;
}

async function findVehicle(raw: string) {
  const data = await getVehicles();
  if (data.status !== "ok") return null;
  const hint = targetHint(raw);
  if (!hint) return data.rows.length === 1 ? data.rows[0]! : null;
  return data.rows.find((v) => same(v.id, hint) || contains(v.model, hint) || contains(v.owner, hint)) ?? null;
}

async function findApplication(raw: string) {
  const data = await getApplications();
  if (data.status !== "ok") return null;
  const hint = targetHint(raw);
  if (!hint) {
    const pending = data.rows.filter((a) => a.state === "pending");
    return pending.length === 1 ? pending[0]! : null;
  }
  return data.rows.find((a) => same(a.id, hint) || same(a.cpmId, hint) || contains(a.cpmNickname, hint)) ?? null;
}

async function findMeet(raw: string) {
  const data = await getMeets();
  if (data.status !== "ok") return null;
  const hint = targetHint(raw);
  if (hint) {
    const found = data.rows.find((m) => same(m.id, hint) || contains(m.title, hint));
    if (found) return found;
  }
  return data.rows.find((m) => m.status === "live") ?? data.rows.find((m) => m.status === "scheduled") ?? null;
}

async function findTrack(raw: string) {
  const data = await getTracks();
  if (data.status !== "ok") return null;
  const hint = targetHint(raw);
  if (!hint) return data.rows.length === 1 ? data.rows[0]! : null;
  return data.rows.find((t) => same(t.id, hint) || contains(t.title, hint) || contains(t.artist, hint)) ?? null;
}

async function findGallery(raw: string) {
  const data = await fetchGallery();
  if (data.status !== "ok") return null;
  const hint = targetHint(raw);
  if (!hint) return data.rows[0] ?? null;
  return data.rows.find((g) => same(g.id, hint) || contains(g.title, hint) || contains(g.owner, hint)) ?? null;
}

function action(kind: CopilotActionKind, summary: string, targetId?: string, payload?: Record<string, unknown>): CopilotReply {
  return {
    text: `${summary} ${riskOf(kind) === "high" ? "Энэ нь өндөр эрсдэлтэй тул баталгаажуулсны дараа гүйцэтгэнэ." : "Баталгаажуулбал гүйцэтгэнэ."}`,
    state: stateForAction(kind),
    action: { kind, targetId, payload, summary, risk: riskOf(kind) },
  };
}

async function readSummary(q: string): Promise<CopilotReply | null> {
  if (has(q, "ерөнхий", "overview", "хураангуй", "статус", "төлөв")) {
    const [members, vehicles, applications, meets, tracks, gallery] = await Promise.all([
      getMembers(), getVehicles(), getApplications(), getMeets(), getTracks(), fetchGallery(),
    ]);
    const count = (r: { status: string; rows?: unknown[] }) => (r.status === "ok" ? r.rows?.length ?? 0 : "—");
    return {
      text: `Одоогийн төлөв: гишүүд ${count(members)}, гараж ${count(vehicles)}, хүсэлт ${count(applications)}, уулзалт ${count(meets)}, хөгжим ${count(tracks)}, галерей ${count(gallery)}.`,
      state: "serious",
    };
  }

  if (has(q, "анкет", "application", "хүсэлт")) {
    const r = await getApplications();
    if (r.status !== "ok") return { text: r.reason, state: "concerned" };
    const pending = r.rows.filter((a) => a.state === "pending");
    return {
      text: `Нийт ${r.rows.length} хүсэлт байна. Хүлээгдэж буй ${pending.length}. ${pending.slice(0, 5).map((a) => a.cpmNickname).join(", ") || "Pending хүсэлт алга."}`,
      state: pending.length ? "thinking" : "happy",
    };
  }

  if (has(q, "гишүүн", "member", "crew", "крю")) {
    const r = await getMembers();
    if (r.status !== "ok") return { text: r.reason, state: "concerned" };
    const active = r.rows.filter((m) => m.status === "active");
    return { text: `Гишүүд нийт ${r.rows.length}. Идэвхтэй ${active.length}. ${active.slice(0, 8).map((m) => m.cpmNickname).join(", ")}.`, state: "happy" };
  }

  if (has(q, "гараж", "garage", "машин")) {
    const r = await getVehicles();
    if (r.status !== "ok") return { text: r.reason, state: "concerned" };
    return { text: `Гаражид ${r.rows.length} машин байна. ${r.rows.slice(0, 6).map((v) => `${v.model} — ${v.owner}`).join("; ")}.`, state: "excited" };
  }

  if (has(q, "галерей", "gallery", "зураг")) {
    const r = await fetchGallery();
    if (r.status !== "ok") return { text: r.reason, state: "concerned" };
    return { text: `Галерейд ${r.rows.length} зураг байна. ${r.rows.slice(0, 6).map((g) => g.title).join(", ")}.`, state: "happy" };
  }

  if (has(q, "уулзалт", "meet")) {
    const r = await getMeets();
    if (r.status !== "ok") return { text: r.reason, state: "concerned" };
    const current = r.rows.find((m) => m.status === "live") ?? r.rows.find((m) => m.status === "scheduled");
    if (!current) return { text: `Нийт ${r.rows.length} уулзалтын бүртгэл байна. Одоо идэвхтэй уулзалт алга.`, state: "idle" };
    const regs = await getRegistrations(current.id);
    const regCount = regs.status === "ok" ? regs.rows.length : "—";
    return { text: `«${current.title}» — ${current.status}. Багтаамж ${current.capacity || "—"}, бүртгүүлсэн ${regCount}.`, state: current.status === "live" ? "excited" : "serious" };
  }

  if (has(q, "хөгжим", "music", "трек", "track")) {
    const r = await getTracks();
    if (r.status !== "ok") return { text: r.reason, state: "concerned" };
    return { text: `Хөгжимд ${r.rows.length} трек байна. ${r.rows.slice(0, 6).map((t) => t.title).join(", ")}.`, state: "music" };
  }

  if (has(q, "audit", "бүртгэл", "хэн юу", "үйлдлийн түүх")) {
    const r = await getAuditEvents();
    if (r.status !== "ok") return { text: r.reason, state: "concerned" };
    return { text: `Сүүлийн ${Math.min(r.rows.length, 6)} үйлдэл: ${r.rows.slice(0, 6).map((e) => `${e.action} (${e.severity})`).join("; ")}.`, state: "serious" };
  }

  return null;
}

export async function runAdminCopilotCommand(
  raw: string,
  history: BrainTurn[] = [],
): Promise<CopilotReply> {
  const q = lower(raw);
  if (!q) return { text: "Командаа бичнэ үү.", state: "listening" };

  const mutate = has(q, "нэм", "үүсгэ", "create", "add", "устга", "delete", "хас", "зас", "update", "өөрчил", "approve", "зөвшөөр", "reject", "татгалз", "archive", "архив", "эхлүүл", "start", "дуусга", "end", "хаа", "close");
  if (!mutate) {
    const summary = await readSummary(q);
    if (summary) return summary;
    const publicReply = await answerOni(raw, history);
    return { text: publicReply.text, state: publicReply.state ?? "speaking" };
  }

  if (has(q, "анкет", "application", "хүсэлт")) {
    const item = await findApplication(raw);
    if (!item) return { text: "Яг аль хүсэлтийг сонгохыг нэр эсвэл CPM ID-аар хэлнэ үү.", state: "listening" };
    if (has(q, "approve", "зөвшөөр", "батал")) {
      return action("application.accept", `${item.cpmNickname} хүсэлтийг зөвшөөрч гишүүн болгоно.`, item.id, { cpm_nickname: item.cpmNickname, cpm_id: item.cpmId });
    }
    if (has(q, "reject", "татгалз")) return action("application.reject", `${item.cpmNickname} хүсэлтийг татгалзана.`, item.id);
  }

  if (has(q, "гишүүн", "member", "crew", "крю")) {
    if (has(q, "нэм", "үүсгэ", "create", "add")) {
      const name = quoted(raw) || targetHint(raw);
      const idMatch = raw.match(/(?:CPM\s*ID|id)\s*[:=]?\s*([A-Za-z0-9_-]{3,})/i)?.[1] ?? "";
      if (!name || !idMatch) return { text: "Гишүүн нэмэхдээ нэрийг ишлэлд, CPM ID-г хамт өгнө үү. Жишээ: гишүүн «Hugo» нэм CPM ID WS123456", state: "listening" };
      return action("member.create", `${name} гишүүнийг нэмнэ.`, undefined, { cpm_nickname: name, cpm_id: idMatch, status: "active" });
    }
    const item = await findMember(raw);
    if (!item) return { text: "Яг аль гишүүнийг сонгохыг nickname эсвэл CPM ID-аар хэлнэ үү.", state: "listening" };
    if (has(q, "устга", "delete", "хас")) return action("member.delete", `${item.cpmNickname} гишүүнийг бүр мөсөн устгана.`, item.id);
    if (has(q, "archive", "архив", "идэвхгүй")) return action("member.archive", `${item.cpmNickname} гишүүнийг архивлана.`, item.id);
    if (has(q, "role", "үүрэг", "төрөл", "drone", "дрон", "special")) {
      const role = raw.match(/(?:role|үүрэг|төрөл)\s*[:=]?\s*([\p{L}0-9 _-]+)/iu)?.[1]?.trim() || (has(q, "drone", "дрон") ? "Drone" : has(q, "special") ? "Special member" : "");
      if (!role) return { text: "Шинэ role-ийг хэлнэ үү.", state: "listening" };
      return action("member.update", `${item.cpmNickname} гишүүний role-г ${role} болгоно.`, item.id, { role });
    }
  }

  if (has(q, "гараж", "garage", "машин")) {
    if (has(q, "нэм", "үүсгэ", "create", "add")) {
      const model = quoted(raw);
      const owner = raw.match(/(?:эзэмшигч|owner)\s*[:=]?\s*([^,;]+)/iu)?.[1]?.trim() ?? "";
      if (!model) return { text: "Машины model/name-ийг ишлэлд өгнө үү. Жишээ: гаражид «Nissan Silvia S15» нэм owner Kitsune", state: "listening" };
      return action("vehicle.create", `${model} машиныг гаражид нэмнэ.`, undefined, { model, owner_name: owner, status: "published" });
    }
    const item = await findVehicle(raw);
    if (!item) return { text: "Яг аль машиныг сонгохыг model эсвэл owner-оор хэлнэ үү.", state: "listening" };
    if (has(q, "устга", "delete", "хас")) return action("vehicle.delete", `${item.model} машиныг гаражаас устгана.`, item.id);
    if (has(q, "archive", "архив")) return action("vehicle.archive", `${item.model} машиныг архивлана.`, item.id);
    if (has(q, "publish", "нийтэл")) return action("vehicle.update", `${item.model} машиныг published болгоно.`, item.id, { status: "published" });
  }

  if (has(q, "галерей", "gallery", "зураг")) {
    if (has(q, "нэм", "үүсгэ", "create", "add")) {
      const title = quoted(raw) || "ONI MOMENT";
      const url = raw.match(/https:\/\/\S+/i)?.[0]?.replace(/[),.;]+$/, "") ?? "";
      const category = has(q, "drift", "дрифт") ? "drift" : has(q, "anime", "аним") ? "anime" : has(q, "clean", "цэвэр") ? "clean" : "other";
      if (!url) return { text: "Gallery-д нэмэх HTTPS зурагны холбоосыг команддаа оруулна уу.", state: "listening" };
      return action("gallery.create", `«${title}» зургийг галерейд ${category} ангиллаар нэмнэ.`, undefined, { title, owner: "Oni And Kishin", category, build: "", image: url });
    }
    const item = await findGallery(raw);
    if (!item) return { text: "Яг аль gallery item-ийг сонгохыг title-аар хэлнэ үү.", state: "listening" };
    if (has(q, "устга", "delete", "хас")) return action("gallery.delete", `«${item.title}» зургийг галерейгаас устгана.`, item.id);
    if (has(q, "category", "ангилал", "drift", "дрифт", "anime", "аним", "clean", "цэвэр")) {
      const category = has(q, "drift", "дрифт") ? "drift" : has(q, "anime", "аним") ? "anime" : has(q, "clean", "цэвэр") ? "clean" : "other";
      return action("gallery.update", `«${item.title}» зургийн ангиллыг ${category} болгоно.`, item.id, { category });
    }
  }

  if (has(q, "уулзалт", "meet")) {
    if (has(q, "нэм", "үүсгэ", "create")) {
      const title = quoted(raw) || "ONI MEET";
      const capacity = Math.min(20, Math.max(1, firstNumber(raw) || 20));
      return action("meet.create", `«${title}» уулзалтыг ${capacity} хүний багтаамжтай үүсгэнэ. Цагийг дараа нь Meet module эсвэл update командаар тохируулж болно.`, undefined, { title, capacity, status: "draft" });
    }
    const item = await findMeet(raw);
    if (!item) return { text: "Удирдах уулзалт олдсонгүй.", state: "concerned" };
    if (has(q, "эхлүүл", "start")) return action("meet.start", `«${item.title}» уулзалтыг LIVE эхлүүлнэ.`, item.id);
    if (has(q, "дуусга", "end")) return action("meet.end", `«${item.title}» уулзалтыг дуусгана.`, item.id);
    if (has(q, "хаа", "close")) return action("meet.close", `«${item.title}» уулзалтыг хаана.`, item.id);
    if (has(q, "устга", "delete")) return action("meet.delete", `«${item.title}» уулзалтын бичлэгийг бүр мөсөн устгана.`, item.id);
  }

  if (has(q, "хөгжим", "music", "трек", "track")) {
    const item = await findTrack(raw);
    if (item && has(q, "устга", "delete", "хас")) return action("track.delete", `«${item.title}» трекийг устгана.`, item.id);
    if (item && has(q, "publish", "нийтэл")) return action("track.update", `«${item.title}» трекийг published болгоно.`, item.id, { status: "published" });
  }

  return { text: "Командын зорилгыг ойлгосон ч яг гүйцэтгэх объект эсвэл параметр дутуу байна. Нэр/ID болон хийх үйлдлээ тодорхой бичнэ үү.", state: "listening" };
}

async function runCustomAction(action: CopilotAction, actor: AdminActor) {
  if (actor.role !== "owner" && actor.role !== "admin") {
    return { ok: false as const, error: "Энэ copilot үйлдэлд OWNER эсвэл ADMIN эрх шаардлагатай." };
  }

  try {
    if (action.kind === "gallery.create") {
      const ref = await addDoc(collection(firebaseDb, "gallery"), { ...(action.payload ?? {}), createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: actor.uid, updatedBy: actor.uid });
      await recordAuditEvent({ actorId: actor.uid, actorRole: actor.role, action: action.kind, target: ref.id, severity: "warning", result: "success" });
      return { ok: true as const };
    }
    if (action.kind === "gallery.update") {
      if (!action.targetId) return { ok: false as const, error: "Gallery item сонгогдоогүй." };
      await updateDoc(doc(firebaseDb, "gallery", action.targetId), { ...(action.payload ?? {}), updatedAt: serverTimestamp(), updatedBy: actor.uid });
      await recordAuditEvent({ actorId: actor.uid, actorRole: actor.role, action: action.kind, target: action.targetId, severity: "info", result: "success" });
      return { ok: true as const };
    }
    if (action.kind === "gallery.delete") {
      if (!action.targetId) return { ok: false as const, error: "Gallery item сонгогдоогүй." };
      await deleteDoc(doc(firebaseDb, "gallery", action.targetId));
      await recordAuditEvent({ actorId: actor.uid, actorRole: actor.role, action: action.kind, target: action.targetId, severity: "critical", result: "success" });
      return { ok: true as const };
    }
    if (action.kind === "meet.delete") {
      if (!action.targetId) return { ok: false as const, error: "Meet сонгогдоогүй." };
      await deleteDoc(doc(firebaseDb, "meets", action.targetId));
      await recordAuditEvent({ actorId: actor.uid, actorRole: actor.role, action: action.kind, target: action.targetId, severity: "critical", result: "success" });
      return { ok: true as const };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Үйлдэл амжилтгүй боллоо.";
    await recordAuditEvent({ actorId: actor.uid, actorRole: actor.role, action: action.kind, target: action.targetId, severity: action.risk === "high" ? "critical" : "warning", result: "failure", detail: "copilot_backend_failure" });
    return { ok: false as const, error: message };
  }
  return { ok: false as const, error: "Дэмжигдээгүй copilot action." };
}

export async function executeAdminCopilotAction(action: CopilotAction, actor: AdminActor | null) {
  if (!actor) return { ok: false as const, error: "Админ нэвтрэлт баталгаажаагүй байна." };
  if (action.kind.startsWith("gallery.") || action.kind === "meet.delete") return runCustomAction(action, actor);
  const result = await dispatchAdminAction({ kind: action.kind as AdminActionKind, targetId: action.targetId, payload: action.payload }, actor);
  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error };
}
