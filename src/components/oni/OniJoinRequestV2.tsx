import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Gamepad2,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";

import {
  CPM_ID_MAX,
  EXPERIENCE_OPTIONS,
  INTEREST_OPTIONS,
  MESSAGE_MAX,
  NICKNAME_MAX,
  checkJoinMembershipStatus,
  readJoinMembershipWatch,
  submitApplication,
  validateApplication,
  type ExperienceLevel,
  type JoinApplication,
  type JoinFieldErrors,
  type JoinInterest,
  type JoinMembershipStatus,
  type JoinMembershipWatch,
} from "@/data/join";
import { OniFooter } from "./OniFooter";
import { OniHudNav } from "./OniHudNav";

const EMPTY: JoinApplication = {
  lastName: "",
  firstName: "",
  age: "",
  gender: "Эрэгтэй",
  cpmNickname: "",
  cpmId: "",
  direction: "Anime Car",
  contactType: "Instagram",
  contact: "",
  experience: "regular",
  interests: [],
  message: "",
};

const fieldClass =
  "min-h-[48px] w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-base text-white outline-none transition placeholder:text-white/25 focus:border-crimson/60 focus:bg-black/35 sm:text-sm";
const choiceClass =
  "min-h-11 rounded-xl border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/50";

type SubmitStatus = "idle" | "loading" | "sent" | "failed";
type StepIndex = 0 | 1 | 2 | 3;

type StepDefinition = {
  title: string;
  short: string;
  description: string;
  icon: typeof UserRound;
};

const STEPS: StepDefinition[] = [
  {
    title: "Хувийн мэдээлэл",
    short: "Таны тухай",
    description: "Нэр, нас зэрэг үндсэн мэдээлэл.",
    icon: UserRound,
  },
  {
    title: "CPM мэдээлэл",
    short: "Тоглоомын мэдээлэл",
    description: "CPM nickname, ID болон үндсэн чиглэл.",
    icon: Gamepad2,
  },
  {
    title: "Туршлага ба холбоо",
    short: "Туршлага",
    description: "Холбоо барих суваг, сонирхол, нэмэлт тайлбар.",
    icon: MessageCircle,
  },
  {
    title: "Шалгах ба илгээх",
    short: "Баталгаажуулах",
    description: "Бүх мэдээллээ нэг дор шалгаад илгээнэ.",
    icon: ShieldCheck,
  },
];

const STEP_FIELDS: Array<Array<keyof JoinApplication>> = [
  ["lastName", "firstName", "age", "gender"],
  ["cpmNickname", "cpmId", "direction"],
  ["contactType", "contact", "experience", "interests", "message"],
  [],
];

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-2 text-xs text-red-300">{message}</p> : null;
}

function ProgressSteps({ step }: { step: StepIndex }) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Хүсэлтийн алхам">
      {STEPS.map((item, index) => {
        const active = index === step;
        const done = index < step;
        return (
          <li key={item.title} className="min-w-0">
            <div
              className={`h-1.5 rounded-full transition ${
                done || active ? "bg-crimson" : "bg-white/10"
              }`}
            />
            <p
              className={`mt-2 truncate text-[0.62rem] font-semibold ${
                active ? "text-white" : done ? "text-white/65" : "text-white/30"
              }`}
            >
              {index + 1}. {item.short}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function StatusTimeline({ status }: { status: JoinMembershipStatus }) {
  const final = status.state === "accepted" || status.state === "rejected";
  const finalAccepted = status.state === "accepted";

  const rows = [
    {
      title: "Хүсэлт хүлээн авсан",
      description: "Таны хүсэлт системд амжилттай бүртгэгдсэн.",
      state: "done" as const,
    },
    {
      title: status.state === "pending" ? "Админ шалгаж байна" : "Админ шалгасан",
      description:
        status.state === "pending"
          ? "Бүрэлдэхүүний баг мэдээллийг шалгаж байна."
          : "Бүрэлдэхүүний баг шийдвэр гаргасан.",
      state: status.state === "pending" ? ("active" as const) : ("done" as const),
    },
    {
      title:
        status.state === "accepted"
          ? "Хүсэлт зөвшөөрөгдсөн"
          : status.state === "rejected"
            ? "Хүсэлт татгалзсан"
            : "Шийдвэр хүлээгдэж байна",
      description:
        status.state === "accepted"
          ? "Одоо Crew account үүсгэж, баталгаажуулах дараагийн алхам руу орно."
          : status.state === "rejected"
            ? "Шаардлагатай бол мэдээллээ шинэчлэн дахин хүсэлт илгээж болно."
            : "Шийдвэр гармагц энд автоматаар шинэчлэгдэнэ.",
      state: final
        ? finalAccepted
          ? ("success" as const)
          : ("error" as const)
        : ("idle" as const),
    },
  ];

  return (
    <div className="space-y-1">
      {rows.map((row, index) => {
        const Icon =
          row.state === "success"
            ? CheckCircle2
            : row.state === "error"
              ? XCircle
              : row.state === "done"
                ? Check
                : row.state === "active"
                  ? Clock3
                  : Circle;
        const tone =
          row.state === "success"
            ? "text-emerald-300"
            : row.state === "error"
              ? "text-red-300"
              : row.state === "active"
                ? "text-amber-300"
                : row.state === "done"
                  ? "text-white/70"
                  : "text-white/25";

        return (
          <div key={row.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`grid h-8 w-8 place-items-center rounded-full bg-white/[0.04] ${tone}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              {index < rows.length - 1 ? <span className="h-8 w-px bg-white/10" /> : null}
            </div>
            <div className="pb-5 pt-1">
              <p className={`text-sm font-semibold ${tone}`}>{row.title}</p>
              <p className="mt-1 text-xs leading-5 text-white/38">{row.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RequestStatusCard({
  watch,
  status,
  refreshing,
  onRefresh,
  onStartAgain,
}: {
  watch: JoinMembershipWatch;
  status: JoinMembershipStatus;
  refreshing: boolean;
  onRefresh: () => void;
  onStartAgain: () => void;
}) {
  const statusLabel =
    status.state === "accepted"
      ? "ЗӨВШӨӨРӨГДСӨН"
      : status.state === "rejected"
        ? "ТАТГАЛЗСАН"
        : "ШАЛГАЖ БАЙНА";
  const statusTone =
    status.state === "accepted"
      ? "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-200"
      : status.state === "rejected"
        ? "border-red-500/25 bg-red-500/[0.06] text-red-200"
        : "border-amber-500/25 bg-amber-500/[0.06] text-amber-200";

  return (
    <section className="rounded-3xl border border-white/10 bg-[#111116]/95 p-5 shadow-2xl sm:p-7">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-crimson/80">
            Таны хүсэлт
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-white">#{watch.reference}</h2>
          <p className="mt-2 text-sm text-white/42">
            {watch.cpmNickname} · CPM {watch.cpmId}
          </p>
        </div>
        <span
          className={`w-fit rounded-full border px-3 py-1.5 text-[0.65rem] font-semibold ${statusTone}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-6">
        <StatusTimeline status={status} />
      </div>

      <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <p className="text-xs font-semibold text-white/70">Дараагийн алхам</p>
        <p className="mt-1 text-xs leading-5 text-white/38">
          {status.state === "accepted"
            ? "Элсэлтийн хүсэлт зөвшөөрөгдсөн. Crew account үүсгээд админаар баталгаажуулсны дараа гишүүний хэсгүүдэд нэвтэрнэ."
            : status.state === "rejected"
              ? "Мэдээллээ шалгаад шаардлагатай бол шинэ хүсэлт илгээж болно."
              : "Одоогоор нэмэлт үйлдэл хийх шаардлагагүй. Админ шийдвэр гармагц төлөв шинэчлэгдэнэ."}
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-xs font-semibold text-white/70 transition hover:bg-white/[0.07] disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Төлөв шинэчлэх
        </button>
        {status.state === "rejected" ? (
          <button
            type="button"
            onClick={onStartAgain}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-crimson/45 bg-crimson/12 px-4 text-xs font-semibold text-white transition hover:bg-crimson/20"
          >
            Шинэ хүсэлт бөглөх
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function OniJoinRequestV2() {
  const uid = useId();
  const [values, setValues] = useState<JoinApplication>(EMPTY);
  const [errors, setErrors] = useState<JoinFieldErrors>({});
  const [step, setStep] = useState<StepIndex>(0);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [notice, setNotice] = useState("");
  const [watch, setWatch] = useState<JoinMembershipWatch | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<JoinMembershipStatus>({
    state: "pending",
  });
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [showFormDespiteWatch, setShowFormDespiteWatch] = useState(false);

  const refreshMembershipStatus = useCallback(async (target: JoinMembershipWatch) => {
    setRefreshingStatus(true);
    const result = await checkJoinMembershipStatus(target);
    setMembershipStatus(result);
    setRefreshingStatus(false);
  }, []);

  useEffect(() => {
    const saved = readJoinMembershipWatch();
    if (!saved) return;
    setWatch(saved);
    void refreshMembershipStatus(saved);
  }, [refreshMembershipStatus]);

  useEffect(() => {
    if (!watch || membershipStatus.state !== "pending") return undefined;
    const timer = window.setInterval(() => {
      void refreshMembershipStatus(watch);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [watch, membershipStatus.state, refreshMembershipStatus]);

  const stepDefinition = STEPS[step];
  const StepIcon = stepDefinition.icon;

  const set = <K extends keyof JoinApplication>(key: K, value: JoinApplication[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
    if (submitStatus === "failed") {
      setSubmitStatus("idle");
      setNotice("");
    }
  };

  const toggleInterest = (interest: JoinInterest) => {
    setValues((previous) => ({
      ...previous,
      interests: previous.interests.includes(interest)
        ? previous.interests.filter((item) => item !== interest)
        : [...previous.interests, interest],
    }));
  };

  const experienceLabel = useMemo(
    () => EXPERIENCE_OPTIONS.find((item) => item.id === values.experience)?.label ?? "ТОГТМОЛ",
    [values.experience],
  );

  const validateCurrentStep = () => {
    const allErrors = validateApplication(values);
    const fields = STEP_FIELDS[step];
    const currentErrors = Object.fromEntries(
      fields.flatMap((field) => (allErrors[field] ? [[field, allErrors[field]]] : [])),
    ) as JoinFieldErrors;
    setErrors((previous) => ({ ...previous, ...currentErrors }));
    return Object.keys(currentErrors).length === 0;
  };

  const next = () => {
    if (step === 3) return;
    if (!validateCurrentStep()) {
      setNotice("Улаанаар тэмдэглэсэн мэдээллийг шалгана уу.");
      return;
    }
    setNotice("");
    setStep((step + 1) as StepIndex);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const back = () => {
    if (step === 0) return;
    setNotice("");
    setStep((step - 1) as StepIndex);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitStatus === "loading") return;

    const nextErrors = validateApplication(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const firstError = Object.keys(nextErrors)[0] as keyof JoinApplication;
      const errorStep = STEP_FIELDS.findIndex((fields) => fields.includes(firstError));
      setStep(Math.max(0, errorStep) as StepIndex);
      setSubmitStatus("failed");
      setNotice("Мэдээллээ дахин шалгана уу.");
      return;
    }

    setSubmitStatus("loading");
    setNotice("");
    const result = await submitApplication(values);
    if (!result.ok) {
      setSubmitStatus("failed");
      setNotice(result.error);
      return;
    }

    setSubmitStatus("sent");
    const savedWatch = readJoinMembershipWatch();
    if (savedWatch) {
      setWatch(savedWatch);
      setMembershipStatus({ state: "pending" });
      setShowFormDespiteWatch(false);
      void refreshMembershipStatus(savedWatch);
    }
  };

  const showStatus = watch && !showFormDespiteWatch;

  return (
    <div className="min-h-screen bg-[#09090d] text-white">
      <OniHudNav />

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-24 sm:px-7 sm:pt-28 lg:pt-32">
        <section className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:gap-10">
          <aside className="self-start lg:sticky lg:top-28">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-crimson/80">
              Join request
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Oni & Kishin-д нэгдэх хүсэлт
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/45">
              Хүсэлтээ 4 богино алхмаар бөглөнө. Илгээсний дараа өөрийн хүсэлтийн төлөвийг энэ
              хуудсаас шалгаж болно.
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-300">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white/80">Яаж ажиллах вэ?</p>
                  <p className="mt-1 text-xs leading-5 text-white/38">
                    Та мэдээллээ илгээнэ → админ шалгана → шийдвэр таны хүсэлтийн дугаарт харагдана.
                  </p>
                </div>
              </div>
            </div>

            {!showStatus ? (
              <div className="mt-6 hidden space-y-2 lg:block">
                {STEPS.map((item, index) => {
                  const Icon = item.icon;
                  const active = index === step;
                  const done = index < step;
                  return (
                    <div
                      key={item.title}
                      className={`rounded-2xl border p-4 transition ${
                        active
                          ? "border-crimson/35 bg-crimson/[0.06]"
                          : "border-white/8 bg-white/[0.015]"
                      }`}
                    >
                      <div className="flex gap-3">
                        <span
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                            active || done
                              ? "bg-white/10 text-white"
                              : "bg-white/[0.03] text-white/25"
                          }`}
                        >
                          {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                        </span>
                        <div>
                          <p
                            className={`text-sm font-semibold ${active ? "text-white" : "text-white/55"}`}
                          >
                            {index + 1}. {item.title}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-white/30">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </aside>

          <div className="min-w-0">
            {showStatus ? (
              <RequestStatusCard
                watch={watch}
                status={membershipStatus}
                refreshing={refreshingStatus}
                onRefresh={() => void refreshMembershipStatus(watch)}
                onStartAgain={() => {
                  setValues(EMPTY);
                  setErrors({});
                  setStep(0);
                  setSubmitStatus("idle");
                  setNotice("");
                  setShowFormDespiteWatch(true);
                }}
              />
            ) : (
              <form
                onSubmit={onSubmit}
                noValidate
                className="rounded-3xl border border-white/10 bg-[#111116]/95 p-4 shadow-2xl sm:p-7"
              >
                <ProgressSteps step={step} />

                <div className="mt-7 flex items-start gap-3 border-b border-white/10 pb-5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-white/70">
                    <StepIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/30">
                      {step + 1} / 4
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-white">
                      {stepDefinition.title}
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-white/38">
                      {stepDefinition.description}
                    </p>
                  </div>
                </div>

                {step === 0 ? (
                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-semibold text-white/55">Овог *</span>
                      <input
                        id={`${uid}-last`}
                        className={`${fieldClass} mt-2`}
                        value={values.lastName}
                        maxLength={80}
                        autoComplete="family-name"
                        onChange={(event) => set("lastName", event.target.value)}
                      />
                      <FieldError message={errors.lastName} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-white/55">Нэр *</span>
                      <input
                        id={`${uid}-first`}
                        className={`${fieldClass} mt-2`}
                        value={values.firstName}
                        maxLength={80}
                        autoComplete="given-name"
                        onChange={(event) => set("firstName", event.target.value)}
                      />
                      <FieldError message={errors.firstName} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-white/55">Нас *</span>
                      <input
                        id={`${uid}-age`}
                        type="number"
                        min={17}
                        max={90}
                        inputMode="numeric"
                        className={`${fieldClass} mt-2`}
                        value={values.age}
                        onChange={(event) => set("age", event.target.value)}
                      />
                      <FieldError message={errors.age} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-white/55">Хүйс *</span>
                      <select
                        id={`${uid}-gender`}
                        className={`${fieldClass} mt-2`}
                        value={values.gender}
                        onChange={(event) =>
                          set("gender", event.target.value as JoinApplication["gender"])
                        }
                      >
                        <option value="Эрэгтэй">Эрэгтэй</option>
                        <option value="Эмэгтэй">Эмэгтэй</option>
                      </select>
                    </label>
                  </div>
                ) : null}

                {step === 1 ? (
                  <div className="mt-6 space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-semibold text-white/55">CPM nickname *</span>
                        <input
                          id={`${uid}-nick`}
                          className={`${fieldClass} mt-2`}
                          value={values.cpmNickname}
                          maxLength={NICKNAME_MAX}
                          autoComplete="nickname"
                          placeholder="ONI RIDER"
                          onChange={(event) => set("cpmNickname", event.target.value)}
                        />
                        <FieldError message={errors.cpmNickname} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-white/55">CPM ID *</span>
                        <input
                          id={`${uid}-cpm-id`}
                          className={`${fieldClass} mt-2`}
                          value={values.cpmId}
                          maxLength={CPM_ID_MAX}
                          autoCapitalize="characters"
                          placeholder="ONI0001"
                          onChange={(event) => set("cpmId", event.target.value)}
                        />
                        <FieldError message={errors.cpmId} />
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-xs font-semibold text-white/55">Үндсэн чиглэл *</span>
                      <select
                        className={`${fieldClass} mt-2`}
                        value={values.direction}
                        onChange={(event) =>
                          set("direction", event.target.value as JoinApplication["direction"])
                        }
                      >
                        <option value="Anime Car">Anime Car</option>
                        <option value="Clean Car">Clean Car</option>
                        <option value="Racer / Drifter">Racer / Drifter</option>
                        <option value="Drag Racer">Drag Racer</option>
                        <option value="Content Creator">Content Creator</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="mt-6 space-y-6">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-semibold text-white/55">
                          Холбоо барих суваг *
                        </span>
                        <select
                          className={`${fieldClass} mt-2`}
                          value={values.contactType}
                          onChange={(event) =>
                            set("contactType", event.target.value as JoinApplication["contactType"])
                          }
                        >
                          <option value="Instagram">Instagram</option>
                          <option value="Discord">Discord</option>
                          <option value="Phone">Утас</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-white/55">
                          {values.contactType} мэдээлэл *
                        </span>
                        <input
                          className={`${fieldClass} mt-2`}
                          value={values.contact}
                          autoComplete={values.contactType === "Phone" ? "tel" : "off"}
                          placeholder={
                            values.contactType === "Instagram"
                              ? "@username"
                              : values.contactType === "Discord"
                                ? "username"
                                : "99112233"
                          }
                          onChange={(event) => set("contact", event.target.value)}
                        />
                        <FieldError message={errors.contact} />
                      </label>
                    </div>

                    <fieldset>
                      <legend className="text-xs font-semibold text-white/55">CPM туршлага</legend>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {EXPERIENCE_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={`${choiceClass} ${
                              values.experience === option.id
                                ? "border-crimson/50 bg-crimson/12 text-white"
                                : "border-white/10 bg-white/[0.02] text-white/45 hover:bg-white/[0.05]"
                            }`}
                            onClick={() => set("experience", option.id as ExperienceLevel)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <fieldset>
                      <legend className="text-xs font-semibold text-white/55">
                        Сонирхдог хэсэг{" "}
                        <span className="font-normal text-white/25">· заавал биш</span>
                      </legend>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {INTEREST_OPTIONS.map((option) => {
                          const selected = values.interests.includes(option.id);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              className={`${choiceClass} ${
                                selected
                                  ? "border-white/25 bg-white/10 text-white"
                                  : "border-white/10 bg-white/[0.02] text-white/40 hover:text-white/65"
                              }`}
                              onClick={() => toggleInterest(option.id)}
                            >
                              {selected ? <Check className="mr-1 inline h-3.5 w-3.5" /> : null}
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                    <label className="block">
                      <span className="flex items-center justify-between gap-3 text-xs font-semibold text-white/55">
                        <span>Нэмэлт тайлбар</span>
                        <span className="font-normal text-white/25">
                          {values.message.length}/{MESSAGE_MAX}
                        </span>
                      </span>
                      <textarea
                        className={`${fieldClass} mt-2 min-h-28 resize-y`}
                        value={values.message}
                        maxLength={MESSAGE_MAX}
                        placeholder="Өөрийн тухай эсвэл кланд яагаад нэгдэх хүсэлтэй байгаагаа товч бичиж болно."
                        onChange={(event) => set("message", event.target.value)}
                      />
                      <FieldError message={errors.message} />
                    </label>
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="mt-6 space-y-3">
                    <p className="text-sm leading-6 text-white/45">
                      Илгээхийн өмнө мэдээллээ шалгана уу. Алдаа байвал өмнөх алхам руу буцаж засаж
                      болно.
                    </p>
                    {[
                      ["Нэр", `${values.lastName} ${values.firstName}`],
                      ["Нас / хүйс", `${values.age} · ${values.gender}`],
                      ["CPM", `${values.cpmNickname} · ${values.cpmId}`],
                      ["Чиглэл", values.direction],
                      ["Туршлага", experienceLabel],
                      ["Холбоо", `${values.contactType} · ${values.contact}`],
                      [
                        "Сонирхол",
                        values.interests.length
                          ? INTEREST_OPTIONS.filter((item) => values.interests.includes(item.id))
                              .map((item) => item.label)
                              .join(", ")
                          : "Сонгоогүй",
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="grid gap-1 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4"
                      >
                        <span className="text-xs font-semibold text-white/30">{label}</span>
                        <span className="break-words text-sm text-white/70">{value}</span>
                      </div>
                    ))}
                    {values.message.trim() ? (
                      <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
                        <span className="text-xs font-semibold text-white/30">Нэмэлт тайлбар</span>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/60">
                          {values.message.trim()}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {notice ? (
                  <p
                    className={`mt-5 rounded-xl border p-3 text-xs ${
                      submitStatus === "failed" || Object.keys(errors).length
                        ? "border-red-500/20 bg-red-500/[0.06] text-red-200"
                        : "border-white/10 bg-white/[0.03] text-white/55"
                    }`}
                  >
                    {notice}
                  </p>
                ) : null}

                <div className="mt-7 flex flex-col-reverse gap-2 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={back}
                    disabled={step === 0 || submitStatus === "loading"}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 text-xs font-semibold text-white/55 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-25"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Өмнөх
                  </button>

                  {step < 3 ? (
                    <button
                      type="button"
                      onClick={next}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-crimson/45 bg-crimson/12 px-5 text-xs font-semibold text-white transition hover:bg-crimson/20"
                    >
                      Үргэлжлүүлэх
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitStatus === "loading"}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/15 disabled:opacity-50"
                    >
                      {submitStatus === "loading" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Хүсэлт илгээх
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </section>
      </main>

      <OniFooter />
    </div>
  );
}
