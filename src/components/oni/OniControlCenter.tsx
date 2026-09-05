import { useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BrainCircuit,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import {
  ACTION_RISK,
  ADMIN_AI_CONNECTED,
  ADMIN_MODULES,
  COMMAND_SUGGESTIONS,
  COMMAND_TIERS,
  dispatchAdminAction,
  getApplications,
  getAuditEvents,
  getMeets,
  getRegistrations,
  getMembers,
  getServiceStatuses,
  getTracks,
  getVehicles,
  submitCommand,
  type AdminActionKind,
  type AdminModuleId,
  type CommandResponse,
  type AdminActor,
  type AdminApplicationRecord,
  type AdminMeetRecord,
  type AdminMemberRecord,
  type AdminRegistrationRecord,
  type AdminTrackRecord,
  type AdminVehicleRecord,
  type CommandTier,
  type DataResult,
  type RiskLevel,
} from "@/data/admin";
import { hasPermission } from "@/services/admin-profiles";
import type { AdminPermission } from "@/data/admin";
import { useOniAuth } from "@/hooks/useOniAuth";
import { OniHudNav } from "./OniHudNav";

const fieldClass =
  "w-full min-h-[44px] border border-border bg-ink/70 px-3 py-2.5 text-sm tracking-wide text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-crimson/70 focus:outline-none";

const btnClass =
  "inline-flex min-h-[44px] items-center gap-2 border border-border bg-ink/60 px-3.5 text-[0.65rem] font-semibold tracking-[0.18em] text-muted-foreground transition-colors clip-notch hover:border-crimson/60 hover:text-foreground";

/* ── shared bits ──────────────────────────────────────────────── */

function StateDot({ state }: { state: "connected" | "not_connected" | "unknown" }) {
  const cls =
    state === "connected"
      ? "bg-emerald-400"
      : state === "unknown"
        ? "bg-muted-foreground"
        : "bg-crimson";
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cls}`} />;
}

function PanelHead({
  code,
  title,
  desc,
  children,
}: {
  code: string;
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div className="min-w-0">
        <span className="hud-label block text-crimson/85">{code}</span>
        <h2 className="mt-1.5 text-cinema text-2xl text-foreground sm:text-3xl">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

function OfflineNotice({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 border border-crimson/35 bg-crimson/10 p-4">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-crimson" />
      <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function EmptyData<T>({ result }: { result: DataResult<T> | null }) {
  if (!result) {
    return (
      <div className="flex items-center gap-2 border border-border bg-ink/50 p-8 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Ачаалж байна…
      </div>
    );
  }
  if (result.status === "unavailable") {
    return (
      <div className="border border-dashed border-border bg-ink/40 p-8 text-center">
        <span className="hud-label block text-muted-foreground">DATA UNAVAILABLE</span>
        <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">
          {result.reason}
        </p>
      </div>
    );
  }
  return null;
}

/* ── confirmation architecture ────────────────────────────────── */

type Confirmation = {
  kind: AdminActionKind;
  targetId?: string;
  payload?: Record<string, unknown>;
  title: string;
  body: string;
  risk: RiskLevel;
  onDone?: () => void;
};

function ConfirmDialog({
  confirmation,
  actor,
  onCancel,
}: {
  confirmation: Confirmation | null;
  actor: AdminActor | null;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    setBusy(false);
    setResult(null);
  }, [confirmation]);

  if (!confirmation) return null;

  const run = async () => {
    setBusy(true);
    const r = await dispatchAdminAction(
      {
        kind: confirmation.kind,
        ...(confirmation.targetId ? { targetId: confirmation.targetId } : {}),
        ...(confirmation.payload ? { payload: confirmation.payload } : {}),
      },
      actor,
    );
    setBusy(false);
    setResult(r.ok ? "Гүйцэтгэлээ." : r.error);
    if (r.ok) confirmation.onDone?.();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-ink/90 backdrop-blur-md" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={confirmation.title}
        className="relative w-full max-w-md border border-crimson/40 bg-midnight/95 p-5 clip-notch"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-crimson" />
          <span className="hud-label text-crimson/85">
            RISK / {confirmation.risk.toUpperCase()}
          </span>
        </div>
        <h3 className="mt-3 text-cinema text-2xl text-foreground">{confirmation.title}</h3>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{confirmation.body}</p>
        {result ? (
          <p className="mt-4 border border-border bg-ink/60 p-3 text-xs text-muted-foreground">
            {result}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={onCancel} className={btnClass}>
            БОЛИХ
          </button>
          <button
            type="button"
            onClick={run}
            disabled={busy || !!result}
            className="inline-flex min-h-[44px] items-center gap-2 border border-crimson/60 bg-crimson/20 px-4 text-[0.65rem] font-semibold tracking-[0.18em] text-foreground transition-colors clip-notch hover:bg-crimson/30 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            БАТАЛГААЖУУЛАХ
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── generic CRUD workspace (members / garage / music) ────────── */

type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "datetime-local";
  options?: { value: string; label: string }[];
  required?: boolean;
  max?: number;
};

type CrudRow = { id: string; [k: string]: unknown };

function FormFields({
  fields,
  draft,
  setDraft,
}: {
  fields: FieldDef[];
  draft: Record<string, string>;
  setDraft: (d: Record<string, string>) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <label key={f.key} className="block min-w-0">
          <span className="hud-label block text-muted-foreground">
            {f.label}
            {f.required ? " *" : ""}
          </span>
          {f.options ? (
            <select
              value={draft[f.key] ?? ""}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              className={`${fieldClass} mt-2`}
            >
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={f.type ?? "text"}
              value={draft[f.key] ?? ""}
              maxLength={f.max ?? 200}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              className={`${fieldClass} mt-2`}
            />
          )}
        </label>
      ))}
    </div>
  );
}

function CrudWorkspace({
  code,
  title,
  desc,
  statusKey,
  filters,
  fields,
  load,
  primary,
  secondary,
  kinds,
  actor,
  permission,
  onDestructive,
  supportsArchive = true,
}: {
  code: string;
  title: string;
  desc: string;
  statusKey: string;
  filters: { value: string; label: string }[];
  fields: FieldDef[];
  load: () => Promise<DataResult<CrudRow>>;
  primary: (r: CrudRow) => string;
  secondary: (r: CrudRow) => string;
  kinds: {
    create: AdminActionKind;
    update: AdminActionKind;
    archive?: AdminActionKind;
    remove: AdminActionKind;
  };
  actor: AdminActor | null;
  permission: AdminPermission;
  onDestructive: (c: Confirmation) => void;
  supportsArchive?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [result, setResult] = useState<DataResult<CrudRow> | null>(null);
  const [editing, setEditing] = useState<CrudRow | "new" | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const canWrite = hasPermission(actor ? { uid: actor.uid, role: actor.role } : null, permission);

  useEffect(() => {
    let alive = true;
    setResult(null);
    load().then((r) => alive && setResult(r));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, reloadKey]);

  const refresh = () => setReloadKey((k) => k + 1);

  const rows =
    result && result.status === "ok"
      ? result.rows.filter((r) => {
          const okFilter = filter === "all" || String(r[statusKey] ?? "") === filter;
          const q = query.trim().toLowerCase();
          const okQuery = !q || `${primary(r)} ${secondary(r)}`.toLowerCase().includes(q);
          return okFilter && okQuery;
        })
      : [];

  const openNew = () => {
    const d: Record<string, string> = {};
    fields.forEach((f) => (d[f.key] = f.options?.[0]?.value ?? ""));
    setDraft(d);
    setNotice("");
    setEditing("new");
  };

  const openEdit = (row: CrudRow) => {
    const d: Record<string, string> = {};
    fields.forEach((f) => (d[f.key] = row[f.key] == null ? "" : String(row[f.key])));
    setDraft(d);
    setNotice("");
    setEditing(row);
  };

  const save = async () => {
    const missing = fields.filter((f) => f.required && !(draft[f.key] ?? "").trim());
    if (missing.length) {
      setNotice(`Заавал бөглөх талбар дутуу: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }
    const payload: Record<string, unknown> = {};
    fields.forEach((f) => {
      const raw = (draft[f.key] ?? "").trim();
      if (f.type === "number") payload[f.key] = raw ? Number(raw) : null;
      else if (f.type === "datetime-local")
        payload[f.key] = raw ? new Date(raw).toISOString() : null;
      else payload[f.key] = raw || null;
    });
    setBusy(true);
    const isNew = editing === "new";
    const r = await dispatchAdminAction(
      isNew
        ? { kind: kinds.create, payload }
        : { kind: kinds.update, targetId: (editing as CrudRow).id, payload },
      actor,
    );
    setBusy(false);
    if (!r.ok) {
      setNotice(r.error);
      return;
    }
    setEditing(null);
    refresh();
  };

  return (
    <div className="space-y-5">
      <PanelHead code={code} title={title} desc={desc}>
        <button type="button" className={btnClass} onClick={refresh}>
          <RefreshCw className="h-4 w-4" /> ШИНЭЧЛЭХ
        </button>
        <button type="button" className={btnClass} onClick={openNew} disabled={!canWrite}>
          <Plus className="h-4 w-4" /> ШИНЭ
        </button>
      </PanelHead>

      {!canWrite ? (
        <OfflineNotice text="Таны эрх энэ бүртгэлийг зөвхөн харах боломж олгоно. Засвар, устгал хийх эрх байхгүй." />
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Хайх</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Хайх…"
            className={`${fieldClass} pl-10`}
          />
        </label>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={`min-h-[44px] shrink-0 border px-3.5 text-[0.6rem] tracking-[0.2em] transition-colors clip-notch ${
                filter === f.value
                  ? "border-crimson/60 bg-crimson/15 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <EmptyData result={result} />

      {result && result.status === "ok" ? (
        rows.length ? (
          <ul className="space-y-px bg-border">
            {rows.map((row) => (
              <li key={row.id} className="bg-ink/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm tracking-[0.12em] text-foreground">
                      {primary(row)}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{secondary(row)}</p>
                  </div>
                  <span className="hud-label shrink-0 text-crimson/80">
                    {String(row[statusKey] ?? "")}
                  </span>
                </div>
                {canWrite ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={btnClass} onClick={() => openEdit(row)}>
                      ЗАСАХ
                    </button>
                    {supportsArchive && kinds.archive ? (
                      <button
                        type="button"
                        className={btnClass}
                        onClick={() =>
                          onDestructive({
                            kind: kinds.archive!,
                            targetId: row.id,
                            title: "АРХИВЛАХ УУ?",
                            body: `${primary(row)} — архивлагдана. Нийтэд харагдахаа болино.`,
                            risk: ACTION_RISK[kinds.archive!] ?? "medium",
                            onDone: refresh,
                          })
                        }
                      >
                        <Archive className="h-4 w-4" /> АРХИВ
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={`${btnClass} border-crimson/40 text-crimson`}
                      onClick={() =>
                        onDestructive({
                          kind: kinds.remove,
                          targetId: row.id,
                          title: "БҮРМӨСӨН УСТГАХ УУ?",
                          body: `${primary(row)} — устгагдана. Энэ үйлдэл сэргээгдэхгүй.`,
                          risk: ACTION_RISK[kinds.remove] ?? "high",
                          onDone: refresh,
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" /> УСТГАХ
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="border border-dashed border-border bg-ink/40 p-8 text-center">
            <span className="hud-label block text-muted-foreground">NO RECORDS</span>
            <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Тохирох бичлэг алга. Өгөгдлийн сан хоосон эсвэл шүүлтүүрт тохирохгүй байна.
            </p>
          </div>
        )
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
          <div
            className="absolute inset-0 bg-ink/90 backdrop-blur-md"
            onClick={() => setEditing(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editing === "new" ? "Шинэ бичлэг" : "Бичлэг засах"}
            className="relative max-h-[85svh] w-full max-w-lg overflow-y-auto border border-border bg-midnight/95 p-5 clip-notch"
          >
            <h3 className="text-cinema text-2xl text-foreground">
              {editing === "new" ? "ШИНЭ БИЧЛЭГ" : "БИЧЛЭГ ЗАСАХ"}
            </h3>
            <div className="mt-4">
              <FormFields fields={fields} draft={draft} setDraft={setDraft} />
            </div>
            {notice ? (
              <p className="mt-4 border border-crimson/40 bg-crimson/10 p-3 text-xs text-crimson">
                {notice}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className={btnClass} onClick={() => setEditing(null)}>
                БОЛИХ
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy}
                className="inline-flex min-h-[44px] items-center gap-2 border border-crimson/60 bg-crimson/20 px-4 text-[0.65rem] font-semibold tracking-[0.18em] text-foreground transition-colors clip-notch hover:bg-crimson/30 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                ХАДГАЛАХ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── modules ──────────────────────────────────────────────────── */

function OverviewModule() {
  const services = useMemo(() => getServiceStatuses(), []);
  return (
    <div className="space-y-5">
      <PanelHead
        code="OVERVIEW"
        title="ҮЙЛ АЖИЛЛАГААНЫ ТӨЛӨВ"
        desc="Зөвхөн бодитоор мэдэгдэж буй төлөв харуулна. Тоон үзүүлэлт зохиомжлохгүй."
      />
      <OfflineNotice text="Өгөгдлийн сан болон нэвтрэлт холбогдсон. ONI BRAIN болон уулзалтын сервер хараахан идэвхжээгүй тул тэдгээрийн үзүүлэлт харагдахгүй." />
      <ul className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
        {services.map((s) => (
          <li key={s.key} className="bg-ink/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="hud-label text-muted-foreground">{s.code}</span>
              <StateDot state={s.state} />
            </div>
            <p className="mt-2 text-sm tracking-[0.12em] text-foreground">{s.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.note}</p>
          </li>
        ))}
      </ul>
      <div className="border border-border bg-ink/40 p-5">
        <span className="hud-label text-muted-foreground">RECENT ACTIVITY</span>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Админ үйлдлийн түүхийг ҮЙЛДЛИЙН БҮРТГЭЛ хэсгээс бүрэн эхээр нь харна уу.
        </p>
      </div>
    </div>
  );
}

function ApplicationsModule({
  actor,
  onDestructive,
}: {
  actor: AdminActor | null;
  onDestructive: (c: Confirmation) => void;
}) {
  const tabs: { value: AdminApplicationRecord["state"]; label: string }[] = [
    { value: "pending", label: "ХҮЛЭЭГДЭЖ БУЙ" },
    { value: "accepted", label: "БАТЛАГДСАН" },
    { value: "rejected", label: "ТАТГАЛЗСАН" },
  ];
  const [tab, setTab] = useState<AdminApplicationRecord["state"]>("pending");
  const [result, setResult] = useState<DataResult<AdminApplicationRecord> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  const profile = actor ? { uid: actor.uid, role: actor.role } : null;
  const canReview = hasPermission(profile, "applications.review");
  const canCreateMember = hasPermission(profile, "members.write");

  useEffect(() => {
    let alive = true;
    setResult(null);
    getApplications().then((r) => alive && setResult(r));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const refresh = () => setReloadKey((k) => k + 1);

  const review = async (row: AdminApplicationRecord, accept: boolean) => {
    setBusyId(row.id);
    setNotice("");
    const r = await dispatchAdminAction(
      { kind: accept ? "application.accept" : "application.reject", targetId: row.id },
      actor,
    );
    setBusyId("");
    if (!r.ok) setNotice(r.error);
    else refresh();
  };

  const rows = result && result.status === "ok" ? result.rows.filter((r) => r.state === tab) : [];

  return (
    <div className="space-y-5">
      <PanelHead
        code="APPLICATIONS"
        title="ЭЛСЭЛТИЙН ХҮСЭЛТ"
        desc="Бодит анкетууд. Батлах болон гишүүн үүсгэх нь тусдаа, тодорхой хоёр үйлдэл."
      >
        <button type="button" className={btnClass} onClick={refresh}>
          <RefreshCw className="h-4 w-4" /> ШИНЭЧЛЭХ
        </button>
      </PanelHead>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            aria-pressed={tab === t.value}
            className={`min-h-[44px] shrink-0 border px-3.5 text-[0.6rem] tracking-[0.2em] transition-colors clip-notch ${
              tab === t.value
                ? "border-crimson/60 bg-crimson/15 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <EmptyData result={result} />
      {notice ? (
        <p className="border border-crimson/40 bg-crimson/10 p-3 text-xs text-crimson">{notice}</p>
      ) : null}

      {result && result.status === "ok" ? (
        rows.length ? (
          <ul className="space-y-px bg-border">
            {rows.map((row) => (
              <li key={row.id} className="bg-ink/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm tracking-[0.12em] text-foreground">
                      {row.cpmNickname}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      CPM ID {row.cpmId} · {row.contact}
                    </p>
                  </div>
                  <span className="hud-label shrink-0 text-crimson/80">{row.state}</span>
                </div>
                {row.experience ? (
                  <p className="mt-2 text-xs text-muted-foreground">{row.experience}</p>
                ) : null}
                {row.message ? (
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                    {row.message}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.state === "pending" && canReview ? (
                    <>
                      <button
                        type="button"
                        className={btnClass}
                        disabled={busyId === row.id}
                        onClick={() => void review(row, true)}
                      >
                        {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        БАТЛАХ
                      </button>
                      <button
                        type="button"
                        className={`${btnClass} border-crimson/40 text-crimson`}
                        disabled={busyId === row.id}
                        onClick={() => void review(row, false)}
                      >
                        ТАТГАЛЗАХ
                      </button>
                    </>
                  ) : null}
                  {row.state === "accepted" && canCreateMember ? (
                    <button
                      type="button"
                      className={btnClass}
                      onClick={() =>
                        onDestructive({
                          kind: "application.promote",
                          targetId: row.id,
                          payload: { cpm_nickname: row.cpmNickname, cpm_id: row.cpmId },
                          title: "ГИШҮҮН ҮҮСГЭХ ҮҮ?",
                          body: `${row.cpmNickname} (CPM ID ${row.cpmId}) идэвхтэй гишүүнээр бүртгэгдэнэ.`,
                          risk: "medium",
                          onDone: refresh,
                        })
                      }
                    >
                      <Plus className="h-4 w-4" /> ГИШҮҮН ҮҮСГЭХ
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="border border-dashed border-border bg-ink/40 p-8 text-center">
            <span className="hud-label block text-muted-foreground">NO APPLICATIONS</span>
            <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Энэ төлөвт анкет алга.
            </p>
          </div>
        )
      ) : null}
    </div>
  );
}

function MeetModule({
  actor,
  onDestructive,
}: {
  actor: AdminActor | null;
  onDestructive: (c: Confirmation) => void;
}) {
  const uid = useId();
  const [reveal, setReveal] = useState(false);
  const [result, setResult] = useState<DataResult<AdminMeetRecord> | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [regs, setRegs] = useState<DataResult<AdminRegistrationRecord> | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    scheduled_at: "",
    registration_closes_at: "",
    capacity: "",
  });
  const [creds, setCreds] = useState({ room_id: "", room_password: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = () => setReloadKey((k) => k + 1);

  const canWrite = hasPermission(
    actor ? { uid: actor.uid, role: actor.role } : null,
    "meet.control",
  );

  useEffect(() => {
    let alive = true;
    setResult(null);
    getMeets().then((r) => {
      if (!alive) return;
      setResult(r);
      if (r.status === "ok" && r.rows.length && !selected) setSelected(r.rows[0]!.id);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    setRegs(null);
    getRegistrations(selected).then((r) => alive && setRegs(r));
    return () => {
      alive = false;
    };
  }, [selected, reloadKey]);

  const meets = result && result.status === "ok" ? result.rows : [];
  const current = meets.find((m) => m.id === selected) ?? null;

  const toLocal = (iso: string) => (iso ? iso.slice(0, 16) : "");
  const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

  useEffect(() => {
    if (!current) return;
    setDraft({
      title: current.title,
      scheduled_at: toLocal(current.scheduledAt),
      registration_closes_at: toLocal(current.registrationClosesAt),
      capacity: current.capacity ? String(current.capacity) : "",
    });
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMeet = async (mode: "create" | "update") => {
    if (!draft.title.trim()) {
      setNotice("Уулзалтын нэр заавал шаардлагатай.");
      return;
    }
    setBusy(true);
    setNotice("");
    const payload = {
      title: draft.title.trim(),
      scheduled_at: toIso(draft.scheduled_at),
      registration_closes_at: toIso(draft.registration_closes_at),
      capacity: draft.capacity ? Number(draft.capacity) : null,
      ...(mode === "create" ? { status: "scheduled" } : {}),
    };
    const r = await dispatchAdminAction(
      mode === "create"
        ? { kind: "meet.create", payload }
        : { kind: "meet.update", targetId: selected, payload },
      actor,
    );
    setBusy(false);
    if (!r.ok) {
      setNotice(r.error);
      return;
    }
    refresh();
  };

  const saveCreds = async () => {
    if (!selected) return;
    setBusy(true);
    setNotice("");
    const r = await dispatchAdminAction(
      {
        kind: "meet.rotate_credentials",
        targetId: selected,
        payload: { room_id: creds.room_id.trim(), room_password: creds.room_password },
      },
      actor,
    );
    setBusy(false);
    setNotice(r.ok ? "Өрөөний мэдээлэл хадгалагдлаа." : r.error);
    if (r.ok) setCreds({ room_id: "", room_password: "" });
  };

  const lifecycle = (kind: AdminActionKind, title: string, body: string, risk: RiskLevel) =>
    onDestructive({ kind, targetId: selected, title, body, risk, onDone: refresh });

  return (
    <div className="space-y-5">
      <PanelHead
        code="MEET CONTROL"
        title="УУЛЗАЛТЫН УДИРДЛАГА"
        desc="Хуваарь, бүртгэл, өрөөний нууцлал, амьдралын мөчлөг."
      >
        <button type="button" className={btnClass} onClick={refresh}>
          <RefreshCw className="h-4 w-4" /> ШИНЭЧЛЭХ
        </button>
      </PanelHead>
      <EmptyData result={result} />

      {meets.length > 0 && (
        <label className="block">
          <span className="hud-label block text-muted-foreground">СОНГОСОН УУЛЗАЛТ</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className={`${fieldClass} mt-2`}
          >
            {meets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} · {m.status}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-4 border border-border bg-ink/50 p-5 sm:grid-cols-2">
        <label className="block">
          <span className="hud-label block text-muted-foreground">TITLE / ГАРЧИГ</span>
          <input
            className={`${fieldClass} mt-2`}
            value={draft.title}
            maxLength={120}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Уулзалтын нэр"
          />
        </label>
        <label className="block">
          <span className="hud-label block text-muted-foreground">SCHEDULE / ЭХЛЭХ ЦАГ</span>
          <input
            type="datetime-local"
            className={`${fieldClass} mt-2`}
            value={draft.scheduled_at}
            onChange={(e) => setDraft({ ...draft, scheduled_at: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="hud-label block text-muted-foreground">БҮРТГЭЛ ХААХ ЦАГ</span>
          <input
            type="datetime-local"
            className={`${fieldClass} mt-2`}
            value={draft.registration_closes_at}
            onChange={(e) => setDraft({ ...draft, registration_closes_at: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="hud-label block text-muted-foreground">CAPACITY / БАГТААМЖ</span>
          <input
            type="number"
            min={1}
            className={`${fieldClass} mt-2`}
            value={draft.capacity}
            onChange={(e) => setDraft({ ...draft, capacity: e.target.value })}
            placeholder="—"
          />
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="button"
            className={btnClass}
            disabled={!canWrite || busy}
            onClick={() => saveMeet("create")}
          >
            <Plus className="h-4 w-4" /> ҮҮСГЭХ
          </button>
          <button
            type="button"
            className={btnClass}
            disabled={!canWrite || busy || !selected}
            onClick={() => saveMeet("update")}
          >
            ХАДГАЛАХ
          </button>
        </div>
      </div>

      {/* Credentials — masked by default, never listed or audited */}
      <div className="grid gap-4 border border-crimson/30 bg-crimson/5 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2 flex items-center gap-2">
          <Lock className="h-4 w-4 text-crimson" />
          <span className="hud-label text-foreground/80">ROOM CREDENTIALS / ХАМГААЛАГДСАН</span>
        </div>
        <label className="block">
          <span className="hud-label block text-muted-foreground">ROOM ID</span>
          <input
            id={`${uid}-room`}
            type={reveal ? "text" : "password"}
            autoComplete="off"
            className={`${fieldClass} mt-2`}
            value={creds.room_id}
            onChange={(e) => setCreds({ ...creds, room_id: e.target.value })}
            placeholder="••••••"
          />
        </label>
        <label className="block">
          <span className="hud-label block text-muted-foreground">PASSWORD</span>
          <input
            type={reveal ? "text" : "password"}
            autoComplete="new-password"
            className={`${fieldClass} mt-2`}
            value={creds.room_password}
            onChange={(e) => setCreds({ ...creds, room_password: e.target.value })}
            placeholder="••••••"
          />
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-pressed={reveal}
            className={btnClass}
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {reveal ? "НУУХ" : "ХАРУУЛАХ"}
          </button>
          <button
            type="button"
            className={`${btnClass} border-crimson/40 text-crimson`}
            disabled={!canWrite || busy || !selected || !creds.room_id || !creds.room_password}
            onClick={saveCreds}
          >
            <RefreshCw className="h-4 w-4" /> НУУЦЛАЛ ХАДГАЛАХ
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btnClass}
          disabled={!canWrite || !selected}
          onClick={() =>
            lifecycle(
              "meet.start",
              "УУЛЗАЛТ ЭХЛҮҮЛЭХ ҮҮ?",
              "Уулзалт LIVE төлөвт шилжинэ.",
              "medium",
            )
          }
        >
          ЭХЛҮҮЛЭХ
        </button>
        <button
          type="button"
          className={btnClass}
          disabled={!canWrite || !selected}
          onClick={() =>
            lifecycle("meet.close", "БҮРТГЭЛ ХААХ УУ?", "Уулзалт нийтэд харагдахаа болино.", "high")
          }
        >
          ХААХ
        </button>
        <button
          type="button"
          className={`${btnClass} border-crimson/40 text-crimson`}
          disabled={!canWrite || !selected}
          onClick={() => lifecycle("meet.end", "УУЛЗАЛТ ДУУСГАХ УУ?", "Уулзалт дуусна.", "high")}
        >
          ДУУСГАХ
        </button>
      </div>

      {notice ? (
        <p className="border border-border bg-ink/60 p-3 text-xs text-muted-foreground">{notice}</p>
      ) : null}

      {/* Registrations */}
      <div className="border border-border bg-ink/40 p-5">
        <span className="hud-label text-foreground/80">БҮРТГЭЛҮҮД</span>
        <div className="mt-3 space-y-2">
          {!selected ? (
            <p className="text-xs text-muted-foreground">Уулзалт сонгоно уу.</p>
          ) : regs === null ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Ачаалж байна…
            </p>
          ) : regs.status === "unavailable" ? (
            <p className="text-xs text-muted-foreground">{regs.reason}</p>
          ) : regs.rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">Бүртгэл алга.</p>
          ) : (
            regs.rows.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-border bg-ink/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{r.cpmNickname}</p>
                  <p className="truncate font-mono text-[0.65rem] text-muted-foreground">
                    {r.cpmId}
                  </p>
                </div>
                <button
                  type="button"
                  className={`${btnClass} border-crimson/40 text-crimson`}
                  disabled={!canWrite}
                  onClick={() =>
                    onDestructive({
                      kind: "meet.registration_remove",
                      targetId: r.id,
                      title: "БҮРТГЭЛ УСТГАХ УУ?",
                      body: `${r.cpmNickname} уулзалтын бүртгэлээс хасагдана.`,
                      risk: "medium",
                      onDone: refresh,
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" /> ХАСАХ
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MusicModule({
  actor,
  onDestructive,
}: {
  actor: AdminActor | null;
  onDestructive: (c: Confirmation) => void;
}) {
  return (
    <CrudWorkspace
      code="MUSIC / AI DATA"
      title="ХӨГЖМИЙН МЕТА ӨГӨГДӨЛ"
      desc="Нийтлэгдсэн трек ONI AI танхимд шууд харагдана. Зөвхөн мета өгөгдөл хадгална."
      statusKey="status"
      filters={[
        { value: "all", label: "БҮГД" },
        { value: "published", label: "НИЙТЭЛСЭН" },
        { value: "draft", label: "НООРОГ" },
      ]}
      fields={[
        { key: "title", label: "ГАРЧИГ", required: true },
        { key: "artist", label: "ПЕРФОРМЕР" },
        { key: "source_url", label: "ЭХ СУРВАЛЖ (URL)" },
        { key: "duration_seconds", label: "ҮРГЭЛЖЛЭХ (СЕК)", type: "number" },
        { key: "sort_order", label: "ЭРЭМБЭ", type: "number" },
        {
          key: "status",
          label: "ТӨЛӨВ",
          options: [
            { value: "draft", label: "НООРОГ" },
            { value: "published", label: "НИЙТЭЛСЭН" },
          ],
        },
      ]}
      load={async () => {
        const r = await getTracks();
        if (r.status !== "ok") return r;
        return {
          status: "ok",
          rows: r.rows.map((t: AdminTrackRecord) => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            source_url: t.source,
            duration_seconds: t.durationSeconds || "",
            sort_order: t.sortOrder,
            status: t.status,
          })),
        };
      }}
      primary={(r) => String(r["title"] ?? "")}
      secondary={(r) => `${r["artist"] || "—"} · ЭРЭМБЭ ${r["sort_order"] ?? 0}`}
      kinds={{ create: "track.create", update: "track.update", remove: "track.delete" }}
      supportsArchive={false}
      actor={actor}
      permission="music.write"
      onDestructive={onDestructive}
    />
  );
}

function SystemModule() {
  const services = useMemo(() => getServiceStatuses(), []);
  return (
    <div className="space-y-5">
      <PanelHead
        code="SYSTEM HEALTH"
        title="СИСТЕМИЙН ТӨЛӨВ"
        desc="Зөвхөн frontend-д бодитоор мэдэгдэх төлөв. Хуурамч 'бүх зүйл хэвийн' харуулахгүй."
      />
      <ul className="divide-y divide-border border border-border">
        {services.map((s) => (
          <li key={s.key} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-sm tracking-[0.12em] text-foreground">{s.label}</p>
              <p className="hud-label mt-1 text-muted-foreground">{s.code}</p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <StateDot state={s.state} />
              {s.state === "connected"
                ? "ХОЛБОГДСОН"
                : s.state === "unknown"
                  ? "ТОДОРХОЙГҮЙ"
                  : "ХОЛБОГДООГҮЙ"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AuditModule() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<DataResult<Record<string, unknown>> | null>(null);
  useEffect(() => {
    let alive = true;
    getAuditEvents().then((r) => alive && setResult(r as DataResult<Record<string, unknown>>));
    return () => {
      alive = false;
    };
  }, []);

  const rows =
    result && result.status === "ok"
      ? result.rows.filter((r) => {
          const q = query.trim().toLowerCase();
          if (!q) return true;
          return JSON.stringify(r).toLowerCase().includes(q);
        })
      : [];

  return (
    <div className="space-y-5">
      <PanelHead
        code="AUDIT LOG"
        title="ҮЙЛДЛИЙН БҮРТГЭЛ"
        desc="Админ үйлдэл бүр энд бүртгэгдэнэ. Бүртгэл нэмэгдэх боловч засагдахгүй."
      />
      <label className="relative block">
        <span className="sr-only">Бүртгэл хайх</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Үйлдэл, хэрэглэгч, объектоор хайх…"
          className={`${fieldClass} pl-10`}
        />
      </label>
      <EmptyData result={result} />
      {result && result.status === "ok" ? (
        rows.length ? (
          <ul className="space-y-px bg-border">
            {rows.map((r, i) => (
              <li key={String(r["id"] ?? i)} className="bg-ink/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="truncate text-sm tracking-[0.12em] text-foreground">
                    {String(r["action"] ?? "")}
                  </p>
                  <span className="hud-label shrink-0 text-crimson/80">
                    {String(r["severity"] ?? "")} / {String(r["result"] ?? "")}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {String(r["createdAt"] ?? r["created_at"] ?? "")} · {String(r["actorRole"] ?? "")}
                  {r["target"] ? ` · ${String(r["target"])}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="border border-dashed border-border bg-ink/40 p-8 text-center">
            <span className="hud-label block text-muted-foreground">NO EVENTS</span>
            <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Бүртгэгдсэн үйлдэл алга.
            </p>
          </div>
        )
      ) : null}
    </div>
  );
}

function CommandModule({
  actor,
  onConfirm,
}: {
  actor: AdminActor | null;
  onConfirm: (c: Confirmation) => void;
}) {
  const [tier, setTier] = useState<CommandTier>("read");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<CommandResponse | null>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setResponse(null);
    const r = await submitCommand(text, tier);
    setBusy(false);
    setResponse(r);
  };

  return (
    <div className="space-y-5">
      <PanelHead
        code="ONI AI COMMAND"
        title="ОНИ КОМАНДЫН САМБАР"
        desc="Монгол хэлээр өгсөн админ командыг гурван түвшний аюулгүй загвараар боловсруулна."
      />

      <ul className="grid gap-px bg-border sm:grid-cols-3">
        {COMMAND_TIERS.map((t) => (
          <li key={t.id} className="bg-ink/60">
            <button
              type="button"
              onClick={() => setTier(t.id)}
              aria-pressed={tier === t.id}
              className={`h-full w-full p-4 text-left transition-colors ${
                tier === t.id ? "bg-crimson/12" : "hover:bg-midnight/60"
              }`}
            >
              <span className="hud-label text-crimson/80">{t.code}</span>
              <p className="mt-2 text-sm tracking-[0.14em] text-foreground">{t.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.desc}</p>
            </button>
          </li>
        ))}
      </ul>

      <div className="border border-border bg-ink/50 p-4">
        <label className="block">
          <span className="hud-label block text-muted-foreground">COMMAND / КОМАНД</span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
            }}
            rows={3}
            placeholder="Жишээ: Хүлээгдэж буй анкетуудыг шалга"
            className={`${fieldClass} mt-2 resize-none`}
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || !input.trim()}
            className="inline-flex min-h-[44px] items-center gap-2 border border-crimson/55 bg-crimson/18 px-4 text-[0.65rem] font-semibold tracking-[0.2em] text-foreground transition-colors clip-notch hover:bg-crimson/28 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BrainCircuit className="h-4 w-4" />
            )}
            ИЛГЭЭХ
          </button>
          <span className="hud-label text-muted-foreground">
            {ADMIN_AI_CONNECTED ? "ENGINE ONLINE" : "ENGINE OFFLINE"}
          </span>
        </div>
      </div>

      <div>
        <span className="hud-label block text-muted-foreground">SAMPLE COMMANDS / ЖИШЭЭ</span>
        <div className="mt-3 flex flex-wrap gap-2">
          {COMMAND_SUGGESTIONS.map((s) => (
            <button
              key={s.text}
              type="button"
              onClick={() => {
                setTier(s.tier);
                setInput(s.text);
              }}
              className={btnClass}
            >
              <span className="text-crimson/80">{s.tier.toUpperCase()}</span>
              <span className="normal-case tracking-normal text-xs">{s.text}</span>
            </button>
          ))}
        </div>
      </div>

      {response ? (
        <div className="border border-border bg-ink/60 p-5">
          <span className="hud-label text-crimson/85">
            {response.status === "plan" ? `STATUS / ${response.plan.tier.toUpperCase()}` : "STATUS"}
          </span>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {response.status === "plan" ? response.plan.rationale : response.message}
          </p>

          {response.status === "plan" && response.plan.actions.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {response.plan.actions.map((a, i) => {
                const blocked = a.missingParams.length > 0;
                return (
                  <li key={`${a.kind}-${i}`} className="border border-border bg-midnight/50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="hud-label text-crimson/80">{a.kind}</span>
                      <span className="hud-label text-muted-foreground">
                        RISK / {a.risk.toUpperCase()}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {a.summary}
                    </p>
                    {blocked ? (
                      <p className="mt-2 text-xs text-amber-300/85">
                        ДУТУУ ПАРАМЕТР: {a.missingParams.join(", ")} — гүйцэтгэхгүй, зөвхөн бэлтгэв.
                      </p>
                    ) : (
                      <button
                        type="button"
                        disabled={!actor}
                        onClick={() =>
                          onConfirm({
                            kind: a.kind,
                            title: "ҮЙЛДЛИЙГ БАТАЛГААЖУУЛАХ",
                            body: `${a.summary} Энэ үйлдэл RBAC шалгалт болон бүртгэлээр дамжина.`,
                            risk: a.risk,
                          })
                        }
                        className="mt-3 inline-flex min-h-[44px] items-center gap-2 border border-crimson/55 bg-crimson/16 px-4 text-[0.65rem] font-semibold tracking-[0.2em] text-foreground transition-colors clip-notch hover:bg-crimson/26 disabled:opacity-50"
                      >
                        БАТАЛГААЖУУЛАХ
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      <OfflineNotice text="Командын хөдөлгүүр нь тодорхой дүрэмт чиглүүлэлт дээр ажиллаж, зөвхөн эрх бүхий үйлчилгээний давхаргаас уншина. Ямар ч өөрчлөлт баталгаажуулалтгүйгээр хийгдэхгүй. Уулзалтын ROOM ID / нууц үг энд хэзээ ч гарахгүй." />
    </div>
  );
}

/* ── shell ────────────────────────────────────────────────────── */

export function OniControlCenter() {
  const [active, setActive] = useState<AdminModuleId>("overview");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const auth = useOniAuth();
  const authorized = auth.phase === "authorized";
  const actor: AdminActor | null =
    authorized && auth.profile ? { uid: auth.profile.uid, role: auth.profile.role } : null;
  const current = ADMIN_MODULES.find((m) => m.id === active)!;

  return (
    <div className="min-h-[100svh] bg-ink text-foreground">
      <OniHudNav />

      <main className="mx-auto max-w-[110rem] px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-24 sm:px-7 lg:pt-28">
        {/* status strip — truthful backend/auth/authorization state */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border border-crimson/35 bg-crimson/8 px-4 py-3">
          <span className="inline-flex items-center gap-2">
            {authorized ? (
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            ) : (
              <Lock className="h-4 w-4 text-crimson" />
            )}
            <span className={`hud-label ${authorized ? "text-emerald-300/90" : "text-crimson/85"}`}>
              {authorized ? `AUTHORIZED · ${auth.profile?.role?.toUpperCase()}` : "NOT AUTHORIZED"}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">
            {authorized
              ? `${auth.email ?? ""} — эрх баталгаажсан. Өгөгдлийн сан холбогдсон.`
              : "Эрх баталгаажаагүй байна."}
          </span>
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <StateDot state="connected" /> BACKEND
            <StateDot state={authorized ? "connected" : "not_connected"} /> AUTH
            <StateDot state={ADMIN_AI_CONNECTED ? "connected" : "not_connected"} /> AI
            {authorized ? (
              <button
                type="button"
                onClick={() => void auth.signOut()}
                className="ml-1 min-h-[44px] px-2 text-[0.62rem] font-semibold tracking-[0.18em] text-muted-foreground hover:text-foreground"
              >
                ГАРАХ
              </button>
            ) : null}
          </span>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
          {/* module rail */}
          <nav aria-label="Удирдлагын хэсгүүд" className="min-w-0">
            <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 lg:mx-0 lg:flex-col lg:gap-px lg:overflow-visible lg:bg-border lg:px-0 lg:pb-0">
              {ADMIN_MODULES.map((m) => (
                <li key={m.id} className="shrink-0 lg:bg-ink">
                  <button
                    type="button"
                    onClick={() => setActive(m.id)}
                    aria-current={active === m.id ? "page" : undefined}
                    className={`flex min-h-[44px] w-full items-center gap-3 border px-3.5 text-left transition-colors clip-notch lg:border-0 lg:py-3 ${
                      active === m.id
                        ? "border-crimson/60 bg-crimson/15 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground lg:hover:bg-midnight/60"
                    }`}
                  >
                    <span className="hud-label shrink-0 text-crimson/70">{m.index}</span>
                    <span className="whitespace-nowrap text-[0.7rem] font-medium tracking-[0.18em]">
                      {m.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* workspace */}
          <section
            aria-label={current.label}
            className="min-w-0 border border-border bg-midnight/40 p-4 sm:p-6"
          >
            {active === "overview" ? <OverviewModule /> : null}
            {active === "members" ? (
              <CrudWorkspace
                code="MEMBERS"
                title="ГИШҮҮДИЙН БҮРТГЭЛ"
                desc="Гишүүн үүсгэх, засах, архивлах, устгах. Идэвхтэй гишүүд CREW хуудсанд харагдана."
                statusKey="status"
                filters={[
                  { value: "all", label: "БҮГД" },
                  { value: "active", label: "ИДЭВХТЭЙ" },
                  { value: "inactive", label: "ИДЭВХГҮЙ" },
                  { value: "archived", label: "АРХИВ" },
                ]}
                fields={[
                  { key: "cpm_nickname", label: "CPM ХОЧ", required: true, max: 40 },
                  { key: "cpm_id", label: "CPM ID", required: true, max: 40 },
                  { key: "role", label: "ҮҮРЭГ" },
                  { key: "joined_at", label: "ЭЛССЭН", type: "datetime-local" },
                  {
                    key: "status",
                    label: "ТӨЛӨВ",
                    options: [
                      { value: "active", label: "ИДЭВХТЭЙ" },
                      { value: "inactive", label: "ИДЭВХГҮЙ" },
                      { value: "archived", label: "АРХИВ" },
                    ],
                  },
                ]}
                load={async () => {
                  const r = await getMembers();
                  if (r.status !== "ok") return r;
                  return {
                    status: "ok",
                    rows: r.rows.map((m: AdminMemberRecord) => ({
                      id: m.id,
                      cpm_nickname: m.cpmNickname,
                      cpm_id: m.cpmId,
                      role: m.role,
                      joined_at: m.joinedAt ? m.joinedAt.slice(0, 16) : "",
                      status: m.status,
                    })),
                  };
                }}
                primary={(r) => String(r["cpm_nickname"] ?? "")}
                secondary={(r) => `CPM ID ${r["cpm_id"] ?? "—"} · ${r["role"] || "—"}`}
                kinds={{
                  create: "member.create",
                  update: "member.update",
                  archive: "member.archive",
                  remove: "member.delete",
                }}
                actor={actor}
                permission="members.write"
                onDestructive={setConfirmation}
              />
            ) : null}
            {active === "garage" ? (
              <CrudWorkspace
                code="GARAGE"
                title="ГАРАЖИЙН БҮРТГЭЛ"
                desc="Автомашины бичлэг үүсгэх, засах, архивлах, устгах. Нийтэлсэн бичлэг GARAGE хуудсанд харагдана."
                statusKey="status"
                filters={[
                  { value: "all", label: "БҮГД" },
                  { value: "published", label: "НИЙТЭЛСЭН" },
                  { value: "draft", label: "НООРОГ" },
                  { value: "archived", label: "АРХИВ" },
                ]}
                fields={[
                  { key: "model", label: "МОДЕЛЬ", required: true },
                  { key: "owner_name", label: "ЭЗЭМШИГЧ" },
                  { key: "category", label: "АНГИЛАЛ" },
                  { key: "build", label: "БҮТЭЦ" },
                  { key: "image_path", label: "ЗУРГИЙН URL", max: 500 },
                  {
                    key: "status",
                    label: "ТӨЛӨВ",
                    options: [
                      { value: "draft", label: "НООРОГ" },
                      { value: "published", label: "НИЙТЭЛСЭН" },
                      { value: "archived", label: "АРХИВ" },
                    ],
                  },
                ]}
                load={async () => {
                  const r = await getVehicles();
                  if (r.status !== "ok") return r;
                  return {
                    status: "ok",
                    rows: r.rows.map((v: AdminVehicleRecord) => ({
                      id: v.id,
                      model: v.model,
                      owner_name: v.owner === "—" ? "" : v.owner,
                      category: v.category,
                      build: v.build,
                      image_path: v.imagePath,
                      status: v.status,
                    })),
                  };
                }}
                primary={(r) => String(r["model"] ?? "")}
                secondary={(r) => `${r["category"] || "—"} · ${r["owner_name"] || "—"}`}
                kinds={{
                  create: "vehicle.create",
                  update: "vehicle.update",
                  archive: "vehicle.archive",
                  remove: "vehicle.delete",
                }}
                actor={actor}
                permission="garage.write"
                onDestructive={setConfirmation}
              />
            ) : null}
            {active === "applications" ? (
              <ApplicationsModule actor={actor} onDestructive={setConfirmation} />
            ) : null}
            {active === "meet" ? (
              <MeetModule actor={actor} onDestructive={setConfirmation} />
            ) : null}
            {active === "music" ? (
              <MusicModule actor={actor} onDestructive={setConfirmation} />
            ) : null}
            {active === "system" ? <SystemModule /> : null}
            {active === "audit" ? <AuditModule /> : null}
            {active === "command" ? (
              <CommandModule actor={actor} onConfirm={setConfirmation} />
            ) : null}
          </section>
        </div>
      </main>

      <ConfirmDialog
        confirmation={confirmation}
        actor={actor}
        onCancel={() => setConfirmation(null)}
      />
    </div>
  );
}
