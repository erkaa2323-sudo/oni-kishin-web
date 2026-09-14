import { useEffect, useState, type ReactNode } from "react";
import { KeyRound, Loader2, ShieldAlert, ShieldPlus } from "lucide-react";

import { OniAuthProvider, useOniAuth } from "@/hooks/useOniAuth";
import { claimFirstOwner, ownerExists, signUpFirstOwner } from "@/services/bootstrap";
import { OniAdminV3 } from "./OniAdminV3";
import { OniHudNav } from "./OniHudNav";

const fieldClass =
  "w-full min-h-[44px] rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-base text-white placeholder:text-white/25 outline-none transition focus:border-white/25 sm:text-sm";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100svh] bg-[#09090d] text-white">
      <OniHudNav />
      <main className="mx-auto flex min-h-[100svh] max-w-[38rem] flex-col justify-center px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-24 sm:px-7">
        {children}
      </main>
    </div>
  );
}

function useOwnerMissing(): boolean | null {
  const [missing, setMissing] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void ownerExists()
      .then((exists) => {
        if (alive) setMissing(!exists);
      })
      .catch(() => {
        if (alive) setMissing(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  return missing;
}

function BootstrapPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setNotice(null);
    const response = await signUpFirstOwner(email, password);
    if (!response.ok) {
      setBusy(false);
      setNotice(response.message);
      return;
    }
    if (!response.hasSession) {
      setBusy(false);
      setNotice(
        "Бүртгэл үүслээ. И-мэйл дэх баталгаажуулах холбоосыг дарж, дараа нь энд нэвтэрнэ үү.",
      );
      return;
    }
    const claim = await claimFirstOwner();
    setBusy(false);
    if (claim === "granted") {
      setNotice("Эзэмшигчийн эрх олгогдлоо. Самбар руу шилжиж байна…");
      window.setTimeout(() => window.location.reload(), 350);
      return;
    }
    setNotice(
      claim === "already_bootstrapped"
        ? "Эзэмшигчийн эрхтэй админ аль хэдийн үүссэн байна."
        : "Эрх олгож чадсангүй.",
    );
  };

  return (
    <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <div className="flex items-center gap-2 text-crimson/80">
        <ShieldPlus className="h-4 w-4" />
        <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em]">
          Анхны эзэмшигчийн тохиргоо
        </span>
      </div>
      <h2 className="mt-3 text-xl font-semibold">Анхны админ үүсгэх</h2>
      <p className="mt-2 text-xs leading-5 text-white/40">
        Системд owner эрхтэй админ байхгүй үед энэ нэг удаагийн тохиргоо нээгдэнэ.
      </p>
      <div className="mt-4 space-y-3">
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="И-мэйл"
          className={fieldClass}
        />
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Нууц үг"
          className={fieldClass}
        />
      </div>
      {notice ? <p className="mt-3 text-xs leading-5 text-white/55">{notice}</p> : null}
      <button
        type="button"
        disabled={busy || !email || !password}
        onClick={() => void run()}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-crimson/45 bg-crimson/15 px-4 text-xs font-semibold text-white disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Анхны админ үүсгэх
      </button>
    </section>
  );
}

function SignIn() {
  const { signIn, error, phase } = useOniAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const ownerMissing = useOwnerMissing();
  const busy = phase === "loading";

  return (
    <Shell>
      <form
        className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 shadow-2xl sm:p-7"
        onSubmit={(event) => {
          event.preventDefault();
          void signIn(email, password);
        }}
      >
        <div className="flex items-center gap-2 text-crimson/80">
          <KeyRound className="h-4 w-4" />
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em]">Admin V3</span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold">Удирдлагын нэвтрэлт</h1>
        <p className="mt-2 text-sm leading-6 text-white/40">
          Firebase нэвтрэлт болон админы role хоёул баталгаажсаны дараа Control Center нээгдэнэ.
        </p>
        <div className="mt-5 space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="И-мэйл"
            className={fieldClass}
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Нууц үг"
            className={fieldClass}
          />
        </div>
        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3 text-xs text-red-200"
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-crimson/45 bg-crimson/15 px-4 text-xs font-semibold text-white disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Нэвтрэх
        </button>
      </form>
      {ownerMissing ? <BootstrapPanel /> : null}
    </Shell>
  );
}

function AccessDenied() {
  const { email, signOut } = useOniAuth();
  const ownerMissing = useOwnerMissing();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const claim = async () => {
    setBusy(true);
    const result = await claimFirstOwner();
    setBusy(false);
    if (result === "granted") {
      window.location.reload();
      return;
    }
    setNotice(
      result === "already_bootstrapped" ? "Owner аль хэдийн үүссэн байна." : "Эрх олгож чадсангүй.",
    );
  };

  return (
    <Shell>
      <section className="rounded-3xl border border-red-500/20 bg-red-500/[0.04] p-5 sm:p-7">
        <div className="flex items-center gap-2 text-red-200">
          <ShieldAlert className="h-4 w-4" />
          <span className="text-xs font-semibold">Хандах эрх хүрэлцэхгүй</span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold">Админ эрхгүй</h1>
        <p className="mt-3 text-sm leading-6 text-white/45">
          {email || "Энэ хэрэглэгч"} — зөвшөөрөгдсөн admin profile байхгүй тул хамгаалагдсан өгөгдөл
          нээгдэхгүй.
        </p>
        {ownerMissing ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void claim()}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-crimson/45 bg-crimson/15 px-4 text-xs font-semibold disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Owner эрх авах
          </button>
        ) : null}
        {notice ? <p className="mt-3 text-xs text-white/50">{notice}</p> : null}
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-4 min-h-11 rounded-xl border border-white/10 px-4 text-xs text-white/55"
        >
          Гарах
        </button>
      </section>
    </Shell>
  );
}

function Loading() {
  return (
    <Shell>
      <div className="flex items-center justify-center gap-3 text-sm text-white/45">
        <Loader2 className="h-4 w-4 animate-spin" /> Нэвтрэлтийн төлөв шалгаж байна…
      </div>
    </Shell>
  );
}

function BackendUnavailable() {
  return (
    <Shell>
      <section className="rounded-3xl border border-red-500/20 bg-red-500/[0.04] p-5 sm:p-7">
        <div className="flex items-center gap-2 text-red-200">
          <ShieldAlert className="h-4 w-4" />
          <span className="text-xs font-semibold">Серверийн холболт</span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold">Холболт тохируулагдаагүй</h1>
        <p role="alert" className="mt-3 text-sm leading-6 text-white/45">
          Firebase тохиргоо ирээгүй тул админ нэвтрэлт болон хамгаалагдсан өгөгдөл хаалттай хэвээр
          байна.
        </p>
      </section>
    </Shell>
  );
}

function GateBody() {
  const { phase } = useOniAuth();
  if (phase === "loading") return <Loading />;
  if (phase === "backend_unavailable") return <BackendUnavailable />;
  if (phase === "signed_out") return <SignIn />;
  if (phase === "unauthorized") return <AccessDenied />;
  return <OniAdminV3 />;
}

export function OniAdminGate() {
  return (
    <OniAuthProvider>
      <GateBody />
    </OniAuthProvider>
  );
}
