import { useEffect, useId, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

import cityBg from "@/assets/oni-city-bg.jpg";
import {
  CPM_ID_MAX,
  EXPERIENCE_OPTIONS,
  INTEREST_OPTIONS,
  MESSAGE_MAX,
  NICKNAME_MAX,
  submitApplication,
  validateApplication,
  type ExperienceLevel,
  type JoinApplication,
  type JoinFieldErrors,
  type JoinInterest,
} from "@/data/join";
import { NiziiroJoinCharacter } from "./NiziiroJoinCharacter";
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

const LAST_APPLICATION_KEY = "oni_join_last_application_v1";

const fieldClass =
  "w-full min-h-[48px] border border-border bg-ink/70 px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-crimson/70 focus:outline-none sm:text-sm";

type SubmitStatus = "idle" | "loading" | "sent" | "failed";

export function OniJoinProtocol() {
  const uid = useId();
  const [values, setValues] = useState<JoinApplication>(EMPTY);
  const [errors, setErrors] = useState<JoinFieldErrors>({});
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [notice, setNotice] = useState("");
  const [savedReference, setSavedReference] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LAST_APPLICATION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { reference?: string; savedAt?: number };
      if (!saved.reference || !saved.savedAt) return;
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - saved.savedAt > thirtyDays) {
        window.localStorage.removeItem(LAST_APPLICATION_KEY);
        return;
      }
      setSavedReference(saved.reference);
    } catch {
      // localStorage is only a convenience; Firestore remains the source of truth.
    }
  }, []);

  const clearFailure = () => {
    if (status === "failed") {
      setStatus("idle");
      setNotice("");
    }
  };

  const set = <K extends keyof JoinApplication>(key: K, value: JoinApplication[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
    clearFailure();
  };

  const toggleInterest = (id: JoinInterest) => {
    setValues((previous) => ({
      ...previous,
      interests: previous.interests.includes(id)
        ? previous.interests.filter((item) => item !== id)
        : [...previous.interests, id],
    }));
    clearFailure();
  };

  const hasStarted = Boolean(
    values.lastName.trim() ||
    values.firstName.trim() ||
    values.age ||
    values.cpmNickname.trim() ||
    values.cpmId.trim() ||
    values.contact.trim() ||
    values.message.trim() ||
    values.interests.length,
  );

  const guideState =
    status === "sent"
      ? "success"
      : status === "loading"
        ? "loading"
        : status === "failed"
          ? "error"
          : hasStarted
            ? "engaged"
            : "idle";

  const experienceLabel =
    EXPERIENCE_OPTIONS.find((option) => option.id === values.experience)?.label ?? "ТОГТМОЛ";

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === "loading" || status === "sent") return;

    const nextErrors = validateApplication(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setStatus("failed");
      setNotice("Заавал бөглөх мэдээллүүдээ шалгана уу.");
      return;
    }

    setStatus("loading");
    setNotice("");
    const result = await submitApplication(values);

    if (result.ok) {
      setStatus("sent");
      setNotice(`Анкет хүлээн авлаа. Дугаар: ${result.reference}`);
      setSavedReference(result.reference);
      try {
        window.localStorage.setItem(
          LAST_APPLICATION_KEY,
          JSON.stringify({ reference: result.reference, savedAt: Date.now() }),
        );
      } catch {
        // Submission is already safely stored in Firestore.
      }
      return;
    }

    setStatus("failed");
    setNotice(result.error);
  };

  return (
    <div className="relative min-h-screen bg-ink">
      <OniHudNav />

      <main className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img
            src={cityBg}
            alt=""
            aria-hidden="true"
            className="h-full w-full scale-105 object-cover opacity-35"
            decoding="async"
          />
          <div className="absolute inset-0" style={{ background: "var(--gradient-vignette)" }} />
          <div className="absolute inset-0 scanline-veil opacity-25" />
        </div>

        <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 pt-24 sm:px-8 sm:pt-28 lg:grid-cols-[0.88fr_1.12fr] lg:gap-12 lg:pt-36">
          <section className="relative" aria-labelledby="join-title">
            <span className="hud-label hud-rule block pl-11 text-crimson/85">
              SECTOR 04 / JOIN PROTOCOL
            </span>
            <h1 id="join-title" className="mt-4 text-cinema text-5xl text-foreground sm:text-6xl">
              НЭГДЭХ
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              Oni And Kishin кланд элсэх хүсэлт. Мэдээллээ үнэн зөв бөглөнө үү — бүрэлдэхүүний баг
              таны анкетыг шалгана.
            </p>

            <div className="mt-6 lg:mt-8">
              <NiziiroJoinCharacter state={guideState} nickname={values.cpmNickname} />
            </div>

            <ol className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {[
                ["01", "АНКЕТ", "CPM мэдээлэл ба холбоо барих суваг."],
                ["02", "ШАЛГАЛТ", "Бүрэлдэхүүний баг анкетыг хянана."],
                ["03", "ХАРИУ", "Холбоо барих сувгаар хариу очно."],
              ].map(([index, title, description]) => (
                <li key={index} className="glass-panel flex gap-3 px-4 py-3 clip-notch">
                  <span className="hud-label text-crimson">{index}</span>
                  <span>
                    <span className="block text-[0.68rem] tracking-[0.2em] text-foreground">
                      {title}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {description}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section
            className="glass-panel relative self-start p-4 clip-notch sm:p-7"
            aria-labelledby="join-form-title"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 id="join-form-title" className="hud-label text-foreground/80">
                APPLICATION / ЭЛСЭЛТИЙН АНКЕТ
              </h2>
              <span className="hidden text-[0.58rem] tracking-[0.18em] text-emerald-300/70 sm:inline">
                FIRESTORE SECURE
              </span>
            </div>

            {savedReference ? (
              <div className="mt-5 flex items-start gap-3 border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 clip-notch">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Сүүлд илгээсэн хүсэлт бүртгэгдсэн.
                  </p>
                  <p className="mt-1 text-[0.68rem] tracking-[0.12em] text-muted-foreground">
                    REF / {savedReference} · ХЯНАГДАЖ БАЙНА
                  </p>
                </div>
              </div>
            ) : null}

            <form className="mt-6 space-y-5" onSubmit={onSubmit} noValidate>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={`${uid}-last`}
                    className="hud-label mb-2 block text-foreground/70"
                  >
                    ОВОГ *
                  </label>
                  <input
                    id={`${uid}-last`}
                    className={fieldClass}
                    value={values.lastName}
                    maxLength={80}
                    autoComplete="family-name"
                    onChange={(event) => set("lastName", event.target.value)}
                  />
                  {errors.lastName ? (
                    <p className="mt-2 text-xs text-crimson">{errors.lastName}</p>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor={`${uid}-first`}
                    className="hud-label mb-2 block text-foreground/70"
                  >
                    НЭР *
                  </label>
                  <input
                    id={`${uid}-first`}
                    className={fieldClass}
                    value={values.firstName}
                    maxLength={80}
                    autoComplete="given-name"
                    onChange={(event) => set("firstName", event.target.value)}
                  />
                  {errors.firstName ? (
                    <p className="mt-2 text-xs text-crimson">{errors.firstName}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${uid}-age`} className="hud-label mb-2 block text-foreground/70">
                    НАС *
                  </label>
                  <input
                    id={`${uid}-age`}
                    type="number"
                    min={17}
                    max={90}
                    inputMode="numeric"
                    className={fieldClass}
                    value={values.age}
                    onChange={(event) => set("age", event.target.value)}
                  />
                  {errors.age ? <p className="mt-2 text-xs text-crimson">{errors.age}</p> : null}
                </div>

                <div>
                  <label
                    htmlFor={`${uid}-gender`}
                    className="hud-label mb-2 block text-foreground/70"
                  >
                    ХҮЙС *
                  </label>
                  <select
                    id={`${uid}-gender`}
                    className={fieldClass}
                    value={values.gender}
                    onChange={(event) =>
                      set("gender", event.target.value as JoinApplication["gender"])
                    }
                  >
                    <option value="Эрэгтэй">Эрэгтэй</option>
                    <option value="Эмэгтэй">Эмэгтэй</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={`${uid}-nick`}
                    className="hud-label mb-2 block text-foreground/70"
                  >
                    CPM ХОЧ *
                  </label>
                  <input
                    id={`${uid}-nick`}
                    className={fieldClass}
                    value={values.cpmNickname}
                    maxLength={NICKNAME_MAX}
                    autoComplete="nickname"
                    aria-invalid={!!errors.cpmNickname}
                    aria-describedby={errors.cpmNickname ? `${uid}-nick-e` : undefined}
                    onChange={(event) => set("cpmNickname", event.target.value)}
                    placeholder="ONI RIDER"
                  />
                  {errors.cpmNickname ? (
                    <p id={`${uid}-nick-e`} className="mt-2 text-xs text-crimson">
                      {errors.cpmNickname}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor={`${uid}-id`} className="hud-label mb-2 block text-foreground/70">
                    CPM ID *
                  </label>
                  <input
                    id={`${uid}-id`}
                    className={fieldClass}
                    value={values.cpmId}
                    maxLength={CPM_ID_MAX}
                    inputMode="text"
                    autoCapitalize="characters"
                    aria-invalid={!!errors.cpmId}
                    aria-describedby={errors.cpmId ? `${uid}-id-e` : undefined}
                    onChange={(event) => set("cpmId", event.target.value)}
                    placeholder="ONI0001"
                  />
                  {errors.cpmId ? (
                    <p id={`${uid}-id-e`} className="mt-2 text-xs text-crimson">
                      {errors.cpmId}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={`${uid}-direction`}
                    className="hud-label mb-2 block text-foreground/70"
                  >
                    ЧИГЛЭЛ *
                  </label>
                  <select
                    id={`${uid}-direction`}
                    className={fieldClass}
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
                </div>

                <div>
                  <label
                    htmlFor={`${uid}-contact-type`}
                    className="hud-label mb-2 block text-foreground/70"
                  >
                    ХОЛБООНЫ СУВАГ *
                  </label>
                  <select
                    id={`${uid}-contact-type`}
                    className={fieldClass}
                    value={values.contactType}
                    onChange={(event) =>
                      set("contactType", event.target.value as JoinApplication["contactType"])
                    }
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="Discord">Discord</option>
                    <option value="Phone">Утас</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor={`${uid}-contact`}
                  className="hud-label mb-2 block text-foreground/70"
                >
                  ХОЛБОО БАРИХ ХАЯГ / ДУГААР *
                </label>
                <input
                  id={`${uid}-contact`}
                  className={fieldClass}
                  value={values.contact}
                  maxLength={120}
                  aria-invalid={!!errors.contact}
                  aria-describedby={errors.contact ? `${uid}-contact-e` : undefined}
                  onChange={(event) => set("contact", event.target.value)}
                  placeholder="Instagram / Discord / утас"
                />
                {errors.contact ? (
                  <p id={`${uid}-contact-e`} className="mt-2 text-xs text-crimson">
                    {errors.contact}
                  </p>
                ) : null}
              </div>

              <fieldset>
                <legend className="hud-label mb-2 text-foreground/70">ТУРШЛАГА</legend>
                <div className="flex flex-wrap gap-2">
                  {EXPERIENCE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={values.experience === option.id}
                      onClick={() => set("experience", option.id as ExperienceLevel)}
                      className={`min-h-[44px] border px-4 text-[0.65rem] tracking-[0.22em] transition-colors clip-notch ${
                        values.experience === option.id
                          ? "border-crimson/70 bg-crimson/15 text-foreground"
                          : "border-border text-muted-foreground hover:border-crimson/40"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="hud-label mb-2 text-foreground/70">СОНИРХОЛ (сонголттой)</legend>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={values.interests.includes(option.id)}
                      onClick={() => toggleInterest(option.id)}
                      className={`min-h-[44px] border px-4 text-[0.65rem] tracking-[0.22em] transition-colors clip-notch ${
                        values.interests.includes(option.id)
                          ? "border-crimson/70 bg-crimson/15 text-foreground"
                          : "border-border text-muted-foreground hover:border-crimson/40"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor={`${uid}-msg`} className="hud-label mb-2 block text-foreground/70">
                  НЭМЭЛТ МЭДЭЭЛЭЛ
                </label>
                <textarea
                  id={`${uid}-msg`}
                  className={`${fieldClass} min-h-[112px] resize-y`}
                  value={values.message}
                  maxLength={MESSAGE_MAX}
                  onChange={(event) => set("message", event.target.value)}
                  placeholder="Өөрийгөө товч танилцуулна уу."
                />
                <div className="mt-1 flex items-center justify-between gap-3">
                  {errors.message ? (
                    <p className="text-xs text-crimson">{errors.message}</p>
                  ) : (
                    <span />
                  )}
                  <p className="text-[0.65rem] text-muted-foreground/70">
                    {values.message.length}/{MESSAGE_MAX}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden border border-white/10 bg-black/25 p-4 clip-notch">
                <div className="flex items-center justify-between gap-4">
                  <span className="hud-label text-crimson/80">LIVE PREVIEW</span>
                  <span className="text-[0.58rem] tracking-[0.16em] text-muted-foreground">
                    APPLICANT CARD
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-5">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold tracking-wide text-foreground">
                      {values.cpmNickname.trim() || "ONI RIDER"}
                    </p>
                    <p className="mt-1 truncate text-xs tracking-[0.16em] text-muted-foreground">
                      {values.cpmId.trim() || "CPM ID"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[0.68rem] text-foreground/80">{values.direction}</p>
                    <p className="mt-1 text-[0.58rem] tracking-[0.15em] text-crimson/80">
                      {experienceLabel}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={status === "loading" || status === "sent"}
                className={`relative inline-flex min-h-[52px] w-full items-center justify-center gap-3 overflow-hidden border px-6 text-[0.7rem] tracking-[0.28em] text-foreground transition-all clip-notch disabled:cursor-not-allowed disabled:opacity-70 ${
                  status === "sent"
                    ? "border-emerald-400/45 bg-emerald-400/10"
                    : "border-crimson/60 bg-crimson/15 hover:bg-crimson/25"
                }`}
              >
                {status === "sent" ? (
                  <span className="absolute inset-0 animate-pulse bg-emerald-400/5" />
                ) : null}
                <span className="relative inline-flex items-center gap-3">
                  {status === "loading" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ИЛГЭЭЖ БАЙНА
                    </>
                  ) : status === "sent" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      ХҮЛЭЭН АВСАН
                    </>
                  ) : (
                    <>
                      ХҮСЭЛТ ИЛГЭЭХ
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </span>
              </button>

              <p aria-live="polite" className="min-h-[1.25rem]">
                {notice ? (
                  <span
                    className={`flex items-start gap-2 text-xs leading-relaxed ${
                      status === "sent" ? "text-emerald-200" : "text-crimson"
                    }`}
                  >
                    {status === "sent" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    {notice}
                  </span>
                ) : null}
              </p>
            </form>
          </section>
        </div>
      </main>

      <OniFooter />
    </div>
  );
}
