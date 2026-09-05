import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  ShieldAlert,
  Timer,
  UserCheck,
} from "lucide-react";

import garageBay from "@/assets/garage/garage-bay.jpg";
import {
  CPM_ID_MAX,
  CPM_LAUNCH_FALLBACK_LABEL,
  cpmLaunchUrl,
  CPM_NICKNAME_MAX,
  CREDENTIAL_GATE_NOTICE,
  LIFECYCLE_LABEL,
  REGISTRATION_MESSAGE,
  canRegister,
  deriveLifecycle,
  fetchActiveMeet,
  fetchParticipants,
  registerForMeet,
  validateVerification,
  type MeetFieldErrors,
  type MeetParticipant,
  type MeetSession,
  type VerificationInput,
} from "@/data/meet";
import { OniFooter } from "./OniFooter";
import { OniHudNav } from "./OniHudNav";

const fieldClass =
  "w-full min-h-[44px] border border-border bg-ink/70 px-4 py-3 text-sm tracking-wide text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-crimson/70 focus:outline-none";

function useTick(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function countdownText(iso: string | null, now: number): string {
  if (!iso) return "—";
  const diff = Math.max(0, new Date(iso).getTime() - now);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function OniMeetAccess() {
  const uid = useId();
  const [session, setSession] = useState<MeetSession | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [participants, setParticipants] = useState<MeetParticipant[]>([]);
  const [values, setValues] = useState<VerificationInput>({ cpmNickname: "", cpmId: "" });
  const [errors, setErrors] = useState<MeetFieldErrors>({});
  const [state, setState] = useState<"idle" | "sending" | "denied" | "registered">("idle");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const res = await fetchActiveMeet();
    if (res.status === "error") {
      setLoadState("error");
      setLoadError(res.reason);
      return;
    }
    setLoadState("ok");
    setSession(res.session);
    setParticipants(res.session ? await fetchParticipants(res.session.id) : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const now = useTick(!!session);
  const life = useMemo(() => deriveLifecycle(session, now), [session, now]);
  const open = canRegister(life) && state !== "registered";

  const set = <K extends keyof VerificationInput>(k: K, v: string) => {
    setValues((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || state === "sending" || state === "registered") return;
    const next = validateVerification(values);
    setErrors(next);
    if (Object.keys(next).length) return;
    setState("sending");
    setNotice("");
    const outcome = await registerForMeet(session.id, values);
    setNotice(REGISTRATION_MESSAGE[outcome]);
    if (outcome === "registered") {
      setState("registered");
      await load();
    } else {
      setState("denied");
      if (outcome === "meet_full" || outcome === "registration_closed") await load();
    }
  };

  return (
    <div className="relative min-h-screen bg-ink">
      <OniHudNav />

      <main className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img
            src={garageBay}
            alt=""
            aria-hidden="true"
            className="h-full w-full scale-105 object-cover opacity-30"
            decoding="async"
          />
          <div className="absolute inset-0" style={{ background: "var(--gradient-vignette)" }} />
          <div className="absolute inset-0 scanline-veil opacity-30" />
        </div>

        <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-28 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:gap-14 lg:pt-36">
          <section aria-labelledby="meet-title">
            <span className="hud-label hud-rule block pl-11 text-crimson/85">
              SECTOR 05 / SECURE MEET ACCESS
            </span>
            <h1 id="meet-title" className="mt-5 text-cinema text-5xl text-foreground sm:text-6xl">
              УУЛЗАЛТ
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              ONI MEET — кланы хаалттай уулзалт. Бүртгэл нээлттэй үед CPM нэр болон CPM ID-гаараа
              бүртгүүлнэ. Өрөөний мэдээлэл хамгаалагдсан хэвээр байна.
            </p>

            <div className="glass-panel mt-8 p-5 clip-notch">
              <div className="flex items-center justify-between gap-3">
                <span className="hud-label text-foreground/70">MEET STATUS</span>
                <span
                  className={`text-[0.65rem] tracking-[0.24em] ${
                    life === "open" || life === "active" ? "text-crimson" : "text-muted-foreground"
                  }`}
                >
                  {loadState === "loading"
                    ? "ШАЛГАЖ БАЙНА…"
                    : loadState === "error"
                      ? "МЭДЭЭЛЭЛ АВАХ БОЛОМЖГҮЙ"
                      : LIFECYCLE_LABEL[life]}
                </span>
              </div>

              {loadState === "error" && (
                <p className="mt-4 text-xs leading-relaxed text-crimson">{loadError}</p>
              )}

              {loadState === "ok" && !session && (
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  Одоогоор идэвхтэй уулзалт зарлагдаагүй байна. Уулзалт зарлагдмагц цаг, багтаамж,
                  бүртгэлийн хугацаа энд гарна.
                </p>
              )}

              {session && (
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="hud-label">НЭР</dt>
                    <dd className="mt-1 text-sm text-foreground">{session.title}</dd>
                  </div>
                  <div>
                    <dt className="hud-label">ЦАГ</dt>
                    <dd className="mt-1 text-sm text-foreground">
                      {session.scheduledAt
                        ? new Date(session.scheduledAt).toLocaleString("mn-MN")
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="hud-label">ҮЛДСЭН ХУГАЦАА</dt>
                    <dd className="mt-1 flex items-center gap-2 font-mono text-sm text-crimson">
                      <Timer className="h-4 w-4" aria-hidden="true" />
                      {countdownText(session.scheduledAt, now)}
                    </dd>
                  </div>
                  <div>
                    <dt className="hud-label">БҮРТГЭЛ ХААХ</dt>
                    <dd className="mt-1 text-sm text-foreground">
                      {session.registrationClosesAt
                        ? new Date(session.registrationClosesAt).toLocaleString("mn-MN")
                        : "Эхлэх цаг хүртэл"}
                    </dd>
                  </div>
                  <div>
                    <dt className="hud-label">ОРОЛЦОГЧ</dt>
                    <dd className="mt-1 text-sm text-foreground">
                      {session.registered}
                      {session.capacity !== null ? `/${session.capacity}` : ""}
                    </dd>
                  </div>
                </dl>
              )}
            </div>

            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-crimson" aria-hidden="true" />
              {CREDENTIAL_GATE_NOTICE}
            </p>
          </section>

          <section
            className="glass-panel relative p-5 clip-notch sm:p-7"
            aria-labelledby="meet-form-title"
          >
            <h2 id="meet-form-title" className="hud-label text-foreground/80">
              MEET REGISTRATION / БҮРТГЭЛ
            </h2>

            <form className="mt-6 space-y-5" onSubmit={onSubmit} noValidate>
              <div>
                <label htmlFor={`${uid}-nick`} className="hud-label mb-2 block text-foreground/70">
                  CPM NICKNAME *
                </label>
                <input
                  id={`${uid}-nick`}
                  className={fieldClass}
                  value={values.cpmNickname}
                  maxLength={CPM_NICKNAME_MAX}
                  autoComplete="nickname"
                  disabled={!open}
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
                  autoCapitalize="characters"
                  disabled={!open}
                  aria-invalid={!!errors.cpmId}
                  aria-describedby={errors.cpmId ? `${uid}-id-e` : undefined}
                  onChange={(e) => set("cpmId", e.target.value)}
                  placeholder="ONI0001 / ABC123"
                />
                <p className="mt-1 text-[0.65rem] text-muted-foreground/70">
                  Жишээ: ONI0001, ABC123 · дээд тал нь {CPM_ID_MAX} тэмдэгт
                </p>
                {errors.cpmId && (
                  <p id={`${uid}-id-e`} className="mt-2 text-xs text-crimson">
                    {errors.cpmId}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!open || state === "sending"}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-3 border border-crimson/60 bg-crimson/15 px-6 text-[0.7rem] tracking-[0.28em] text-foreground transition-colors clip-notch hover:bg-crimson/25 disabled:opacity-50"
              >
                {state === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    БҮРТГЭЖ БАЙНА
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4" aria-hidden="true" />
                    VERIFY &amp; JOIN
                  </>
                )}
              </button>

              {!open && state !== "registered" && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {session
                    ? LIFECYCLE_LABEL[life]
                    : "Идэвхтэй уулзалт байхгүй тул бүртгэл хаалттай."}
                </p>
              )}

              <div aria-live="polite">
                {notice && (
                  <p
                    className={`flex items-start gap-2 text-xs leading-relaxed ${
                      state === "registered" ? "text-foreground" : "text-crimson"
                    }`}
                  >
                    {state === "registered" ? (
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-crimson"
                        aria-hidden="true"
                      />
                    ) : (
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    {notice}
                  </p>
                )}
              </div>
            </form>

            {state === "registered" && (
              <a
                href={cpmLaunchUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-3 border border-border bg-ink/60 px-5 text-[0.68rem] tracking-[0.24em] text-foreground transition-colors clip-notch hover:border-crimson/60"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {CPM_LAUNCH_FALLBACK_LABEL}
              </a>
            )}

            {/* Participants — safe public nicknames only */}
            <div className="mt-6 border-t border-border pt-5">
              <div className="flex items-center justify-between gap-3">
                <span className="hud-label text-foreground/70">БҮРТГҮҮЛСЭН ОРОЛЦОГЧИД</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {participants.length}
                </span>
              </div>
              {participants.length === 0 ? (
                <p className="mt-3 border border-dashed border-border px-4 py-5 text-xs text-muted-foreground">
                  Одоогоор бүртгүүлсэн оролцогч алга.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {participants.map((p, i) => (
                    <li
                      key={`${p.cpmNickname}-${i}`}
                      className="flex min-h-[44px] items-center gap-2 border border-border bg-ink/50 px-3 py-2 text-xs text-foreground"
                    >
                      <span className="font-mono text-[0.6rem] text-crimson">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="truncate">{p.cpmNickname}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </main>

      <OniFooter />
    </div>
  );
}
