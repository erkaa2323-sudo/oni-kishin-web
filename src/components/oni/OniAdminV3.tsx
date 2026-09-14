import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
  Award,
  Bot,
  CalendarClock,
  Car,
  Check,
  ChevronRight,
  CircleDollarSign,
  Coins,
  HeartPulse,
  Images,
  Inbox,
  LayoutDashboard,
  Library,
  Loader2,
  LogOut,
  Music2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Shield,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

import {
  ACTION_RISK,
  ADMIN_AI_CONNECTED,
  COMMAND_SUGGESTIONS,
  COMMAND_TIERS,
  ROLE_PERMISSIONS,
  dispatchAdminAction,
  getApplications,
  getAuditEvents,
  getMeets,
  getMembers,
  getRegistrations,
  getServiceStatuses,
  getTracks,
  getVehicles,
  submitCommand,
  type AdminActionKind,
  type AdminActor,
  type AdminApplicationRecord,
  type AdminMeetRecord,
  type AdminMemberRecord,
  type AdminPermission,
  type AdminRegistrationRecord,
  type AdminTrackRecord,
  type AdminVehicleRecord,
  type CommandResponse,
  type CommandTier,
  type DataResult,
  type RiskLevel,
} from "@/data/admin";
import { listMemberAccounts, type MemberAccount } from "@/data/member-auth";
import {
  adjustManualProgression,
  grantEventReward,
  type EventRewardPlacement,
} from "@/data/progression-admin";
import {
  configureEconomyWeek,
  confirmCurrentMeetAttendance,
  getEconomySeasonConfig,
  getEconomyWeekConfig,
  listCurrentMeetAttendanceCandidates,
  revokeCurrentMeetAttendance,
  startNewEconomySeason,
  type AttendanceCandidate,
} from "@/data/economy-admin";
import {
  listCreatorPublishRequests,
  reviewCreatorPublishRequest,
  type CreatorPublishRequest,
} from "@/data/creator-publish";
import { hasPermission } from "@/services/admin-profiles";
import { useOniAuth } from "@/hooks/useOniAuth";
import { OniHudNav } from "./OniHudNav";

const inputClass =
  "min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-base text-white outline-none transition focus:border-white/25 sm:text-sm";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-white/70 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-40";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-crimson/50 bg-crimson/15 px-4 text-xs font-semibold text-white transition hover:bg-crimson/25 disabled:cursor-not-allowed disabled:opacity-40";
const dangerButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40";
const successButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40";

type MainSection = "dashboard" | "members" | "operations" | "content" | "system";
type MemberTab = "inbox" | "members";
type OperationsTab = "meet" | "economy";
type ContentTab = "garage" | "creator" | "music";
type SystemTab = "health" | "audit" | "permissions" | "ai";

type Confirmation = {
  kind: AdminActionKind;
  targetId?: string;
  payload?: Record<string, unknown>;
  title: string;
  body: string;
  risk: RiskLevel;
  onDone?: () => void;
};

type Jump = {
  section: MainSection;
  tab?: MemberTab | OperationsTab | ContentTab | SystemTab;
};

const MAIN_NAV: {
  id: MainSection;
  label: string;
  hint: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: "dashboard", label: "Хяналтын самбар", hint: "Товч төлөв", icon: LayoutDashboard },
  { id: "members", label: "Гишүүд", hint: "Crew ба хүсэлт", icon: Users },
  { id: "operations", label: "Үйл ажиллагаа", hint: "Meet ба economy", icon: Activity },
  { id: "content", label: "Контент", hint: "Garage, creator, music", icon: Library },
  { id: "system", label: "Систем", hint: "Health, audit, access", icon: Shield },
];

function StateDot({ ok }: { ok: boolean }) {
  return <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />;
}

function PageHead({
  eyebrow,
  title,
  desc,
  actions,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-crimson/80">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">{desc}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

function EmptyState({ title, desc, action }: { title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.015] px-5 py-10 text-center">
      <p className="text-sm font-semibold text-white/75">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-white/35">{desc}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

function Subnav<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: { id: T; label: string; badge?: number }[];
}) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-black/15 p-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`min-h-10 shrink-0 rounded-xl px-3 text-xs font-semibold transition ${
            value === item.id
              ? "bg-white text-black"
              : "text-white/45 hover:bg-white/[0.05] hover:text-white"
          }`}
        >
          {item.label}
          {typeof item.badge === "number" ? (
            <span
              className={`ml-2 rounded-full px-1.5 py-0.5 text-[0.62rem] ${value === item.id ? "bg-black/10" : "bg-white/10"}`}
            >
              {item.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function ConfirmDialog({
  confirmation,
  actor,
  onClose,
}: {
  confirmation: Confirmation | null;
  actor: AdminActor | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  useEffect(() => {
    setBusy(false);
    setResult("");
  }, [confirmation]);

  if (!confirmation) return null;

  const run = async () => {
    setBusy(true);
    const response = await dispatchAdminAction(
      {
        kind: confirmation.kind,
        ...(confirmation.targetId ? { targetId: confirmation.targetId } : {}),
        ...(confirmation.payload ? { payload: confirmation.payload } : {}),
      },
      actor,
    );
    setBusy(false);
    if (!response.ok) {
      setResult(response.error);
      return;
    }
    setResult("Амжилттай гүйцэтгэлээ.");
    confirmation.onDone?.();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="Хаах" onClick={onClose} />
      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#101015] p-5 shadow-2xl">
        <div className="flex items-center gap-2 text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em]">
            {confirmation.risk === "high"
              ? "Өндөр эрсдэл"
              : confirmation.risk === "medium"
                ? "Анхаарах үйлдэл"
                : "Баталгаажуулалт"}
          </span>
        </div>
        <h3 className="mt-3 text-xl font-semibold text-white">{confirmation.title}</h3>
        <p className="mt-2 text-sm leading-6 text-white/45">{confirmation.body}</p>
        {result ? (
          <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/60">
            {result}
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" className={secondaryButton} onClick={onClose}>
            Болих
          </button>
          <button
            type="button"
            className={confirmation.risk === "high" ? dangerButton : primaryButton}
            disabled={busy || !!result}
            onClick={() => void run()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Баталгаажуулах
          </button>
        </div>
      </section>
    </div>
  );
}

function Dashboard({ onJump }: { onJump: (jump: Jump) => void }) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState(0);
  const [pendingApps, setPendingApps] = useState(0);
  const [pendingAccounts, setPendingAccounts] = useState(0);
  const [pendingCreator, setPendingCreator] = useState(0);
  const [meetLabel, setMeetLabel] = useState("Идэвхгүй");
  const [recent, setRecent] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    const [m, a, accounts, creator, meets, audit] = await Promise.all([
      getMembers(),
      getApplications(),
      listMemberAccounts().catch(() => []),
      listCreatorPublishRequests("pending").catch(() => []),
      getMeets(),
      getAuditEvents(),
    ]);
    setMembers(m.status === "ok" ? m.rows.filter((row) => row.status === "active").length : 0);
    setPendingApps(a.status === "ok" ? a.rows.filter((row) => row.state === "pending").length : 0);
    setPendingAccounts(accounts.filter((row) => row.status === "pending").length);
    setPendingCreator(creator.length);
    if (meets.status === "ok") {
      const live = meets.rows.find((row) => row.status === "live");
      const scheduled = meets.rows.find((row) => row.status === "scheduled");
      setMeetLabel(
        live ? `LIVE · ${live.title}` : scheduled ? `Төлөвлөсөн · ${scheduled.title}` : "Идэвхгүй",
      );
    } else setMeetLabel("Тодорхойгүй");
    setRecent(
      audit.status === "ok"
        ? audit.rows
            .slice(0, 5)
            .map((row) => `${row.action}${row.target ? ` · ${row.target}` : ""}`)
        : [],
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const pendingTotal = pendingApps + pendingAccounts + pendingCreator;
  const cards = [
    {
      label: "Идэвхтэй гишүүн",
      value: members,
      icon: Users,
      jump: { section: "members", tab: "members" as MemberTab },
    },
    {
      label: "Хүлээгдэж буй хүсэлт",
      value: pendingTotal,
      icon: Inbox,
      jump: { section: "members", tab: "inbox" as MemberTab },
    },
    {
      label: "Meet",
      value: meetLabel,
      icon: CalendarClock,
      jump: { section: "operations", tab: "meet" as OperationsTab },
    },
    {
      label: "Creator хүсэлт",
      value: pendingCreator,
      icon: Images,
      jump: { section: "content", tab: "creator" as ContentTab },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHead
        eyebrow="Admin V3"
        title="Хяналтын самбар"
        desc="Админ орж ирмэгц анхаарах зүйл, хүлээгдэж буй хүсэлт, Meet болон системийн төлөвийг нэг дор харна."
        actions={
          <button type="button" className={secondaryButton} onClick={() => void load()}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Шинэчлэх
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => onJump(card.jump)}
              className="group rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.045]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.05] text-white/60">
                  <Icon className="h-5 w-5" />
                </span>
                <ChevronRight className="h-4 w-4 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-white/50" />
              </div>
              <p className="mt-5 text-xs text-white/35">{card.label}</p>
              <p className="mt-1 truncate text-xl font-semibold text-white">
                {loading ? "…" : card.value}
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white">Анхаарах зүйлс</p>
              <p className="mt-1 text-xs text-white/35">Одоогоор action шаардлагатай зүйлс</p>
            </div>
            <Inbox className="h-5 w-5 text-white/25" />
          </div>
          <div className="mt-4 space-y-2">
            {pendingTotal === 0 ? (
              <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] p-3 text-xs text-emerald-200/75">
                Хүлээгдэж буй хүсэлт алга.
              </div>
            ) : (
              <>
                {pendingAccounts > 0 ? (
                  <button
                    type="button"
                    onClick={() => onJump({ section: "members", tab: "inbox" })}
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 p-3 text-left text-xs text-white/70"
                  >
                    <span>Нэвтрэх хүсэлт</span>
                    <strong>{pendingAccounts}</strong>
                  </button>
                ) : null}
                {pendingApps > 0 ? (
                  <button
                    type="button"
                    onClick={() => onJump({ section: "members", tab: "inbox" })}
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 p-3 text-left text-xs text-white/70"
                  >
                    <span>Элсэлтийн анкет</span>
                    <strong>{pendingApps}</strong>
                  </button>
                ) : null}
                {pendingCreator > 0 ? (
                  <button
                    type="button"
                    onClick={() => onJump({ section: "content", tab: "creator" })}
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 p-3 text-left text-xs text-white/70"
                  >
                    <span>Creator хүсэлт</span>
                    <strong>{pendingCreator}</strong>
                  </button>
                ) : null}
              </>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white">Сүүлийн үйлдэл</p>
              <p className="mt-1 text-xs text-white/35">Audit log-ийн хамгийн сүүлийн бичлэг</p>
            </div>
            <Activity className="h-5 w-5 text-white/25" />
          </div>
          <div className="mt-4 space-y-2">
            {recent.length ? (
              recent.map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className="rounded-xl bg-white/[0.025] px-3 py-2.5 text-xs text-white/50"
                >
                  {item}
                </div>
              ))
            ) : (
              <p className="text-xs text-white/30">Үйлдлийн бүртгэл алга.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function UnifiedInbox({ actor }: { actor: AdminActor | null }) {
  type Filter = "all" | "join" | "account" | "creator";
  const [filter, setFilter] = useState<Filter>("all");
  const [apps, setApps] = useState<AdminApplicationRecord[]>([]);
  const [accounts, setAccounts] = useState<MemberAccount[]>([]);
  const [creator, setCreator] = useState<CreatorPublishRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    setNotice("");
    const [a, accountRows, creatorRows] = await Promise.all([
      getApplications(),
      listMemberAccounts().catch(() => []),
      listCreatorPublishRequests("pending").catch(() => []),
    ]);
    setApps(a.status === "ok" ? a.rows : []);
    setAccounts(accountRows);
    setCreator(creatorRows);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const reviewApplication = async (row: AdminApplicationRecord, accept: boolean) => {
    setBusy(`app:${row.id}`);
    const result = await dispatchAdminAction(
      accept
        ? {
            kind: "application.accept",
            targetId: row.id,
            payload: { cpm_nickname: row.cpmNickname, cpm_id: row.cpmId },
          }
        : { kind: "application.reject", targetId: row.id },
      actor,
    );
    setBusy("");
    setNotice(result.ok ? "Анкетын төлөв шинэчлэгдлээ." : result.error);
    if (result.ok) await load();
  };

  const reviewAccount = async (row: MemberAccount, approve: boolean) => {
    setBusy(`account:${row.uid}`);
    const result = await dispatchAdminAction(
      { kind: approve ? "member_account.approve" : "member_account.reject", targetId: row.uid },
      actor,
    );
    setBusy("");
    setNotice(result.ok ? "Нэвтрэх хүсэлтийн төлөв шинэчлэгдлээ." : result.error);
    if (result.ok) await load();
  };

  const reviewCreator = async (row: CreatorPublishRequest, approve: boolean) => {
    setBusy(`creator:${row.id}`);
    try {
      await reviewCreatorPublishRequest(row.id, approve ? "approved" : "rejected");
      setNotice(approve ? "Зураг нийтлэгдлээ." : "Зургийн хүсэлтийг татгалзлаа.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Creator хүсэлтийг шинэчилж чадсангүй.");
    } finally {
      setBusy("");
    }
  };

  const pendingApps = apps.filter((row) => row.state === "pending");
  const pendingAccounts = accounts.filter((row) => row.status === "pending");

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Inbox"
        title="Хүсэлтийн төв"
        desc="Элсэлтийн анкет, гишүүний нэвтрэх хүсэлт болон Creator хүсэлтийг нэг дор хянаж шийдвэрлэнэ."
        actions={
          <button type="button" className={secondaryButton} onClick={() => void load()}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Шинэчлэх
          </button>
        }
      />
      <Subnav
        value={filter}
        onChange={setFilter}
        items={[
          {
            id: "all",
            label: "Бүгд",
            badge: pendingApps.length + pendingAccounts.length + creator.length,
          },
          { id: "join", label: "Анкет", badge: pendingApps.length },
          { id: "account", label: "Нэвтрэх", badge: pendingAccounts.length },
          { id: "creator", label: "Creator", badge: creator.length },
        ]}
      />
      {notice ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/60">
          {notice}
        </p>
      ) : null}
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" />
          Ачаалж байна…
        </p>
      ) : null}

      {!loading && (filter === "all" || filter === "join") ? (
        <section className="space-y-3">
          {pendingApps.map((row) => (
            <article
              key={row.id}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <span className="rounded-full bg-blue-500/10 px-2 py-1 text-[0.62rem] font-semibold text-blue-200">
                    ЭЛСЭЛТИЙН АНКЕТ
                  </span>
                  <p className="mt-3 font-semibold text-white">{row.cpmNickname}</p>
                  <p className="mt-1 text-xs text-white/40">
                    CPM {row.cpmId} · {row.contact}
                  </p>
                  {row.message ? (
                    <p className="mt-3 text-xs leading-5 text-white/45">{row.message}</p>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button
                    type="button"
                    className={successButton}
                    disabled={busy === `app:${row.id}`}
                    onClick={() => void reviewApplication(row, true)}
                  >
                    <Check className="h-4 w-4" />
                    Зөвшөөрөх
                  </button>
                  <button
                    type="button"
                    className={dangerButton}
                    disabled={busy === `app:${row.id}`}
                    onClick={() => void reviewApplication(row, false)}
                  >
                    <X className="h-4 w-4" />
                    Татгалзах
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {!loading && (filter === "all" || filter === "account") ? (
        <section className="space-y-3">
          {pendingAccounts.map((row) => (
            <article
              key={row.uid}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[0.62rem] font-semibold text-amber-200">
                    НЭВТРЭХ ХҮСЭЛТ
                  </span>
                  <p className="mt-3 font-semibold text-white">{row.nickname}</p>
                  <p className="mt-1 text-xs text-white/40">
                    CPM {row.cpmId} · {row.email}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button
                    type="button"
                    className={successButton}
                    disabled={busy === `account:${row.uid}`}
                    onClick={() => void reviewAccount(row, true)}
                  >
                    <Check className="h-4 w-4" />
                    Зөвшөөрөх
                  </button>
                  <button
                    type="button"
                    className={dangerButton}
                    disabled={busy === `account:${row.uid}`}
                    onClick={() => void reviewAccount(row, false)}
                  >
                    <X className="h-4 w-4" />
                    Татгалзах
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {!loading && (filter === "all" || filter === "creator") ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {creator.map((row) => (
            <article
              key={row.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
            >
              <div className="aspect-[4/3] bg-black/20">
                <img src={row.image} alt={row.title} className="h-full w-full object-contain" />
              </div>
              <div className="p-4">
                <span className="rounded-full bg-purple-500/10 px-2 py-1 text-[0.62rem] font-semibold text-purple-200">
                  CREATOR
                </span>
                <p className="mt-3 font-semibold text-white">{row.title}</p>
                <p className="mt-1 text-xs text-white/40">
                  {row.nickname}
                  {row.cpmId ? ` · CPM ${row.cpmId}` : ""}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={successButton}
                    disabled={busy === `creator:${row.id}`}
                    onClick={() => void reviewCreator(row, true)}
                  >
                    <Check className="h-4 w-4" />
                    Батлах
                  </button>
                  <button
                    type="button"
                    className={dangerButton}
                    disabled={busy === `creator:${row.id}`}
                    onClick={() => void reviewCreator(row, false)}
                  >
                    <X className="h-4 w-4" />
                    Татгалзах
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {!loading && pendingApps.length + pendingAccounts.length + creator.length === 0 ? (
        <EmptyState
          title="Хүлээгдэж буй хүсэлт алга"
          desc="Шинэ анкет, account эсвэл creator хүсэлт ирэхэд энд автоматаар харагдана."
        />
      ) : null}
    </div>
  );
}

function MemberEditor({
  row,
  onClose,
  actor,
  onSaved,
}: {
  row: AdminMemberRecord | null;
  onClose: () => void;
  actor: AdminActor | null;
  onSaved: () => void;
}) {
  const [nickname, setNickname] = useState(row?.cpmNickname ?? "");
  const [cpmId, setCpmId] = useState(row?.cpmId ?? "");
  const [role, setRole] = useState(row?.role ?? "");
  const [portrait, setPortrait] = useState(row?.portraitUrl ?? "");
  const [status, setStatus] = useState(row?.status ?? "active");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const save = async () => {
    if (!nickname.trim() || !cpmId.trim()) {
      setNotice("CPM хоч болон CPM ID заавал шаардлагатай.");
      return;
    }
    setBusy(true);
    const payload = {
      cpm_nickname: nickname.trim(),
      cpm_id: cpmId.trim(),
      role: role.trim() || null,
      portrait_url: portrait.trim() || null,
      status,
    };
    const result = await dispatchAdminAction(
      row
        ? { kind: "member.update", targetId: row.id, payload }
        : { kind: "member.create", payload },
      actor,
    );
    setBusy(false);
    if (!result.ok) return setNotice(result.error);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Хаах" onClick={onClose} />
      <section className="relative max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#101015] p-5 sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-white/35">Гишүүний бүртгэл</p>
            <h3 className="mt-1 text-xl font-semibold text-white">
              {row ? "Гишүүн засах" : "Шинэ гишүүн"}
            </h3>
          </div>
          <button type="button" className={secondaryButton} onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-white/40">CPM ХОЧ *</span>
            <input
              className={`${inputClass} mt-2`}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/40">CPM ID *</span>
            <input
              className={`${inputClass} mt-2`}
              value={cpmId}
              onChange={(e) => setCpmId(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/40">ҮҮРЭГ</span>
            <input
              className={`${inputClass} mt-2`}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/40">ТӨЛӨВ</span>
            <select
              className={`${inputClass} mt-2`}
              value={status}
              onChange={(e) => setStatus(e.target.value as AdminMemberRecord["status"])}
            >
              <option value="active">Идэвхтэй</option>
              <option value="inactive">Идэвхгүй</option>
              <option value="archived">Архив</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs text-white/40">PROFILE ЗУРГИЙН URL</span>
            <input
              className={`${inputClass} mt-2`}
              value={portrait}
              onChange={(e) => setPortrait(e.target.value)}
            />
          </label>
        </div>
        {notice ? (
          <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3 text-xs text-red-200">
            {notice}
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" className={secondaryButton} onClick={onClose}>
            Болих
          </button>
          <button
            type="button"
            className={primaryButton}
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Хадгалах
          </button>
        </div>
      </section>
    </div>
  );
}

function MembersWorkspace({
  actor,
  onConfirm,
}: {
  actor: AdminActor | null;
  onConfirm: (confirmation: Confirmation) => void;
}) {
  const [result, setResult] = useState<DataResult<AdminMemberRecord> | null>(null);
  const [accounts, setAccounts] = useState<MemberAccount[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<AdminMemberRecord | null>(null);
  const [editing, setEditing] = useState<AdminMemberRecord | "new" | null>(null);
  const [xp, setXp] = useState("0");
  const [coin, setCoin] = useState("0");
  const [reason, setReason] = useState("");
  const [busyBalance, setBusyBalance] = useState(false);
  const [balanceNotice, setBalanceNotice] = useState("");
  const canWrite = hasPermission(actor ? { ...actor } : null, "members.write");

  const load = async () => {
    setResult(null);
    const [membersResult, accountRows] = await Promise.all([
      getMembers(),
      listMemberAccounts().catch(() => []),
    ]);
    setResult(membersResult);
    setAccounts(accountRows);
  };

  useEffect(() => {
    void load();
  }, []);

  const rows =
    result?.status === "ok"
      ? result.rows.filter((row) => {
          const q = query.trim().toLowerCase();
          return (
            (status === "all" || row.status === status) &&
            (!q || `${row.cpmNickname} ${row.cpmId} ${row.role}`.toLowerCase().includes(q))
          );
        })
      : [];

  const linkedAccount = selected
    ? (accounts.find(
        (account) => account.memberId === selected.id || account.cpmId === selected.cpmId,
      ) ?? null)
    : null;

  const adjust = async () => {
    if (!selected || !linkedAccount || linkedAccount.status !== "approved") {
      setBalanceNotice("Зөвшөөрөгдсөн Crew account холбогдоогүй байна.");
      return;
    }
    const xpValue = Math.trunc(Number(xp) || 0);
    const coinValue = Math.trunc(Number(coin) || 0);
    if (!reason.trim() || (xpValue === 0 && coinValue === 0)) {
      setBalanceNotice("Өөрчлөлтийн хэмжээ болон шалтгааныг оруулна уу.");
      return;
    }
    setBusyBalance(true);
    setBalanceNotice("");
    try {
      const response = await adjustManualProgression({
        uid: linkedAccount.uid,
        nickname: selected.cpmNickname,
        xp: xpValue,
        coin: coinValue,
        reason,
      });
      setBalanceNotice(
        `Амжилттай · XP ${response.xpAfter.toLocaleString()} · ONI ${response.balanceAfter.toLocaleString()}`,
      );
      setXp("0");
      setCoin("0");
      setReason("");
    } catch (error) {
      setBalanceNotice(error instanceof Error ? error.message : "XP / ONI шинэчилж чадсангүй.");
    } finally {
      setBusyBalance(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Crew"
        title="Гишүүд"
        desc="Хайх, шүүх, профайл нээх, засах болон XP / ONI өөрчлөлтийг нэг ажлын урсгалд хийдэг."
        actions={
          <>
            <button type="button" className={secondaryButton} onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
              Шинэчлэх
            </button>
            <button
              type="button"
              className={primaryButton}
              disabled={!canWrite}
              onClick={() => setEditing("new")}
            >
              <Plus className="h-4 w-4" />
              Шинэ гишүүн
            </button>
          </>
        }
      />
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Нэр, CPM ID, үүргээр хайх…"
            className={`${inputClass} pl-10`}
          />
        </label>
        <div className="flex gap-1 overflow-x-auto">
          <Subnav
            value={status}
            onChange={setStatus}
            items={[
              { id: "all", label: "Бүгд" },
              { id: "active", label: "Идэвхтэй" },
              { id: "inactive", label: "Идэвхгүй" },
              { id: "archived", label: "Архив" },
            ]}
          />
        </div>
      </div>
      {result === null ? (
        <p className="flex items-center gap-2 text-xs text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" />
          Ачаалж байна…
        </p>
      ) : null}
      {result?.status === "unavailable" ? (
        <EmptyState title="Гишүүдийг ачаалж чадсангүй" desc={result.reason} />
      ) : null}
      {result?.status === "ok" && rows.length === 0 ? (
        <EmptyState
          title="Тохирох гишүүн алга"
          desc="Хайлтын үг эсвэл төлөвийн шүүлтүүрээ өөрчилж үзнэ үү."
        />
      ) : null}
      <div className="grid gap-2">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => {
              setSelected(row);
              setBalanceNotice("");
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-left transition hover:border-white/20 hover:bg-white/[0.04]"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/[0.05]">
              {row.portraitUrl ? (
                <img src={row.portraitUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-5 w-5 text-white/25" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{row.cpmNickname}</p>
              <p className="mt-1 truncate text-xs text-white/35">
                CPM {row.cpmId} · {row.role || "Үүрэггүй"}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-1 text-[0.62rem] font-semibold ${row.status === "active" ? "bg-emerald-500/10 text-emerald-200" : row.status === "inactive" ? "bg-amber-500/10 text-amber-200" : "bg-white/[0.06] text-white/35"}`}
            >
              {row.status}
            </span>
            <ChevronRight className="h-4 w-4 text-white/20" />
          </button>
        ))}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-[130] bg-black/65 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Хаах"
            onClick={() => setSelected(null)}
          />
          <aside className="absolute inset-y-0 right-0 w-full overflow-y-auto border-l border-white/10 bg-[#0f0f14] p-5 shadow-2xl sm:max-w-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-white/35">Гишүүний мэдээлэл</p>
                <h3 className="mt-1 text-2xl font-semibold text-white">{selected.cpmNickname}</h3>
                <p className="mt-1 text-xs text-white/40">CPM {selected.cpmId}</p>
              </div>
              <button type="button" className={secondaryButton} onClick={() => setSelected(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-[0.62rem] text-white/30">ҮҮРЭГ</p>
                <p className="mt-1 text-sm text-white/75">{selected.role || "—"}</p>
              </div>
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-[0.62rem] text-white/30">ТӨЛӨВ</p>
                <p className="mt-1 text-sm text-white/75">{selected.status}</p>
              </div>
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-[0.62rem] text-white/30">ACCOUNT</p>
                <p className="mt-1 text-sm text-white/75">{linkedAccount?.status ?? "Холбоогүй"}</p>
              </div>
              <div className="rounded-xl border border-white/10 p-3">
                <p className="text-[0.62rem] text-white/30">И-МЭЙЛ</p>
                <p className="mt-1 truncate text-sm text-white/75">{linkedAccount?.email ?? "—"}</p>
              </div>
            </div>

            {canWrite ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => setEditing(selected)}
                >
                  Засах
                </button>
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() =>
                    onConfirm({
                      kind: "member.archive",
                      targetId: selected.id,
                      title: "Гишүүнийг архивлах уу?",
                      body: `${selected.cpmNickname} нийтэд харагдахаа болино.`,
                      risk: ACTION_RISK["member.archive"] ?? "medium",
                      onDone: () => {
                        setSelected(null);
                        void load();
                      },
                    })
                  }
                >
                  <Archive className="h-4 w-4" />
                  Архив
                </button>
              </div>
            ) : null}

            <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-300" />
                <h4 className="text-sm font-semibold text-white">XP / ONI тохиргоо</h4>
              </div>
              <p className="mt-2 text-xs leading-5 text-white/35">
                Эерэг утга нэмнэ, сөрөг утга хасна. Шалтгаан заавал бичигдэж ledger-д хадгалагдана.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <label>
                  <span className="text-[0.62rem] text-white/35">XP</span>
                  <input
                    type="number"
                    value={xp}
                    onChange={(e) => setXp(e.target.value)}
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label>
                  <span className="text-[0.62rem] text-white/35">ONI COIN</span>
                  <input
                    type="number"
                    value={coin}
                    onChange={(e) => setCoin(e.target.value)}
                    className={`${inputClass} mt-1`}
                  />
                </label>
              </div>
              <label className="mt-3 block">
                <span className="text-[0.62rem] text-white/35">ШАЛТГААН *</span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={180}
                  className={`${inputClass} mt-1`}
                  placeholder="Ж: Admin correction / penalty"
                />
              </label>
              {balanceNotice ? (
                <p className="mt-3 rounded-xl bg-white/[0.03] p-3 text-xs text-white/55">
                  {balanceNotice}
                </p>
              ) : null}
              <button
                type="button"
                className={`${primaryButton} mt-3 w-full`}
                disabled={busyBalance || linkedAccount?.status !== "approved"}
                onClick={() => void adjust()}
              >
                {busyBalance ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CircleDollarSign className="h-4 w-4" />
                )}
                Өөрчлөлт хадгалах
              </button>
            </section>

            {canWrite ? (
              <button
                type="button"
                className={`${dangerButton} mt-6 w-full`}
                onClick={() =>
                  onConfirm({
                    kind: "member.delete",
                    targetId: selected.id,
                    title: "Гишүүнийг бүрмөсөн устгах уу?",
                    body: `${selected.cpmNickname} бүртгэл устгагдана.`,
                    risk: "high",
                    onDone: () => {
                      setSelected(null);
                      void load();
                    },
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
                Бүрмөсөн устгах
              </button>
            ) : null}
          </aside>
        </div>
      ) : null}
      {editing ? (
        <MemberEditor
          row={editing === "new" ? null : editing}
          actor={actor}
          onClose={() => setEditing(null)}
          onSaved={() => void load()}
        />
      ) : null}
    </div>
  );
}

function MeetWorkspace({
  actor,
  onConfirm,
}: {
  actor: AdminActor | null;
  onConfirm: (confirmation: Confirmation) => void;
}) {
  const [result, setResult] = useState<DataResult<AdminMeetRecord> | null>(null);
  const [selected, setSelected] = useState("");
  const [regs, setRegs] = useState<DataResult<AdminRegistrationRecord> | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    scheduledAt: "",
    closesAt: "",
    endsAt: "",
    capacity: "20",
  });
  const [roomId, setRoomId] = useState("");
  const [roomPass, setRoomPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const canWrite = hasPermission(actor ? { ...actor } : null, "meet.control");

  const load = async () => {
    setResult(null);
    const response = await getMeets();
    setResult(response);
    if (response.status === "ok") {
      const next = response.rows.find((row) => row.id === selected) ?? response.rows[0] ?? null;
      if (next) setSelected(next.id);
    }
  };

  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    setRegs(null);
    void getRegistrations(selected).then((response) => {
      if (alive) setRegs(response);
    });
    return () => {
      alive = false;
    };
  }, [selected]);

  const meets = result?.status === "ok" ? result.rows : [];
  const current = meets.find((row) => row.id === selected) ?? null;
  const local = (iso: string) => (iso ? iso.slice(0, 16) : "");
  useEffect(() => {
    if (!current) return;
    setDraft({
      title: current.title,
      scheduledAt: local(current.scheduledAt),
      closesAt: local(current.registrationClosesAt),
      endsAt: local(current.endsAt),
      capacity: String(current.capacity || 20),
    });
  }, [current?.id]);

  const save = async (mode: "create" | "update") => {
    const start = new Date(draft.scheduledAt).getTime();
    const close = new Date(draft.closesAt).getTime();
    const end = new Date(draft.endsAt).getTime();
    if (!draft.title.trim() || !start || !close || !end || close <= start || end <= close) {
      setNotice("Гарчиг болон цагийн дарааллыг зөв оруулна уу.");
      return;
    }
    setBusy(true);
    const payload = {
      title: draft.title.trim(),
      scheduled_at: new Date(start).toISOString(),
      registration_closes_at: new Date(close).toISOString(),
      ends_at: new Date(end).toISOString(),
      capacity: Math.min(20, Math.max(1, Number(draft.capacity || 20))),
      ...(mode === "create" ? { status: "scheduled" } : {}),
    };
    const response = await dispatchAdminAction(
      mode === "create"
        ? { kind: "meet.create", payload }
        : { kind: "meet.update", targetId: selected, payload },
      actor,
    );
    setBusy(false);
    setNotice(response.ok ? "Meet хадгалагдлаа." : response.error);
    if (response.ok) await load();
  };

  const saveCredentials = async () => {
    if (!selected || !roomId.trim() || !roomPass) return;
    setBusy(true);
    const response = await dispatchAdminAction(
      {
        kind: "meet.rotate_credentials",
        targetId: selected,
        payload: { room_id: roomId.trim(), room_password: roomPass },
      },
      actor,
    );
    setBusy(false);
    setNotice(response.ok ? "Room мэдээлэл шинэчлэгдлээ." : response.error);
    if (response.ok) {
      setRoomId("");
      setRoomPass("");
    }
  };

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Operations"
        title="Meet удирдлага"
        desc="Meet үүсгэх, цаг тохируулах, эхлүүлэх, хаах, оролцогч болон хамгаалагдсан room мэдээллийг нэг дэлгэцээс удирдана."
        actions={
          <button type="button" className={secondaryButton} onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Шинэчлэх
          </button>
        }
      />
      {meets.length ? (
        <label className="block">
          <span className="text-xs text-white/35">СОНГОСОН MEET</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className={`${inputClass} mt-2`}
          >
            {meets.map((row) => (
              <option key={row.id} value={row.id}>
                {row.title} · {row.status}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-xs text-white/35">ГАРЧИГ</span>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className={`${inputClass} mt-2`}
            />
          </label>
          <label>
            <span className="text-xs text-white/35">БАГТААМЖ</span>
            <input
              type="number"
              min={1}
              max={20}
              value={draft.capacity}
              onChange={(e) => setDraft({ ...draft, capacity: e.target.value })}
              className={`${inputClass} mt-2`}
            />
          </label>
          <label>
            <span className="text-xs text-white/35">ЭХЛЭХ ЦАГ</span>
            <input
              type="datetime-local"
              value={draft.scheduledAt}
              onChange={(e) => setDraft({ ...draft, scheduledAt: e.target.value })}
              className={`${inputClass} mt-2`}
            />
          </label>
          <label>
            <span className="text-xs text-white/35">БҮРТГЭЛ ХААХ</span>
            <input
              type="datetime-local"
              value={draft.closesAt}
              onChange={(e) => setDraft({ ...draft, closesAt: e.target.value })}
              className={`${inputClass} mt-2`}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs text-white/35">ДУУСАХ ЦАГ</span>
            <input
              type="datetime-local"
              value={draft.endsAt}
              onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
              className={`${inputClass} mt-2`}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={primaryButton}
            disabled={!canWrite || busy}
            onClick={() => void save("create")}
          >
            <Plus className="h-4 w-4" />
            Шинэ Meet
          </button>
          <button
            type="button"
            className={secondaryButton}
            disabled={!canWrite || busy || !selected}
            onClick={() => void save("update")}
          >
            Өөрчлөлт хадгалах
          </button>
        </div>
      </section>
      {selected ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={successButton}
              disabled={!canWrite}
              onClick={() =>
                onConfirm({
                  kind: "meet.start",
                  targetId: selected,
                  title: "Meet эхлүүлэх үү?",
                  body: "Meet LIVE төлөвт шилжинэ.",
                  risk: "medium",
                  onDone: () => void load(),
                })
              }
            >
              Эхлүүлэх
            </button>
            <button
              type="button"
              className={secondaryButton}
              disabled={!canWrite}
              onClick={() =>
                onConfirm({
                  kind: "meet.close",
                  targetId: selected,
                  title: "Meet хаах уу?",
                  body: "Meet нийтэд харагдахаа болино.",
                  risk: "high",
                  onDone: () => void load(),
                })
              }
            >
              Хаах
            </button>
            <button
              type="button"
              className={dangerButton}
              disabled={!canWrite}
              onClick={() =>
                onConfirm({
                  kind: "meet.end",
                  targetId: selected,
                  title: "Meet дуусгах уу?",
                  body: "Meet дууссан төлөвт шилжинэ.",
                  risk: "high",
                  onDone: () => void load(),
                })
              }
            >
              Дуусгах
            </button>
          </div>
        </section>
      ) : null}
      {selected ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-white/40" />
            <h3 className="text-sm font-semibold text-white">Room credentials</h3>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Room ID"
              className={inputClass}
            />
            <input
              type="password"
              value={roomPass}
              onChange={(e) => setRoomPass(e.target.value)}
              placeholder="Password"
              className={inputClass}
            />
          </div>
          <button
            type="button"
            className={`${secondaryButton} mt-3`}
            disabled={!canWrite || busy || !roomId.trim() || !roomPass}
            onClick={() => void saveCredentials()}
          >
            Нууцлал шинэчлэх
          </button>
        </section>
      ) : null}
      {notice ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/60">
          {notice}
        </p>
      ) : null}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">Оролцогчид</h3>
          <span className="text-xs text-white/35">
            {regs?.status === "ok" ? regs.rows.length : 0}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {regs === null && selected ? (
            <p className="text-xs text-white/35">Ачаалж байна…</p>
          ) : null}
          {regs?.status === "ok" &&
            regs.rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3"
              >
                <div>
                  <p className="text-sm text-white/75">{row.cpmNickname}</p>
                  <p className="text-xs text-white/30">{row.cpmId}</p>
                </div>
                <button
                  type="button"
                  className={dangerButton}
                  disabled={!canWrite}
                  onClick={() =>
                    onConfirm({
                      kind: "meet.registration_remove",
                      targetId: row.id,
                      title: "Бүртгэлээс хасах уу?",
                      body: `${row.cpmNickname} Meet бүртгэлээс хасагдана.`,
                      risk: "medium",
                      onDone: async () => setRegs(await getRegistrations(selected)),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                  Хасах
                </button>
              </div>
            ))}
          {regs?.status === "ok" && regs.rows.length === 0 ? (
            <p className="text-xs text-white/35">Оролцогч алга.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function EconomyWorkspace() {
  const [accounts, setAccounts] = useState<MemberAccount[]>([]);
  const [uid, setUid] = useState("");
  const [xp, setXp] = useState("0");
  const [coin, setCoin] = useState("0");
  const [reason, setReason] = useState("");
  const [eventId, setEventId] = useState("");
  const [placement, setPlacement] = useState<EventRewardPlacement>("participation");
  const [attendance, setAttendance] = useState<AttendanceCandidate[]>([]);
  const [weekId, setWeekId] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [weekEnabled, setWeekEnabled] = useState(true);
  const [seasonId, setSeasonId] = useState("");
  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const localInput = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  };

  const load = async () => {
    const [accountRows, attendanceRows, week, season] = await Promise.all([
      listMemberAccounts().catch(() => []),
      listCurrentMeetAttendanceCandidates().catch(() => []),
      getEconomyWeekConfig().catch(() => null),
      getEconomySeasonConfig().catch(() => null),
    ]);
    const approved = accountRows.filter((row) => row.status === "approved");
    setAccounts(approved);
    setUid((current) => current || approved[0]?.uid || "");
    setAttendance(attendanceRows);
    if (week) {
      setWeekId(week.weekId);
      setWeekStart(localInput(week.startsAt));
      setWeekEnd(localInput(week.endsAt));
      setWeekEnabled(week.enabled);
    }
    if (season) {
      setSeasonId(season.seasonId);
      setSeasonStart(localInput(season.startsAt));
      setSeasonEnd(localInput(season.endsAt));
    }
  };

  useEffect(() => {
    void load();
  }, []);
  const selected = accounts.find((row) => row.uid === uid) ?? null;

  const manualAdjust = async () => {
    if (!selected || !reason.trim()) return setNotice("Гишүүн болон шалтгааныг сонгоно уу.");
    const xpValue = Math.trunc(Number(xp) || 0);
    const coinValue = Math.trunc(Number(coin) || 0);
    if (!xpValue && !coinValue) return setNotice("XP эсвэл ONI өөрчлөлт оруулна уу.");
    setBusy("manual");
    setNotice("");
    try {
      const r = await adjustManualProgression({
        uid: selected.uid,
        nickname: selected.nickname,
        xp: xpValue,
        coin: coinValue,
        reason,
      });
      setNotice(
        `${selected.nickname} · XP ${r.xpAfter.toLocaleString()} · ONI ${r.balanceAfter.toLocaleString()}`,
      );
      setXp("0");
      setCoin("0");
      setReason("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Өөрчлөлт амжилтгүй.");
    } finally {
      setBusy("");
    }
  };

  const eventReward = async () => {
    if (!selected || !eventId.trim()) return setNotice("Гишүүн болон эвентийн ID шаардлагатай.");
    setBusy("event");
    setNotice("");
    try {
      const r = await grantEventReward({
        uid: selected.uid,
        nickname: selected.nickname,
        eventId,
        placement,
      });
      setNotice(`${selected.nickname} · +${r.xp} XP · +${r.coin} ONI`);
      setEventId("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Эвентийн шагнал амжилтгүй.");
    } finally {
      setBusy("");
    }
  };

  const attendanceAction = async (row: AttendanceCandidate) => {
    setBusy(`attendance:${row.uid}`);
    setNotice("");
    try {
      if (row.confirmed) await revokeCurrentMeetAttendance(row.uid);
      else await confirmCurrentMeetAttendance(row.uid);
      await load();
      setNotice(row.confirmed ? "Оролцооны баталгаа цуцлагдлаа." : "Оролцоо баталгаажлаа.");
    } catch {
      setNotice("Оролцооны төлөв шинэчилж чадсангүй.");
    } finally {
      setBusy("");
    }
  };

  const saveWeek = async () => {
    if (!weekId || !weekStart || !weekEnd) return setNotice("Week ID болон хугацаа шаардлагатай.");
    setBusy("week");
    try {
      await configureEconomyWeek({
        weekId,
        startsAt: new Date(weekStart),
        endsAt: new Date(weekEnd),
        enabled: weekEnabled,
      });
      setNotice("Долоо хоногийн тохиргоо хадгалагдлаа.");
      await load();
    } catch {
      setNotice("Week тохиргоо амжилтгүй.");
    } finally {
      setBusy("");
    }
  };

  const startSeason = async () => {
    if (!seasonId || !seasonStart || !seasonEnd)
      return setNotice("Season ID болон хугацаа шаардлагатай.");
    setBusy("season");
    try {
      await startNewEconomySeason({
        seasonId,
        startsAt: new Date(seasonStart),
        endsAt: new Date(seasonEnd),
      });
      setNotice("Шинэ season эхэллээ.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Season эхлүүлж чадсангүй.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Economy"
        title="XP, ONI ба улирал"
        desc="Гишүүний balance, event reward, Meet attendance, долоо хоног болон season тохиргоог нэг дор удирдана."
        actions={
          <button type="button" className={secondaryButton} onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Шинэчлэх
          </button>
        }
      />
      {notice ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/60">
          {notice}
        </p>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-300" />
            <h3 className="font-semibold text-white">XP / ONI засвар</h3>
          </div>
          <select
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            className={`${inputClass} mt-4`}
          >
            {accounts.map((row) => (
              <option key={row.uid} value={row.uid}>
                {row.nickname} · {row.cpmId}
              </option>
            ))}
          </select>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              type="number"
              value={xp}
              onChange={(e) => setXp(e.target.value)}
              placeholder="XP +/-"
              className={inputClass}
            />
            <input
              type="number"
              value={coin}
              onChange={(e) => setCoin(e.target.value)}
              placeholder="ONI +/-"
              className={inputClass}
            />
          </div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Шалтгаан *"
            className={`${inputClass} mt-3`}
          />
          <button
            type="button"
            className={`${primaryButton} mt-3 w-full`}
            disabled={busy === "manual"}
            onClick={() => void manualAdjust()}
          >
            {busy === "manual" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CircleDollarSign className="h-4 w-4" />
            )}
            Хадгалах
          </button>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-purple-300" />
            <h3 className="font-semibold text-white">Event reward</h3>
          </div>
          <input
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            placeholder="Event ID"
            className={`${inputClass} mt-4`}
          />
          <select
            value={placement}
            onChange={(e) => setPlacement(e.target.value as EventRewardPlacement)}
            className={`${inputClass} mt-3`}
          >
            <option value="participation">Оролцсон</option>
            <option value="third">3-р байр</option>
            <option value="second">2-р байр</option>
            <option value="first">1-р байр</option>
          </select>
          <button
            type="button"
            className={`${primaryButton} mt-3 w-full`}
            disabled={busy === "event" || !selected}
            onClick={() => void eventReward()}
          >
            {busy === "event" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Award className="h-4 w-4" />
            )}
            Шагнал олгох
          </button>
        </section>
      </div>
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">Meet attendance</h3>
            <p className="mt-1 text-xs text-white/35">
              Бүртгэлтэй гишүүний бодит оролцоог баталгаажуулна.
            </p>
          </div>
          <span className="text-xs text-white/30">{attendance.length}</span>
        </div>
        <div className="mt-4 divide-y divide-white/10">
          {attendance.map((row) => (
            <div key={row.uid} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm text-white/75">{row.nickname}</p>
                <p className={`text-xs ${row.confirmed ? "text-emerald-300/70" : "text-white/30"}`}>
                  {row.confirmed ? "Баталгаажсан" : "Зөвхөн бүртгүүлсэн"}
                </p>
              </div>
              <button
                type="button"
                className={row.confirmed ? secondaryButton : successButton}
                disabled={busy === `attendance:${row.uid}`}
                onClick={() => void attendanceAction(row)}
              >
                {row.confirmed ? "Цуцлах" : "Батлах"}
              </button>
            </div>
          ))}
          {attendance.length === 0 ? (
            <p className="py-4 text-xs text-white/30">Одоогийн Meet-д бүртгэл алга.</p>
          ) : null}
        </div>
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-white/40" />
            <h3 className="font-semibold text-white">Долоо хоногийн тохиргоо</h3>
          </div>
          <div className="mt-4 space-y-2">
            <input
              value={weekId}
              onChange={(e) => setWeekId(e.target.value)}
              placeholder="2026-W37"
              className={inputClass}
            />
            <input
              type="datetime-local"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className={inputClass}
            />
            <input
              type="datetime-local"
              value={weekEnd}
              onChange={(e) => setWeekEnd(e.target.value)}
              className={inputClass}
            />
            <label className="flex items-center gap-2 text-xs text-white/50">
              <input
                type="checkbox"
                checked={weekEnabled}
                onChange={(e) => setWeekEnabled(e.target.checked)}
              />
              Шагнал авах эрх нээлттэй
            </label>
            <button
              type="button"
              className={`${secondaryButton} w-full`}
              disabled={busy === "week"}
              onClick={() => void saveWeek()}
            >
              Week хадгалах
            </button>
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-white/40" />
            <h3 className="font-semibold text-white">Season удирдлага</h3>
          </div>
          <div className="mt-4 space-y-2">
            <input
              value={seasonId}
              onChange={(e) => setSeasonId(e.target.value)}
              placeholder="Season ID"
              className={inputClass}
            />
            <input
              type="datetime-local"
              value={seasonStart}
              onChange={(e) => setSeasonStart(e.target.value)}
              className={inputClass}
            />
            <input
              type="datetime-local"
              value={seasonEnd}
              onChange={(e) => setSeasonEnd(e.target.value)}
              className={inputClass}
            />
            <button
              type="button"
              className={`${dangerButton} w-full`}
              disabled={busy === "season"}
              onClick={() => void startSeason()}
            >
              Шинэ season эхлүүлэх
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function GarageWorkspace({
  actor,
  onConfirm,
}: {
  actor: AdminActor | null;
  onConfirm: (confirmation: Confirmation) => void;
}) {
  const [result, setResult] = useState<DataResult<AdminVehicleRecord> | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AdminVehicleRecord | "new" | null>(null);
  const [draft, setDraft] = useState({
    model: "",
    owner: "",
    category: "",
    build: "",
    imagePath: "",
    status: "draft",
  });
  const [notice, setNotice] = useState("");
  const canWrite = hasPermission(actor ? { ...actor } : null, "garage.write");
  const load = async () => setResult(await getVehicles());
  useEffect(() => {
    void load();
  }, []);
  const openEdit = (row: AdminVehicleRecord | "new") => {
    setEditing(row);
    setNotice("");
    setDraft(
      row === "new"
        ? { model: "", owner: "", category: "", build: "", imagePath: "", status: "draft" }
        : {
            model: row.model,
            owner: row.owner === "—" ? "" : row.owner,
            category: row.category,
            build: row.build,
            imagePath: row.imagePath,
            status: row.status,
          },
    );
  };
  const save = async () => {
    if (!draft.model.trim()) return setNotice("Модель шаардлагатай.");
    const payload = {
      model: draft.model.trim(),
      owner_name: draft.owner.trim() || null,
      category: draft.category.trim() || null,
      build: draft.build.trim() || null,
      image_path: draft.imagePath.trim() || null,
      status: draft.status,
    };
    const response = await dispatchAdminAction(
      editing === "new"
        ? { kind: "vehicle.create", payload }
        : { kind: "vehicle.update", targetId: (editing as AdminVehicleRecord).id, payload },
      actor,
    );
    if (!response.ok) return setNotice(response.error);
    setEditing(null);
    await load();
  };
  const rows =
    result?.status === "ok"
      ? result.rows.filter(
          (row) =>
            !query.trim() ||
            `${row.model} ${row.owner} ${row.category}`.toLowerCase().includes(query.toLowerCase()),
        )
      : [];
  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Content"
        title="Garage"
        desc="Автомашины бүртгэл, нийтлэлт болон архивыг нэг дэлгэцээс удирдана."
        actions={
          <button
            type="button"
            className={primaryButton}
            disabled={!canWrite}
            onClick={() => openEdit("new")}
          >
            <Plus className="h-4 w-4" />
            Шинэ машин
          </button>
        }
      />
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Модель, owner, ангиллаар хайх…"
          className={`${inputClass} pl-10`}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <article
            key={row.id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
          >
            {row.imagePath ? (
              <div className="aspect-[16/10] bg-black/20">
                <img src={row.imagePath} alt={row.model} className="h-full w-full object-cover" />
              </div>
            ) : null}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-white">{row.model}</p>
                  <p className="mt-1 text-xs text-white/35">
                    {row.owner} · {row.category || "—"}
                  </p>
                </div>
                <span className="text-[0.62rem] text-white/35">{row.status}</span>
              </div>
              {canWrite ? (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button type="button" className={secondaryButton} onClick={() => openEdit(row)}>
                    Засах
                  </button>
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() =>
                      onConfirm({
                        kind: "vehicle.archive",
                        targetId: row.id,
                        title: "Машиныг архивлах уу?",
                        body: row.model,
                        risk: "medium",
                        onDone: () => void load(),
                      })
                    }
                  >
                    Архив
                  </button>
                  <button
                    type="button"
                    className={dangerButton}
                    onClick={() =>
                      onConfirm({
                        kind: "vehicle.delete",
                        targetId: row.id,
                        title: "Машиныг устгах уу?",
                        body: row.model,
                        risk: "high",
                        onDone: () => void load(),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {editing ? (
        <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setEditing(null)}
            aria-label="Хаах"
          />
          <section className="relative w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#101015] p-5 sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">
                {editing === "new" ? "Шинэ машин" : "Машин засах"}
              </h3>
              <button type="button" className={secondaryButton} onClick={() => setEditing(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <input
                value={draft.model}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                placeholder="Модель *"
                className={inputClass}
              />
              <input
                value={draft.owner}
                onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
                placeholder="Owner"
                className={inputClass}
              />
              <input
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                placeholder="Ангилал"
                className={inputClass}
              />
              <input
                value={draft.build}
                onChange={(e) => setDraft({ ...draft, build: e.target.value })}
                placeholder="Build"
                className={inputClass}
              />
              <input
                value={draft.imagePath}
                onChange={(e) => setDraft({ ...draft, imagePath: e.target.value })}
                placeholder="Image URL"
                className="sm:col-span-2 min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-base text-white sm:text-sm"
              />
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                className={`${inputClass} sm:col-span-2`}
              >
                <option value="draft">Ноорог</option>
                <option value="published">Нийтэлсэн</option>
                <option value="archived">Архив</option>
              </select>
            </div>
            {notice ? <p className="mt-3 text-xs text-red-200">{notice}</p> : null}
            <button
              type="button"
              className={`${primaryButton} mt-4 w-full`}
              onClick={() => void save()}
            >
              Хадгалах
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function CreatorWorkspace() {
  const [rows, setRows] = useState<CreatorPublishRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const load = async () => {
    setLoading(true);
    try {
      setRows(await listCreatorPublishRequests("pending"));
    } catch {
      setNotice("Creator хүсэлт ачаалж чадсангүй.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const review = async (row: CreatorPublishRequest, approve: boolean) => {
    setBusy(row.id);
    try {
      await reviewCreatorPublishRequest(row.id, approve ? "approved" : "rejected");
      setNotice(approve ? "Зураг нийтлэгдлээ." : "Хүсэлт татгалзагдлаа.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Алдаа гарлаа.");
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Content"
        title="Creator хүсэлт"
        desc="Гишүүдийн нийтлүүлэх зураг, preset болон owner мэдээллийг шалгаад approve / reject хийнэ."
        actions={
          <button type="button" className={secondaryButton} onClick={() => void load()}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Шинэчлэх
          </button>
        }
      />
      {notice ? (
        <p className="rounded-xl border border-white/10 p-3 text-xs text-white/55">{notice}</p>
      ) : null}
      {!loading && rows.length === 0 ? (
        <EmptyState
          title="Хүлээгдэж буй Creator хүсэлт алга"
          desc="Шинэ хүсэлт ирэхэд энд харагдана."
        />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <article
            key={row.id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
          >
            <div className="aspect-[4/3] bg-black/20">
              <img src={row.image} alt={row.title} className="h-full w-full object-contain" />
            </div>
            <div className="p-4">
              <p className="font-semibold text-white">{row.title}</p>
              <p className="mt-1 text-xs text-white/35">
                {row.nickname} · {row.preset}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={successButton}
                  disabled={busy === row.id}
                  onClick={() => void review(row, true)}
                >
                  <Check className="h-4 w-4" />
                  Батлах
                </button>
                <button
                  type="button"
                  className={dangerButton}
                  disabled={busy === row.id}
                  onClick={() => void review(row, false)}
                >
                  <X className="h-4 w-4" />
                  Татгалзах
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function MusicWorkspace({
  actor,
  onConfirm,
}: {
  actor: AdminActor | null;
  onConfirm: (confirmation: Confirmation) => void;
}) {
  const [result, setResult] = useState<DataResult<AdminTrackRecord> | null>(null);
  const [editing, setEditing] = useState<AdminTrackRecord | "new" | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    artist: "",
    source: "",
    sortOrder: "0",
    duration: "0",
    status: "draft",
  });
  const [notice, setNotice] = useState("");
  const canWrite = hasPermission(actor ? { ...actor } : null, "music.write");
  const load = async () => setResult(await getTracks());
  useEffect(() => {
    void load();
  }, []);
  const open = (row: AdminTrackRecord | "new") => {
    setEditing(row);
    setNotice("");
    setDraft(
      row === "new"
        ? { title: "", artist: "", source: "", sortOrder: "0", duration: "0", status: "draft" }
        : {
            title: row.title,
            artist: row.artist,
            source: row.source,
            sortOrder: String(row.sortOrder),
            duration: String(row.durationSeconds),
            status: row.status,
          },
    );
  };
  const save = async () => {
    if (!draft.title.trim()) return setNotice("Гарчиг шаардлагатай.");
    const payload = {
      title: draft.title.trim(),
      artist: draft.artist.trim() || null,
      source_url: draft.source.trim() || null,
      sort_order: Number(draft.sortOrder || 0),
      duration_seconds: Number(draft.duration || 0),
      status: draft.status,
    };
    const response = await dispatchAdminAction(
      editing === "new"
        ? { kind: "track.create", payload }
        : { kind: "track.update", targetId: (editing as AdminTrackRecord).id, payload },
      actor,
    );
    if (!response.ok) return setNotice(response.error);
    setEditing(null);
    await load();
  };
  const rows = result?.status === "ok" ? result.rows : [];
  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Content"
        title="Хөгжим"
        desc="ONI AI болон Music хэсгийн трек мета өгөгдлийг удирдана."
        actions={
          <button
            type="button"
            className={primaryButton}
            disabled={!canWrite}
            onClick={() => open("new")}
          >
            <Plus className="h-4 w-4" />
            Шинэ трек
          </button>
        }
      />
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-semibold text-white">{row.title}</p>
              <p className="mt-1 text-xs text-white/35">
                {row.artist || "—"} · #{row.sortOrder} · {row.status}
              </p>
            </div>
            {canWrite ? (
              <div className="flex gap-2">
                <button type="button" className={secondaryButton} onClick={() => open(row)}>
                  Засах
                </button>
                <button
                  type="button"
                  className={dangerButton}
                  onClick={() =>
                    onConfirm({
                      kind: "track.delete",
                      targetId: row.id,
                      title: "Трек устгах уу?",
                      body: row.title,
                      risk: "high",
                      onDone: () => void load(),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {editing ? (
        <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Хаах"
            onClick={() => setEditing(null)}
          />
          <section className="relative w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#101015] p-5 sm:rounded-3xl">
            <h3 className="text-xl font-semibold text-white">
              {editing === "new" ? "Шинэ трек" : "Трек засах"}
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Гарчиг *"
                className={inputClass}
              />
              <input
                value={draft.artist}
                onChange={(e) => setDraft({ ...draft, artist: e.target.value })}
                placeholder="Artist"
                className={inputClass}
              />
              <input
                value={draft.source}
                onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                placeholder="Source URL"
                className={`${inputClass} sm:col-span-2`}
              />
              <input
                type="number"
                value={draft.sortOrder}
                onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
                placeholder="Sort"
                className={inputClass}
              />
              <input
                type="number"
                value={draft.duration}
                onChange={(e) => setDraft({ ...draft, duration: e.target.value })}
                placeholder="Seconds"
                className={inputClass}
              />
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                className={`${inputClass} sm:col-span-2`}
              >
                <option value="draft">Ноорог</option>
                <option value="published">Нийтэлсэн</option>
              </select>
            </div>
            {notice ? <p className="mt-3 text-xs text-red-200">{notice}</p> : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className={secondaryButton} onClick={() => setEditing(null)}>
                Болих
              </button>
              <button type="button" className={primaryButton} onClick={() => void save()}>
                Хадгалах
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function HealthWorkspace() {
  const services = useMemo(() => getServiceStatuses(), []);
  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="System"
        title="Системийн төлөв"
        desc="Frontend-д бодитоор мэдэгдэж буй backend, database, auth, AI, Meet болон storage төлөв."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <div key={service.key} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/35">{service.code}</span>
              <StateDot ok={service.state === "connected"} />
            </div>
            <p className="mt-3 font-semibold text-white">{service.label}</p>
            <p className="mt-1 text-xs leading-5 text-white/35">{service.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditWorkspace() {
  const [result, setResult] = useState<DataResult<Record<string, unknown>> | null>(null);
  const [query, setQuery] = useState("");
  const load = async () =>
    setResult((await getAuditEvents()) as DataResult<Record<string, unknown>>);
  useEffect(() => {
    void load();
  }, []);
  const rows =
    result?.status === "ok"
      ? result.rows.filter(
          (row) => !query.trim() || JSON.stringify(row).toLowerCase().includes(query.toLowerCase()),
        )
      : [];
  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="System"
        title="Үйлдлийн бүртгэл"
        desc="Админ action бүрийн actor, target, severity болон үр дүнг хүн уншихад ойлгомжтой байдлаар харуулна."
        actions={
          <button type="button" className={secondaryButton} onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Шинэчлэх
          </button>
        }
      />
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Admin, action, target-аар хайх…"
          className={`${inputClass} pl-10`}
        />
      </label>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={String(row["id"] ?? index)}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white/80">{String(row["action"] ?? "—")}</p>
              <span className="text-[0.62rem] uppercase text-white/30">
                {String(row["severity"] ?? "")} · {String(row["result"] ?? "")}
              </span>
            </div>
            <p className="mt-2 text-xs text-white/35">
              {String(row["createdAt"] ?? "")} · {String(row["actorRole"] ?? "")}
              {row["target"] ? ` · ${String(row["target"])}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PermissionsWorkspace() {
  const permissions: AdminPermission[] = [
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
  ];
  const roles = ["owner", "admin", "moderator"] as const;
  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Access"
        title="Role ба permission"
        desc="Owner, Admin, Moderator бүр ямар үйлдэл хийх эрхтэйг нэг хүснэгтээр харуулна."
      />
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-[44rem] w-full text-left text-xs">
          <thead className="bg-white/[0.03] text-white/45">
            <tr>
              <th className="p-3 font-medium">Permission</th>
              {roles.map((role) => (
                <th key={role} className="p-3 text-center font-medium uppercase">
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {permissions.map((permission) => (
              <tr key={permission}>
                <td className="p-3 text-white/65">{permission}</td>
                {roles.map((role) => (
                  <td key={role} className="p-3 text-center">
                    {ROLE_PERMISSIONS[role].includes(permission) ? (
                      <Check className="mx-auto h-4 w-4 text-emerald-300" />
                    ) : (
                      <X className="mx-auto h-4 w-4 text-white/15" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AiWorkspace({
  actor,
  onConfirm,
}: {
  actor: AdminActor | null;
  onConfirm: (confirmation: Confirmation) => void;
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
    const result = await submitCommand(text, tier);
    setResponse(result);
    setBusy(false);
  };
  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="ONI Admin"
        title="Админ команд"
        desc="AI command нь floating character биш. Тодорхой task, permission, confirmation дээр төвлөрсөн ажлын хэрэгсэл."
      />
      <div className="grid gap-2 sm:grid-cols-3">
        {COMMAND_TIERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTier(item.id)}
            className={`rounded-2xl border p-4 text-left ${tier === item.id ? "border-white/25 bg-white/[0.06]" : "border-white/10 bg-white/[0.02]"}`}
          >
            <p className="text-xs font-semibold text-white/75">{item.label}</p>
            <p className="mt-1 text-xs leading-5 text-white/35">{item.desc}</p>
          </button>
        ))}
      </div>
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          placeholder="Ж: Хүлээгдэж буй анкетуудыг шалга"
          className={`${inputClass} resize-none py-3`}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={primaryButton}
            disabled={busy || !input.trim()}
            onClick={() => void send()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            Илгээх
          </button>
          <span className="text-xs text-white/30">
            {ADMIN_AI_CONNECTED ? "ENGINE ONLINE" : "ENGINE OFFLINE"}
          </span>
        </div>
      </section>
      <div className="flex flex-wrap gap-2">
        {COMMAND_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.text}
            type="button"
            className={secondaryButton}
            onClick={() => {
              setTier(suggestion.tier);
              setInput(suggestion.text);
            }}
          >
            {suggestion.text}
          </button>
        ))}
      </div>
      {response ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-xs leading-5 text-white/55">
            {response.status === "plan" ? response.plan.rationale : response.message}
          </p>
          {response.status === "plan" ? (
            <div className="mt-4 space-y-2">
              {response.plan.actions.map((action, index) => (
                <div
                  key={`${action.kind}-${index}`}
                  className="rounded-xl border border-white/10 p-3"
                >
                  <p className="text-xs font-semibold text-white/70">{action.summary}</p>
                  <p className="mt-1 text-[0.62rem] uppercase text-white/30">
                    {action.kind} · {action.risk}
                  </p>
                  {action.missingParams.length === 0 ? (
                    <button
                      type="button"
                      className={`${primaryButton} mt-3`}
                      disabled={!actor}
                      onClick={() =>
                        onConfirm({
                          kind: action.kind,
                          title: "Үйлдлийг баталгаажуулах",
                          body: action.summary,
                          risk: action.risk,
                        })
                      }
                    >
                      Баталгаажуулах
                    </button>
                  ) : (
                    <p className="mt-2 text-xs text-amber-200/70">
                      Дутуу параметр: {action.missingParams.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export function OniAdminV3() {
  const auth = useOniAuth();
  const actor: AdminActor | null =
    auth.phase === "authorized" && auth.profile
      ? { uid: auth.profile.uid, role: auth.profile.role }
      : null;
  const [section, setSection] = useState<MainSection>("dashboard");
  const [memberTab, setMemberTab] = useState<MemberTab>("inbox");
  const [operationsTab, setOperationsTab] = useState<OperationsTab>("meet");
  const [contentTab, setContentTab] = useState<ContentTab>("garage");
  const [systemTab, setSystemTab] = useState<SystemTab>("health");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const jump = (target: Jump) => {
    setSection(target.section);
    if (target.section === "members" && target.tab) setMemberTab(target.tab as MemberTab);
    if (target.section === "operations" && target.tab)
      setOperationsTab(target.tab as OperationsTab);
    if (target.section === "content" && target.tab) setContentTab(target.tab as ContentTab);
    if (target.section === "system" && target.tab) setSystemTab(target.tab as SystemTab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-[100svh] bg-[#09090d] text-white">
      <OniHudNav />
      <div className="mx-auto flex min-h-[100svh] max-w-[112rem] pt-20 sm:pt-24">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 px-4 py-5 lg:block">
          <div className="sticky top-24">
            <div className="px-2 pb-5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-crimson/75">
                ONI HUB
              </p>
              <h1 className="mt-1 text-lg font-semibold">Admin V3</h1>
              <div className="mt-3 flex items-center gap-2 text-xs text-white/35">
                <StateDot ok={!!actor} />
                <span>{actor ? `${actor.role.toUpperCase()} · ONLINE` : "LOCKED"}</span>
              </div>
            </div>
            <nav aria-label="Admin V3 main" className="space-y-1">
              {MAIN_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${section === item.id ? "bg-white text-black" : "text-white/55 hover:bg-white/[0.05] hover:text-white"}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span
                        className={`mt-0.5 block text-[0.62rem] ${section === item.id ? "text-black/50" : "text-white/25"}`}
                      >
                        {item.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
            <button
              type="button"
              onClick={() => void auth.signOut()}
              className="mt-6 flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-xs text-white/35 transition hover:bg-white/[0.05] hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Гарах
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-28 sm:px-6 lg:px-8 lg:pb-12">
          <header className="mb-5 flex items-center justify-between gap-3 border-b border-white/10 py-4 lg:py-5">
            <div className="min-w-0">
              <p className="text-[0.62rem] uppercase tracking-[0.16em] text-white/25">
                {auth.email}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-white/80">
                {MAIN_NAV.find((item) => item.id === section)?.label}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/40">
              <StateDot ok={true} />
              Firebase
            </div>
          </header>

          {section === "dashboard" ? <Dashboard onJump={jump} /> : null}
          {section === "members" ? (
            <div className="space-y-5">
              <Subnav
                value={memberTab}
                onChange={setMemberTab}
                items={[
                  { id: "inbox", label: "Inbox" },
                  { id: "members", label: "Гишүүд" },
                ]}
              />
              {memberTab === "inbox" ? (
                <UnifiedInbox actor={actor} />
              ) : (
                <MembersWorkspace actor={actor} onConfirm={setConfirmation} />
              )}
            </div>
          ) : null}
          {section === "operations" ? (
            <div className="space-y-5">
              <Subnav
                value={operationsTab}
                onChange={setOperationsTab}
                items={[
                  { id: "meet", label: "Meet" },
                  { id: "economy", label: "XP / Economy" },
                ]}
              />
              {operationsTab === "meet" ? (
                <MeetWorkspace actor={actor} onConfirm={setConfirmation} />
              ) : (
                <EconomyWorkspace />
              )}
            </div>
          ) : null}
          {section === "content" ? (
            <div className="space-y-5">
              <Subnav
                value={contentTab}
                onChange={setContentTab}
                items={[
                  { id: "garage", label: "Garage" },
                  { id: "creator", label: "Creator" },
                  { id: "music", label: "Music" },
                ]}
              />
              {contentTab === "garage" ? (
                <GarageWorkspace actor={actor} onConfirm={setConfirmation} />
              ) : contentTab === "creator" ? (
                <CreatorWorkspace />
              ) : (
                <MusicWorkspace actor={actor} onConfirm={setConfirmation} />
              )}
            </div>
          ) : null}
          {section === "system" ? (
            <div className="space-y-5">
              <Subnav
                value={systemTab}
                onChange={setSystemTab}
                items={[
                  { id: "health", label: "Health" },
                  { id: "audit", label: "Audit" },
                  { id: "permissions", label: "Permissions" },
                  { id: "ai", label: "ONI Command" },
                ]}
              />
              {systemTab === "health" ? (
                <HealthWorkspace />
              ) : systemTab === "audit" ? (
                <AuditWorkspace />
              ) : systemTab === "permissions" ? (
                <PermissionsWorkspace />
              ) : (
                <AiWorkspace actor={actor} onConfirm={setConfirmation} />
              )}
            </div>
          ) : null}
        </main>
      </div>

      <nav
        aria-label="Admin V3 mobile"
        className="fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-[90] grid grid-cols-5 rounded-2xl border border-white/10 bg-[#121218]/95 p-1 shadow-2xl backdrop-blur-xl lg:hidden"
      >
        {MAIN_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[0.58rem] font-medium transition ${section === item.id ? "bg-white text-black" : "text-white/40"}`}
            >
              <Icon className="h-4 w-4" />
              {item.id === "dashboard"
                ? "Нүүр"
                : item.id === "members"
                  ? "Гишүүд"
                  : item.id === "operations"
                    ? "Ops"
                    : item.id === "content"
                      ? "Контент"
                      : "Систем"}
            </button>
          );
        })}
      </nav>

      <ConfirmDialog
        confirmation={confirmation}
        actor={actor}
        onClose={() => setConfirmation(null)}
      />
    </div>
  );
}
