import { useEffect, useState } from "react";
import { KeyRound, Loader2, ShieldAlert, ShieldPlus } from "lucide-react";

import { OniAuthProvider, useOniAuth } from "@/hooks/useOniAuth";
import { claimFirstOwner, ownerExists, signUpFirstOwner } from "@/services/bootstrap";
import { OniControlCenter } from "./OniControlCenter";
import { OniHudNav } from "./OniHudNav";

const fieldClass =
  "w-full min-h-[44px] border border-border bg-ink/70 px-3 py-2.5 text-sm tracking-wide text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-crimson/70 focus:outline-none";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100svh] bg-ink text-foreground">
      <OniHudNav />
      <main className="mx-auto flex min-h-[100svh] max-w-[38rem] flex-col justify-center px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-24 sm:px-7">
        {children}
      </main>
    </div>
  );
}

/** true only while the backend confirms zero owner roles exist. */
function useOwnerMissing(): boolean | null {
  const [missing, setMissing] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void ownerExists().then((exists) => alive && setMissing(!exists));
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
    const res = await signUpFirstOwner(email, password);
    if (!res.ok) {
      setBusy(false);
      setNotice(res.message);
      return;
    }
    if (!res.hasSession) {
      setBusy(false);
      setNotice(
        "Бүртгэл үүслээ. И-мэйл дэх баталгаажуулах холбоосыг дарж, дараа нь энд нэвтэрвэл OWNER эрх автоматаар олгогдоно.",
      );
      return;
    }
    const claim = await claimFirstOwner();
    setBusy(false);
    if (claim === "granted") {
      setNotice("OWNER эрх олгогдлоо. Самбар руу шилжиж байна…");
      return;
    }
    if (claim === "already_bootstrapped") {
      setNotice("OWNER аль хэдийн үүссэн байна. Энгийн нэвтрэлтээр орно уу.");
      return;
    }
    setNotice("Эрх олгож чадсангүй. Нэвтэрсний дараа дахин оролдоно уу.");
  };

  return (
    <section className="mt-5 border border-crimson/35 bg-crimson/8 p-5 sm:p-6">
      <span className="hud-label inline-flex items-center gap-2 text-crimson/85">
        <ShieldPlus className="h-4 w-4" /> FIRST OWNER BOOTSTRAP
      </span>
      <h2 className="mt-3 text-lg font-semibold tracking-[0.12em]">АНХНЫ OWNER ҮҮСГЭХ</h2>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Системд OWNER эрх хараахан алга. Энэ нэг удаагийн бүртгэл зөвхөн одоо ажиллана — анхны OWNER
        үүссэний дараа энэ хэсэг бүрмөсөн хаагдана.
      </p>

      <label className="mt-4 block text-[0.65rem] tracking-[0.2em] text-muted-foreground">
        И-МЭЙЛ
        <input
          type="email"
          autoComplete="email"
          className={`${fieldClass} mt-1.5`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="mt-3 block text-[0.65rem] tracking-[0.2em] text-muted-foreground">
        НУУЦ ҮГ
        <input
          type="password"
          autoComplete="new-password"
          className={`${fieldClass} mt-1.5`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {notice ? (
        <p role="status" className="mt-4 text-xs leading-relaxed text-muted-foreground">
          {notice}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy || !email || !password}
        onClick={() => void run()}
        className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 border border-crimson/60 bg-crimson/15 px-4 text-[0.7rem] font-semibold tracking-[0.2em] text-foreground transition-colors clip-notch hover:bg-crimson/25 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} АНХНЫ OWNER ҮҮСГЭХ
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
        className="border border-border bg-midnight/40 p-5 sm:p-7"
        onSubmit={(e) => {
          e.preventDefault();
          void signIn(email, password);
        }}
      >
        <span className="hud-label inline-flex items-center gap-2 text-crimson/85">
          <KeyRound className="h-4 w-4" /> ADMIN AUTHENTICATION
        </span>
        <h1 className="mt-3 text-xl font-semibold tracking-[0.12em]">УДИРДЛАГЫН НЭВТРЭЛТ</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Зөвхөн зөвшөөрөгдсөн админ профайлтай хэрэглэгч самбарт нэвтэрнэ.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">
          Зөвхөн OWNER/ADMIN/MODERATOR эрхтэй бүртгэл нэвтэрнэ.
        </p>

        <label className="mt-5 block text-[0.65rem] tracking-[0.2em] text-muted-foreground">
          И-МЭЙЛ
          <input
            type="email"
            required
            autoComplete="email"
            className={`${fieldClass} mt-1.5`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="mt-4 block text-[0.65rem] tracking-[0.2em] text-muted-foreground">
          НУУЦ ҮГ
          <input
            type="password"
            required
            autoComplete="current-password"
            className={`${fieldClass} mt-1.5`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error ? (
          <p role="alert" className="mt-4 text-sm text-crimson">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center gap-2 border border-crimson/60 bg-crimson/15 px-4 text-[0.7rem] font-semibold tracking-[0.2em] text-foreground transition-colors clip-notch hover:bg-crimson/25 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} НЭВТРЭХ
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
    const res = await claimFirstOwner();
    setBusy(false);
    if (res === "granted") {
      window.location.reload();
      return;
    }
    setNotice(
      res === "already_bootstrapped" ? "OWNER аль хэдийн үүссэн байна." : "Эрх олгож чадсангүй.",
    );
  };

  return (
    <Shell>
      <section className="border border-crimson/40 bg-crimson/8 p-5 sm:p-7">
        <span className="hud-label inline-flex items-center gap-2 text-crimson/85">
          <ShieldAlert className="h-4 w-4" /> ACCESS DENIED
        </span>
        <h1 className="mt-3 text-xl font-semibold tracking-[0.12em]">ХАНДАХ ЭРХГҮЙ</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {email ? <span className="font-mono">{email}</span> : "Энэ хэрэглэгч"} — админ эрх
          олгогдоогүй байна. Удирдлагын өгөгдөл, үйлдэл харагдахгүй.
        </p>
        {ownerMissing ? (
          <>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground/80">
              Системд OWNER хараахан алга. Энэ бүртгэлээр анхны OWNER эрхийг нэг удаа авах
              боломжтой.
            </p>
            {notice ? (
              <p role="status" className="mt-3 text-xs text-muted-foreground">
                {notice}
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void claim()}
              className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 border border-crimson/60 bg-crimson/15 px-4 text-[0.7rem] font-semibold tracking-[0.2em] text-foreground clip-notch hover:bg-crimson/25 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} OWNER ЭРХ АВАХ
            </button>
          </>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground/80">
            Эрх олгох хүсэлтээ OWNER-т хандаж шийдвэрлүүлнэ үү.
          </p>
        )}

        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 border border-border bg-ink/60 px-4 text-[0.7rem] font-semibold tracking-[0.2em] text-muted-foreground clip-notch hover:text-foreground"
        >
          ГАРАХ
        </button>
      </section>
    </Shell>
  );
}

function Loading() {
  return (
    <Shell>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-crimson" /> Нэвтрэлтийн төлөв шалгаж байна…
      </div>
    </Shell>
  );
}

function BackendUnavailable() {
  return (
    <Shell>
      <section className="border border-crimson/40 bg-crimson/8 p-5 sm:p-7">
        <span className="hud-label inline-flex items-center gap-2 text-crimson/85">
          <ShieldAlert className="h-4 w-4" /> BACKEND CONFIGURATION
        </span>
        <h1 className="mt-3 text-xl font-semibold tracking-[0.12em]">ХОЛБОЛТ ТОХИРУУЛАГДААГҮЙ</h1>
        <p role="alert" className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Энэ deployment-д backend холболтын тохиргоо ирээгүй байна. Админ нэвтрэлт болон
          хамгаалагдсан өгөгдөл аюулгүйгээр хаалттай хэвээр байна.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground/80">
          Lovable Cloud холболтыг сэргээсний дараа төслийг дахин publish хийнэ үү.
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
  return <OniControlCenter />;
}

export function OniAdminGate() {
  return (
    <OniAuthProvider>
      <GateBody />
    </OniAuthProvider>
  );
}
