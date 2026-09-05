import { useId, useState } from "react";
import { Loader2, ShieldAlert, ArrowRight } from "lucide-react";

import cityBg from "@/assets/oni-city-bg.jpg";
import character from "@/assets/oni-character.webp";
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
import { OniFooter } from "./OniFooter";
import { OniHudNav } from "./OniHudNav";

const EMPTY: JoinApplication = {
  cpmNickname: "",
  cpmId: "",
  contact: "",
  experience: "regular",
  interests: [],
  message: "",
};

const fieldClass =
  "w-full min-h-[44px] border border-border bg-ink/70 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-crimson/70 focus:outline-none";

export function OniJoinProtocol() {
  const uid = useId();
  const [values, setValues] = useState<JoinApplication>(EMPTY);
  const [errors, setErrors] = useState<JoinFieldErrors>({});
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "failed">("idle");
  const [notice, setNotice] = useState("");

  const set = <K extends keyof JoinApplication>(key: K, v: JoinApplication[K]) => {
    setValues((p) => ({ ...p, [key]: v }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const toggleInterest = (id: JoinInterest) =>
    setValues((p) => ({
      ...p,
      interests: p.interests.includes(id)
        ? p.interests.filter((i) => i !== id)
        : [...p.interests, id],
    }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Guard against double submits (double tap, Enter + click, resend).
    if (status === "loading" || status === "sent") return;
    const next = validateApplication(values);
    setErrors(next);
    if (Object.keys(next).length) {
      setStatus("idle");
      setNotice("");
      return;
    }
    setStatus("loading");
    const res = await submitApplication(values);
    if (res.ok) {
      setStatus("sent");
      setNotice(`Анкет хүлээн авлаа. Дугаар: ${res.reference}`);
    } else {
      setStatus("failed");
      setNotice(res.error);
    }
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

        <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-28 sm:px-8 lg:grid-cols-[0.85fr_1fr] lg:gap-14 lg:pt-36">
          {/* Protocol brief */}
          <section className="relative" aria-labelledby="join-title">
            <span className="hud-label hud-rule block pl-11 text-crimson/85">
              SECTOR 04 / JOIN PROTOCOL
            </span>
            <h1 id="join-title" className="mt-5 text-cinema text-5xl text-foreground sm:text-6xl">
              НЭГДЭХ
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              Oni And Kishin кланд элсэх хүсэлт. Мэдээллээ үнэн зөв бөглөнө үү — бүрэлдэхүүний баг
              таны анкетыг шалгана.
            </p>

            <ol className="mt-8 space-y-3">
              {[
                ["01", "АНКЕТ", "CPM мэдээлэл ба холбоо барих суваг."],
                ["02", "ШАЛГАЛТ", "Бүрэлдэхүүний баг анкетыг хянана."],
                ["03", "ХАРИУ", "Холбоо барих сувгаар хариу очно."],
              ].map(([i, t, d]) => (
                <li key={i} className="glass-panel flex gap-4 px-4 py-3 clip-notch">
                  <span className="hud-label text-crimson">{i}</span>
                  <span>
                    <span className="block text-xs tracking-[0.24em] text-foreground">{t}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{d}</span>
                  </span>
                </li>
              ))}
            </ol>

            <img
              src={character}
              alt=""
              aria-hidden="true"
              className="pointer-events-none mt-8 hidden h-72 w-auto animate-breathe object-contain opacity-70 lg:block"
              decoding="async"
            />
          </section>

          {/* Application */}
          <section
            className="glass-panel relative p-5 clip-notch sm:p-7"
            aria-labelledby="join-form-title"
          >
            <h2 id="join-form-title" className="hud-label text-foreground/80">
              APPLICATION / ЭЛСЭЛТИЙН АНКЕТ
            </h2>

            <form className="mt-6 space-y-5" onSubmit={onSubmit} noValidate>
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
                    onChange={(e) => set("cpmNickname", e.target.value)}
                    placeholder="ONI RIDER"
                  />
                  {errors.cpmNickname && (
                    <p id={`${uid}-nick-e`} className="mt-2 text-xs text-crimson">
                      {errors.cpmNickname}
                    </p>
                  )}
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
                    onChange={(e) => set("cpmId", e.target.value)}
                    placeholder="ONI0001"
                  />
                  {errors.cpmId && (
                    <p id={`${uid}-id-e`} className="mt-2 text-xs text-crimson">
                      {errors.cpmId}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor={`${uid}-contact`}
                  className="hud-label mb-2 block text-foreground/70"
                >
                  ХОЛБОО БАРИХ (Discord / утас / имэйл) *
                </label>
                <input
                  id={`${uid}-contact`}
                  className={fieldClass}
                  value={values.contact}
                  maxLength={120}
                  aria-invalid={!!errors.contact}
                  aria-describedby={errors.contact ? `${uid}-contact-e` : undefined}
                  onChange={(e) => set("contact", e.target.value)}
                  placeholder="discord: oni#0001"
                />
                {errors.contact && (
                  <p id={`${uid}-contact-e`} className="mt-2 text-xs text-crimson">
                    {errors.contact}
                  </p>
                )}
              </div>

              <fieldset>
                <legend className="hud-label mb-2 text-foreground/70">ТУРШЛАГА</legend>
                <div className="flex flex-wrap gap-2">
                  {EXPERIENCE_OPTIONS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={values.experience === o.id}
                      onClick={() => set("experience", o.id as ExperienceLevel)}
                      className={`min-h-[44px] border px-4 text-[0.65rem] tracking-[0.22em] transition-colors clip-notch ${
                        values.experience === o.id
                          ? "border-crimson/70 bg-crimson/15 text-foreground"
                          : "border-border text-muted-foreground hover:border-crimson/40"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="hud-label mb-2 text-foreground/70">СОНИРХОЛ (сонголттой)</legend>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={values.interests.includes(o.id)}
                      onClick={() => toggleInterest(o.id)}
                      className={`min-h-[44px] border px-4 text-[0.65rem] tracking-[0.22em] transition-colors clip-notch ${
                        values.interests.includes(o.id)
                          ? "border-crimson/70 bg-crimson/15 text-foreground"
                          : "border-border text-muted-foreground hover:border-crimson/40"
                      }`}
                    >
                      {o.label}
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
                  className={`${fieldClass} min-h-[104px] resize-y`}
                  value={values.message}
                  maxLength={MESSAGE_MAX}
                  onChange={(e) => set("message", e.target.value)}
                  placeholder="Өөрийгөө товч танилцуулна уу."
                />
                <p className="mt-1 text-right text-[0.65rem] text-muted-foreground/70">
                  {values.message.length}/{MESSAGE_MAX}
                </p>
              </div>

              <button
                type="submit"
                disabled={status === "loading" || status === "sent"}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-3 border border-crimson/60 bg-crimson/15 px-6 text-[0.7rem] tracking-[0.28em] text-foreground transition-colors clip-notch hover:bg-crimson/25 disabled:opacity-60"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ИЛГЭЭЖ БАЙНА
                  </>
                ) : status === "sent" ? (
                  <>ХҮЛЭЭН АВСАН</>
                ) : (
                  <>
                    ХҮСЭЛТ ИЛГЭЭХ
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>

              <p aria-live="polite" className="min-h-[1.25rem]">
                {notice && (
                  <span
                    className={`flex items-start gap-2 text-xs leading-relaxed ${
                      status === "sent" ? "text-foreground" : "text-crimson"
                    }`}
                  >
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    {notice}
                  </span>
                )}
              </p>
            </form>
          </section>
        </div>
      </main>

      <OniFooter />
    </div>
  );
}
