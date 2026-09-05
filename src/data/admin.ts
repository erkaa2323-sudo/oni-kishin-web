/**
 * ONI CONTROL CENTER — admin data boundary.
 *
 * Reads come from the live Lovable Cloud database through the typed service
 * layer. Nothing here fabricates clan records, statistics, meet sessions,
 * audit history or system health — an empty database renders as empty.
 */

import {
  applicationsService,
  garageService,
  meetService,
  membersService,
  musicService,
} from "@/services/domains";
import { listAuditEvents, recordAuditEvent } from "@/services/audit";

/** Lovable Cloud (Postgres + Auth) is the live backend for this project. */
export const ADMIN_BACKEND_CONNECTED = true;
export const ADMIN_AUTH_CONNECTED = true;
/** Deterministic in-app command router (no external AI API, no secrets). */
export const ADMIN_AI_CONNECTED = true;

/** Role/permission model enforced by the UI and mirrored by database policies. */
export type AdminRole = "owner" | "admin" | "moderator";

export type AdminPermission =
  | "members.read"
  | "members.write"
  | "garage.read"
  | "garage.write"
  | "applications.review"
  | "meet.control"
  | "music.write"
  | "system.read"
  | "audit.read"
  | "ai.execute";

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  owner: [
    "members.read",
    "members.write",
    "garage.read",
    "garage.write",
    "applications.review",
    "meet.control",
    "music.write",
    "system.read",
    "audit.read",
    "ai.execute",
  ],
  admin: [
    "members.read",
    "members.write",
    "garage.read",
    "garage.write",
    "applications.review",
    "meet.control",
    "music.write",
    "system.read",
    "audit.read",
  ],
  moderator: ["members.read", "garage.read", "applications.review", "audit.read"],
};

export type AdminModuleId =
  | "overview"
  | "members"
  | "garage"
  | "applications"
  | "meet"
  | "music"
  | "system"
  | "audit"
  | "command";

export type AdminModule = {
  id: AdminModuleId;
  label: string;
  code: string;
  index: string;
  desc: string;
};

export const ADMIN_MODULES: AdminModule[] = [
  {
    id: "overview",
    label: "ЕРӨНХИЙ",
    code: "OVERVIEW",
    index: "00",
    desc: "Үйл ажиллагааны төлөв",
  },
  { id: "members", label: "ГИШҮҮД", code: "MEMBERS", index: "01", desc: "Гишүүдийн бүртгэл" },
  { id: "garage", label: "ГАРАЖ", code: "GARAGE", index: "02", desc: "Автомашины бүртгэл" },
  {
    id: "applications",
    label: "АНКЕТ",
    code: "APPLICATIONS",
    index: "03",
    desc: "Элсэлтийн хүсэлт",
  },
  { id: "meet", label: "УУЛЗАЛТ", code: "MEET CONTROL", index: "04", desc: "Уулзалтын удирдлага" },
  {
    id: "music",
    label: "ХӨГЖИМ / AI",
    code: "MUSIC / AI DATA",
    index: "05",
    desc: "Контент ба мэдлэгийн сан",
  },
  { id: "system", label: "СИСТЕМ", code: "SYSTEM HEALTH", index: "06", desc: "Системийн төлөв" },
  { id: "audit", label: "БҮРТГЭЛ", code: "AUDIT LOG", index: "07", desc: "Үйлдлийн түүх" },
  {
    id: "command",
    label: "ОНИ КОМАНД",
    code: "ONI AI COMMAND",
    index: "08",
    desc: "AI командын самбар",
  },
];

/* ── Connectivity ─────────────────────────────────────────────── */

export type ServiceKey = "backend" | "database" | "auth" | "ai" | "meet" | "storage";

export type ServiceStatus = {
  key: ServiceKey;
  label: string;
  code: string;
  /** "unknown" = frontend cannot truthfully assert anything yet. */
  state: "connected" | "not_connected" | "unknown";
  note: string;
};

export function getServiceStatuses(): ServiceStatus[] {
  return [
    {
      key: "backend",
      label: "СЕРВЕР",
      code: "BACKEND",
      state: ADMIN_BACKEND_CONNECTED ? "connected" : "not_connected",
      note: "Lovable Cloud үйлчилгээ идэвхтэй.",
    },
    {
      key: "database",
      label: "ӨГӨГДЛИЙН САН",
      code: "DATABASE",
      state: ADMIN_BACKEND_CONNECTED ? "connected" : "not_connected",
      note: "Postgres мэдээллийн сан холбогдсон.",
    },
    {
      key: "auth",
      label: "НЭВТРЭЛТ",
      code: "AUTH",
      state: ADMIN_AUTH_CONNECTED ? "connected" : "not_connected",
      note: "Нэвтрэлтийн үйлчилгээ идэвхтэй.",
    },
    {
      key: "ai",
      label: "ОНИ БРЭЙН",
      code: "AI ENGINE",
      state: ADMIN_AI_CONNECTED ? "connected" : "not_connected",
      note: "ОНИ Брэйн идэвхтэй (нийтэд нээлттэй өгөгдөл дээр).",
    },
    {
      key: "meet",
      label: "УУЛЗАЛТ",
      code: "MEET SERVICE",
      state: "unknown",
      note: "Уулзалтын хүснэгт идэвхтэй. Баталгаажуулалтын сервер хараахан идэвхжээгүй.",
    },
    {
      key: "storage",
      label: "ФАЙЛ САН",
      code: "STORAGE",
      state: "unknown",
      note: "Төлөв тодорхойгүй — сервер холбогдоогүй.",
    },
  ];
}

/* ── Domain records (types only; loaders return unavailable) ──── */

export type AdminMemberRecord = {
  id: string;
  cpmNickname: string;
  cpmId: string;
  role: string;
  status: "active" | "inactive" | "archived";
  joinedAt?: string;
};

export type AdminVehicleRecord = {
  id: string;
  model: string;
  owner: string;
  category: string;
  build: string;
  imagePath: string;
  status: "published" | "draft" | "archived";
};

export type AdminApplicationRecord = {
  id: string;
  cpmNickname: string;
  cpmId: string;
  contact: string;
  message: string;
  experience: string;
  submittedAt: string;
  state: "pending" | "accepted" | "rejected";
};

export type AdminMeetRecord = {
  id: string;
  title: string;
  scheduledAt: string;
  registrationClosesAt: string;
  capacity: number;
  status: "draft" | "scheduled" | "live" | "ended" | "closed";
};

export type AdminRegistrationRecord = {
  id: string;
  cpmNickname: string;
  cpmId: string;
  createdAt: string;
};

export type AdminTrackRecord = {
  id: string;
  title: string;
  artist: string;
  source: string;
  sortOrder: number;
  durationSeconds: number;
  status: "published" | "draft";
};

export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  severity: "info" | "warning" | "critical";
};

/** Every admin read resolves to this until the backend phase. */
export type DataResult<T> = { status: "ok"; rows: T[] } | { status: "unavailable"; reason: string };

const UNAVAILABLE = (reason: string) => ({ status: "unavailable" as const, reason });

async function toResult<T, R>(
  load: () => Promise<{ ok: true; data: T[] } | { ok: false; error: { message: string } }>,
  map: (row: T) => R,
): Promise<DataResult<R>> {
  const res = await load();
  if (!res.ok) return UNAVAILABLE(res.error.message);
  return { status: "ok", rows: res.data.map(map) };
}

export async function getMembers(): Promise<DataResult<AdminMemberRecord>> {
  return toResult(membersService.list, (m) => ({
    id: m.id,
    cpmNickname: m.cpmNickname,
    cpmId: m.cpmId,
    role: m.role ?? "",
    status: m.status,
    ...(m.joinedAt ? { joinedAt: m.joinedAt } : {}),
  }));
}

export async function getVehicles(): Promise<DataResult<AdminVehicleRecord>> {
  return toResult(garageService.list, (v) => ({
    id: v.id,
    model: v.model,
    owner: v.ownerName ?? "—",
    category: v.category ?? "",
    build: v.build ?? "",
    imagePath: v.imagePath ?? "",
    status: v.status,
  }));
}

export async function getApplications(): Promise<DataResult<AdminApplicationRecord>> {
  return toResult(applicationsService.list, (a) => ({
    id: a.id,
    cpmNickname: a.cpmNickname,
    cpmId: a.cpmId,
    contact: a.contact,
    message: a.message ?? "",
    experience: a.experience ?? "",
    submittedAt: a.createdAt ?? "",
    state: a.state,
  }));
}

export async function getMeets(): Promise<DataResult<AdminMeetRecord>> {
  return toResult(meetService.list, (m) => ({
    id: m.id,
    title: m.title,
    scheduledAt: m.scheduledAt ?? "",
    registrationClosesAt: m.registrationClosesAt ?? "",
    // Credentials are never fetched with the meet list; they live in a
    // separate admin-only table and are revealed only on explicit request.
    capacity: m.capacity ?? 0,
    status: m.status,
  }));
}

export async function getRegistrations(
  meetId: string,
): Promise<DataResult<AdminRegistrationRecord>> {
  return toResult(
    () => meetService.listRegistrations(meetId),
    (r) => ({
      id: r.id,
      cpmNickname: r.cpmNickname,
      cpmId: r.cpmId,
      createdAt: r.createdAt ?? "",
    }),
  );
}

export async function getTracks(): Promise<DataResult<AdminTrackRecord>> {
  return toResult(musicService.list, (t) => ({
    id: t.id,
    title: t.title,
    artist: t.artist ?? "",
    source: t.sourceUrl ?? "",
    sortOrder: t.sortOrder,
    durationSeconds: t.durationSeconds ?? 0,
    status: t.status,
  }));
}

export async function getAuditEvents(): Promise<DataResult<AuditEvent>> {
  return toResult(
    () => listAuditEvents(100),
    (e) => ({
      id: e.id,
      at: e.createdAt ?? "",
      actor: e.actorRole,
      action: e.action,
      target: e.target ?? "—",
      severity: e.severity,
    }),
  );
}

/* ── Mutation action model (not persisted yet) ────────────────── */

export type AdminActionKind =
  | "member.create"
  | "member.update"
  | "member.archive"
  | "member.delete"
  | "vehicle.create"
  | "vehicle.update"
  | "vehicle.archive"
  | "vehicle.delete"
  | "application.accept"
  | "application.reject"
  | "application.promote"
  | "meet.create"
  | "meet.update"
  | "meet.start"
  | "meet.end"
  | "meet.close"
  | "meet.rotate_credentials"
  | "meet.registration_remove"
  | "track.create"
  | "track.update"
  | "track.delete"
  | "prompt.update";

export type RiskLevel = "low" | "medium" | "high";

export const ACTION_RISK: Partial<Record<AdminActionKind, RiskLevel>> = {
  "member.delete": "high",
  "vehicle.delete": "high",
  "track.delete": "high",
  "meet.end": "high",
  "meet.close": "high",
  "meet.rotate_credentials": "high",
  "meet.registration_remove": "medium",
  "member.archive": "medium",
  "application.promote": "medium",
  "vehicle.archive": "medium",
  "application.reject": "medium",
  "application.accept": "medium",
  "meet.start": "medium",
};

export type AdminActionRequest = {
  kind: AdminActionKind;
  targetId?: string;
  payload?: Record<string, unknown>;
};

export type AdminActionResult = { ok: true; auditEventId: string } | { ok: false; error: string };

export type AdminActor = { uid: string; role: AdminRole };

/** Permission required for each action — mirrored by database RLS policies. */
const ACTION_PERMISSION: Record<AdminActionKind, AdminPermission> = {
  "member.create": "members.write",
  "member.update": "members.write",
  "member.archive": "members.write",
  "member.delete": "members.write",
  "vehicle.create": "garage.write",
  "vehicle.update": "garage.write",
  "vehicle.archive": "garage.write",
  "vehicle.delete": "garage.write",
  "application.accept": "applications.review",
  "application.reject": "applications.review",
  "application.promote": "members.write",
  "meet.create": "meet.control",
  "meet.update": "meet.control",
  "meet.start": "meet.control",
  "meet.end": "meet.control",
  "meet.close": "meet.control",
  "meet.rotate_credentials": "meet.control",
  "meet.registration_remove": "meet.control",
  "track.create": "music.write",
  "track.update": "music.write",
  "track.delete": "music.write",
  "prompt.update": "music.write",
};

const NOT_IN_PHASE = "Энэ үйлдэл дараагийн үе шатанд (уулзалтын сервер) идэвхжинэ.";

function severityFor(kind: AdminActionKind): "info" | "warning" | "critical" {
  const risk = ACTION_RISK[kind];
  if (risk === "high") return "critical";
  if (risk === "medium") return "warning";
  return "info";
}

/**
 * Single admin mutation pathway. Every call is permission-checked in the UI
 * layer AND by database policies, then written to the audit log. Payload
 * contents are never logged — only the action kind and target id.
 */
export async function dispatchAdminAction(
  request: AdminActionRequest,
  actor: AdminActor | null,
): Promise<AdminActionResult> {
  const { kind, targetId, payload } = request;

  if (!actor) return { ok: false, error: "Нэвтрэлт баталгаажаагүй байна." };

  const needed = ACTION_PERMISSION[kind];
  if (!ROLE_PERMISSIONS[actor.role].includes(needed)) {
    await recordAuditEvent({
      actorId: actor.uid,
      actorRole: actor.role,
      action: kind,
      target: targetId ?? undefined,
      severity: severityFor(kind),
      result: "denied",
      detail: "insufficient_permission",
    });
    return { ok: false, error: "Энэ үйлдэлд эрх хүрэхгүй байна." };
  }

  const { applicationsService, garageService, membersService, meetService, musicService } =
    await import("@/services/domains");

  const needsTarget =
    kind !== "member.create" &&
    kind !== "vehicle.create" &&
    kind !== "track.create" &&
    kind !== "meet.create";
  if (needsTarget && !targetId) {
    return { ok: false, error: "Зорилтот бичлэг сонгогдоогүй байна." };
  }

  const data = (payload ?? {}) as Record<string, unknown>;
  let res: { ok: true; data: { id: string } } | { ok: false; error: { message: string } };

  switch (kind) {
    case "member.create":
      res = await membersService.create({ ...data, created_by: actor.uid, updated_by: actor.uid });
      break;
    case "member.update":
      res = await membersService.update(targetId!, { ...data, updated_by: actor.uid });
      break;
    case "member.archive":
      res = await membersService.update(targetId!, { status: "archived", updated_by: actor.uid });
      break;
    case "member.delete":
      res = await membersService.remove(targetId!);
      break;
    case "vehicle.create":
      res = await garageService.create({ ...data, created_by: actor.uid, updated_by: actor.uid });
      break;
    case "vehicle.update":
      res = await garageService.update(targetId!, { ...data, updated_by: actor.uid });
      break;
    case "vehicle.archive":
      res = await garageService.update(targetId!, { status: "archived", updated_by: actor.uid });
      break;
    case "vehicle.delete":
      res = await garageService.remove(targetId!);
      break;
    case "application.accept":
      res = await applicationsService.review(targetId!, "accepted", actor.uid);
      break;
    case "application.reject":
      res = await applicationsService.review(targetId!, "rejected", actor.uid);
      break;
    case "application.promote": {
      const nickname = typeof data["cpm_nickname"] === "string" ? data["cpm_nickname"] : "";
      const cpmId = typeof data["cpm_id"] === "string" ? data["cpm_id"] : "";
      if (!nickname || !cpmId) {
        return { ok: false, error: "Анкетын мэдээлэл дутуу тул гишүүн үүсгэх боломжгүй." };
      }
      res = await membersService.create({
        cpm_nickname: nickname,
        cpm_id: cpmId,
        status: "active",
        joined_at: new Date().toISOString(),
        created_by: actor.uid,
        updated_by: actor.uid,
      });
      break;
    }
    case "meet.create":
      res = await meetService.create({
        title: data["title"] ?? "",
        scheduled_at: data["scheduled_at"] ?? null,
        registration_closes_at: data["registration_closes_at"] ?? null,
        capacity: data["capacity"] ?? null,
        status: data["status"] ?? "draft",
        created_by: actor.uid,
        updated_by: actor.uid,
      });
      break;
    case "meet.update":
      res = await meetService.update(targetId!, {
        title: data["title"] ?? "",
        scheduled_at: data["scheduled_at"] ?? null,
        registration_closes_at: data["registration_closes_at"] ?? null,
        capacity: data["capacity"] ?? null,
        updated_by: actor.uid,
      });
      break;
    case "meet.start":
      res = await meetService.setLifecycle(targetId!, "live");
      break;
    case "meet.end":
      res = await meetService.setLifecycle(targetId!, "ended");
      break;
    case "meet.close":
      res = await meetService.setLifecycle(targetId!, "closed");
      break;
    case "meet.rotate_credentials": {
      // Credential values are never placed in the audit detail.
      const roomId = typeof data["room_id"] === "string" ? data["room_id"] : "";
      const password = typeof data["room_password"] === "string" ? data["room_password"] : "";
      if (!roomId || !password) {
        return { ok: false, error: "ROOM ID болон нууц үг заавал шаардлагатай." };
      }
      res = await meetService.setCredentials(targetId!, roomId, password);
      break;
    }
    case "meet.registration_remove":
      res = await meetService.removeRegistration(targetId!);
      break;
    case "track.create":
      res = await musicService.create({ ...data, created_by: actor.uid, updated_by: actor.uid });
      break;
    case "track.update":
      res = await musicService.update(targetId!, { ...data, updated_by: actor.uid });
      break;
    case "track.delete":
      res = await musicService.remove(targetId!);
      break;
    default:
      return { ok: false, error: NOT_IN_PHASE };
  }

  if (!res.ok) {
    await recordAuditEvent({
      actorId: actor.uid,
      actorRole: actor.role,
      action: kind,
      target: targetId ?? undefined,
      severity: severityFor(kind),
      result: "failure",
      detail: "rejected_by_backend",
    });
    return { ok: false, error: res.error.message };
  }

  const audit = await recordAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: kind,
    target: targetId ?? res.data.id,
    severity: severityFor(kind),
    result: "success",
  });

  return { ok: true, auditEventId: audit.ok ? audit.data.id : "" };
}

/* ── ONI AI COMMAND ───────────────────────────────────────────── */

export type CommandTier = "read" | "prepare" | "execute";

export const COMMAND_TIERS: { id: CommandTier; label: string; code: string; desc: string }[] = [
  {
    id: "read",
    label: "УНШИХ",
    code: "READ",
    desc: "Зөвхөн хайх, шалгах, хураангуйлах. Өөрчлөлт хийхгүй.",
  },
  {
    id: "prepare",
    label: "БЭЛТГЭХ",
    code: "PREPARE",
    desc: "Санал болгох үйлдлийн төлөвлөгөө боловсруулж, хянуулна.",
  },
  {
    id: "execute",
    label: "ГҮЙЦЭТГЭХ",
    code: "EXECUTE",
    desc: "Эмзэг үйлдлийг зөвхөн админ баталгаажуулсны дараа гүйцэтгэнэ.",
  },
];

export type ProposedAction = {
  kind: AdminActionKind;
  summary: string;
  risk: RiskLevel;
  missingParams: string[];
};

export type CommandPlan = {
  id: string;
  tier: CommandTier;
  /** Concise rationale/status only — never chain-of-thought. */
  rationale: string;
  actions: ProposedAction[];
  requiresConfirmation: boolean;
};

export type CommandResponse =
  | { status: "offline"; message: string }
  | { status: "plan"; plan: CommandPlan }
  | { status: "error"; message: string };

export const COMMAND_SUGGESTIONS: { tier: CommandTier; text: string }[] = [
  { tier: "read", text: "Хүлээгдэж буй анкетуудыг шалга" },
  { tier: "read", text: "Идэвхтэй уулзалт байгаа эсэхийг шалга" },
  { tier: "prepare", text: "Маргаашийн уулзалт үүсгэх төлөвлөгөө бэлтгэ" },
  { tier: "prepare", text: "Идэвхгүй гишүүдийг архивлах саналыг бэлтгэ" },
];

/**
 * Deterministic admin command router.
 *
 * READ → live summaries through the existing permission-checked services.
 * PREPARE → proposed actions only; nothing is ever mutated here.
 * EXECUTE → still returns a plan; the UI routes each action through the
 * existing confirmation modal → dispatchAdminAction (RBAC + audit).
 * Meet ROOM ID / password are never read or echoed by this router.
 */
export async function submitCommand(input: string, tier: CommandTier): Promise<CommandResponse> {
  const raw = input.trim();
  if (!raw) return { status: "error", message: "Команд хоосон байна." };
  const q = raw.toLowerCase();

  if (/(pass|нууц\s*үг|password|room\s*id|өрөө.*(id|код))/i.test(raw)) {
    return {
      status: "error",
      message:
        "Уулзалтын ROOM ID / нууц үгийг командын самбараар харуулахгүй. УУЛЗАЛТ модулиас эрх шалгасны дараа удирдана.",
    };
  }

  const id = `cmd${Date.now()}`;
  const hit = (...w: string[]) => w.some((x) => q.includes(x));

  /* ── READ ── */
  if (hit("анкет", "application", "хүсэлт")) {
    const r = await getApplications();
    if (r.status !== "ok") return { status: "error", message: r.reason };
    const pending = r.rows.filter((a) => a.state === "pending");
    const rationale = `Нийт анкет: ${r.rows.length} · Хүлээгдэж буй: ${pending.length} · Зөвшөөрсөн: ${
      r.rows.filter((a) => a.state === "accepted").length
    } · Татгалзсан: ${r.rows.filter((a) => a.state === "rejected").length}.`;
    const actions: ProposedAction[] =
      tier === "read" || pending.length === 0
        ? []
        : [
            {
              kind: "application.accept",
              summary: `Хүлээгдэж буй анкет: ${pending[0]!.cpmNickname} — зөвшөөрөх санал.`,
              risk: ACTION_RISK["application.accept"] ?? "low",
              missingParams: pending.length > 1 ? ["аль анкетыг сонгохыг тодруулна уу"] : [],
            },
          ];
    return {
      status: "plan",
      plan: {
        id,
        tier,
        rationale,
        actions,
        requiresConfirmation: actions.length > 0,
      },
    };
  }

  if (hit("уулзалт", "meet")) {
    const r = await getMeets();
    if (r.status !== "ok") return { status: "error", message: r.reason };
    const live = r.rows.filter((m) => m.status === "live" || m.status === "scheduled");
    const rationale =
      live.length === 0
        ? `Идэвхтэй уулзалт алга. Нийт бүртгэл: ${r.rows.length}.`
        : `Идэвхтэй/төлөвлөгдсөн уулзалт: ${live
            .map((m) => `«${m.title}» (${m.status})`)
            .join(", ")}. Нийт: ${r.rows.length}.`;
    const actions: ProposedAction[] =
      tier === "read"
        ? []
        : [
            {
              kind: "meet.create",
              summary: "Шинэ уулзалт үүсгэх — гарчиг, эхлэх цаг, багтаамж шаардлагатай.",
              risk: ACTION_RISK["meet.create"] ?? "low",
              missingParams: ["гарчиг", "эхлэх цаг", "багтаамж"],
            },
          ];
    return {
      status: "plan",
      plan: { id, tier, rationale, actions, requiresConfirmation: actions.length > 0 },
    };
  }

  if (hit("гишүү", "member", "крю")) {
    const r = await getMembers();
    if (r.status !== "ok") return { status: "error", message: r.reason };
    const active = r.rows.filter((m) => m.status === "active").length;
    const rationale = `Гишүүд: нийт ${r.rows.length} · идэвхтэй ${active} · архивлагдсан ${
      r.rows.filter((m) => m.status === "archived").length
    }.`;
    const actions: ProposedAction[] =
      tier === "read"
        ? []
        : [
            {
              kind: "member.archive",
              summary: "Идэвхгүй гишүүнийг архивлах — аль гишүүнийг архивлахыг заана уу.",
              risk: ACTION_RISK["member.archive"] ?? "low",
              missingParams: ["гишүүний нэр эсвэл ID"],
            },
          ];
    return {
      status: "plan",
      plan: { id, tier, rationale, actions, requiresConfirmation: actions.length > 0 },
    };
  }

  if (hit("гараж", "garage", "машин")) {
    const r = await getVehicles();
    if (r.status !== "ok") return { status: "error", message: r.reason };
    const rationale = `Машин: нийт ${r.rows.length} · нийтэлсэн ${
      r.rows.filter((v) => v.status === "published").length
    } · ноорог ${r.rows.filter((v) => v.status === "draft").length}.`;
    return {
      status: "plan",
      plan: { id, tier, rationale, actions: [], requiresConfirmation: false },
    };
  }

  if (hit("хөгжим", "music", "трек")) {
    const r = await getTracks();
    if (r.status !== "ok") return { status: "error", message: r.reason };
    const rationale = `Трек: нийт ${r.rows.length} · нийтэлсэн ${
      r.rows.filter((t) => t.status === "published").length
    }.`;
    return {
      status: "plan",
      plan: { id, tier, rationale, actions: [], requiresConfirmation: false },
    };
  }

  if (hit("төлөв", "статус", "status", "хураангуй", "overview")) {
    const [m, v, a, t] = await Promise.all([
      getMembers(),
      getVehicles(),
      getApplications(),
      getTracks(),
    ]);
    const c = <T>(r: DataResult<T>) => (r.status === "ok" ? String(r.rows.length) : "—");
    return {
      status: "plan",
      plan: {
        id,
        tier,
        rationale: `Гишүүд: ${c(m)} · Машин: ${c(v)} · Анкет: ${c(a)} · Трек: ${c(t)}.`,
        actions: [],
        requiresConfirmation: false,
      },
    };
  }

  return {
    status: "error",
    message:
      "Командыг таньсангүй. Дэмжигдсэн: анкет, гишүүд, гараж, хөгжим, уулзалт, ерөнхий төлөв.",
  };
}
