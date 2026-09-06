import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, LockKeyhole, LogOut, UserPlus } from "lucide-react";

import {
  fetchMemberAccount,
  registerMemberAccount,
  requestMemberAccount,
  signInMember,
  signOutMember,
  watchMemberAuth,
  type MemberAccount,
} from "@/data/member-auth";
import { firebaseAuth } from "@/integrations/firebase/client";

const fieldClass =
  "w-full min-h-[44px] border border-border bg-ink/70 px-4 py-3 text-base text-foreground outline-none focus:border-crimson/70 sm:text-sm";

type Props = {
  onAccount: (account: MemberAccount | null) => void;
};

function authMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (/crew_not_found/i.test(text)) return "CPM нэр эсвэл CPM ID Crew жагсаалттай таарсангүй.";
  if (/email-already-in-use/i.test(text)) return "Энэ и-мэйлээр аккаунт бүртгэгдсэн байна.";
  if (/weak-password/i.test(text)) return "Нууц үг хамгийн багадаа 6 тэмдэгт байна.";
  if (/invalid-credential|wrong-password|user-not-found/i.test(text))
    return "И-мэйл эсвэл нууц үг буруу байна.";
  return "Үйлдэл амжилтгүй боллоо. Мэдээллээ шалгаад дахин оролдоно уу.";
}

export function OniMemberGate({ onAccount }: Props) {
  const [phase, setPhase] = useState<"loading" | "signed_out" | "signed_in">("loading");
  const [account, setAccount] = useState<MemberAccount | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [cpmId, setCpmId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(
    () =>
      watchMemberAuth(
        ({ user, account: next }) => {
          setAccount(next);
          onAccount(next);
          setPhase(user ? "signed_in" : "signed_out");
        },
        () => {
          setNotice("Нэвтрэлтийн төлөвийг шалгаж чадсангүй.");
          setPhase("signed_out");
        },
      ),
    [onAccount],
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      if (mode === "register") {
        const next = await registerMemberAccount(email, password, nickname, cpmId);
        setAccount(next);
        onAccount(next);
      } else {
        await signInMember(email, password);
      }
    } catch (error) {
      setNotice(authMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    const user = firebaseAuth.currentUser;
    if (!user) return;
    setBusy(true);
    try {
      const next = await fetchMemberAccount(user.uid);
      setAccount(next);
      onAccount(next);
    } finally {
      setBusy(false);
    }
  };

  if (phase === "loading") {
    return <p className="mt-4 text-sm text-muted-foreground">Нэвтрэлтийг шалгаж байна…</p>;
  }

  if (phase === "signed_in" && account) {
    return (
      <section className="mt-6 border border-border bg-midnight/55 p-4" aria-label="Crew аккаунт">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="hud-label text-crimson/85">CREW ACCOUNT</span>
            <p className="mt-2 text-sm text-foreground">{account.nickname}</p>
            <p className="mt-1 text-xs text-muted-foreground">CPM ID: {account.cpmId}</p>
          </div>
          <button
            type="button"
            aria-label="Гарах"
            onClick={() => void signOutMember()}
            className="grid h-11 w-11 place-items-center border border-border text-muted-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        {account.status === "approved" ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> ADMIN БАТАЛГААЖУУЛСАН
          </p>
        ) : (
          <div className="mt-3">
            <p className="text-xs text-amber-300">
              {account.status === "rejected"
                ? "Хүсэлтийг Admin татгалзсан байна."
                : "Admin баталгаажуулахыг хүлээж байна."}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void refresh()}
              className="mt-3 min-h-11 border border-border px-4 text-xs text-muted-foreground disabled:opacity-50"
            >
              ТӨЛӨВ ШАЛГАХ
            </button>
          </div>
        )}
      </section>
    );
  }

  if (phase === "signed_in") {
    const linkCrew = async (event: React.FormEvent) => {
      event.preventDefault();
      const user = firebaseAuth.currentUser;
      if (!user) return;
      setBusy(true);
      setNotice("");
      try {
        const next = await requestMemberAccount(user, nickname, cpmId);
        setAccount(next);
        onAccount(next);
      } catch (error) {
        setNotice(authMessage(error));
      } finally {
        setBusy(false);
      }
    };
    return (
      <section className="mt-6 border border-border bg-midnight/55 p-4">
        <p className="text-xs text-amber-300">
          Аккаунт үүссэн. Одоо Crew мэдээллээ зөв оруулж холбоно уу.
        </p>
        <form className="mt-4 grid gap-3" onSubmit={(event) => void linkCrew(event)}>
          <input
            required
            aria-label="CPM nickname"
            placeholder="CPM NICKNAME"
            className={fieldClass}
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
          />
          <input
            required
            aria-label="CPM ID"
            placeholder="CPM ID"
            className={fieldClass}
            value={cpmId}
            onChange={(event) => setCpmId(event.target.value)}
          />
          {notice ? <p className="text-xs text-crimson">{notice}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="min-h-12 border border-crimson/60 bg-crimson/15 text-xs disabled:opacity-50"
          >
            CREW-ТЭЙ ХОЛБОХ
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="mt-6 border border-border bg-midnight/55 p-4" aria-label="Crew нэвтрэлт">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`min-h-11 flex-1 border px-3 text-xs ${mode === "login" ? "border-crimson/60 text-foreground" : "border-border text-muted-foreground"}`}
        >
          НЭВТРЭХ
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`min-h-11 flex-1 border px-3 text-xs ${mode === "register" ? "border-crimson/60 text-foreground" : "border-border text-muted-foreground"}`}
        >
          БҮРТГҮҮЛЭХ
        </button>
      </div>
      <form className="mt-4 grid gap-3" onSubmit={(event) => void submit(event)}>
        <label className="text-xs text-muted-foreground">
          И-МЭЙЛ
          <input
            required
            type="email"
            autoComplete="email"
            className={`${fieldClass} mt-1`}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          ONI HUB НУУЦ ҮГ
          <input
            required
            minLength={6}
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className={`${fieldClass} mt-1`}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {mode === "register" ? (
          <>
            <label className="text-xs text-muted-foreground">
              CPM NICKNAME
              <input
                required
                className={`${fieldClass} mt-1`}
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              CPM ID
              <input
                required
                className={`${fieldClass} mt-1`}
                value={cpmId}
                onChange={(event) => setCpmId(event.target.value)}
              />
            </label>
          </>
        ) : null}
        {notice ? <p className="text-xs text-crimson">{notice}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-12 items-center justify-center gap-2 border border-crimson/60 bg-crimson/15 px-4 text-xs disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : mode === "register" ? (
            <UserPlus className="h-4 w-4" />
          ) : (
            <LockKeyhole className="h-4 w-4" />
          )}
          {mode === "register" ? "CREW ACCOUNT ҮҮСГЭХ" : "НЭВТРЭХ"}
        </button>
      </form>
    </section>
  );
}
