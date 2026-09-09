import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Award, Coins, Loader2, X } from "lucide-react";
import { listMemberAccounts, type MemberAccount } from "@/data/member-auth";
import {
  grantEventReward,
  grantManualReward,
  type EventRewardPlacement,
} from "@/data/progression-admin";

type RewardMode = "manual" | "event";

export function OniEventRewardDock() {
  const [open, setOpen] = useState(false);
  const [navMount, setNavMount] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<RewardMode>("manual");
  const [members, setMembers] = useState<MemberAccount[]>([]);
  const [uid, setUid] = useState("");
  const [eventId, setEventId] = useState("");
  const [placement, setPlacement] = useState<EventRewardPlacement>("participation");
  const [xp, setXp] = useState("0");
  const [coin, setCoin] = useState("0");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const navList = document.querySelector<HTMLElement>(
      'nav[aria-label="Удирдлагын хэсгүүд"] ul',
    );
    if (!navList) return;

    const mount = document.createElement("li");
    mount.className = "shrink-0 lg:bg-ink";
    mount.dataset["oniRewardNav"] = "true";

    const accountButton = Array.from(navList.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("CREW ACCOUNT"),
    );
    const accountItem = accountButton?.closest("li");
    if (accountItem?.parentElement === navList) {
      navList.insertBefore(mount, accountItem.nextSibling);
    } else {
      navList.appendChild(mount);
    }

    setNavMount(mount);
    return () => {
      setNavMount(null);
      mount.remove();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    void listMemberAccounts()
      .then((rows) => {
        const approved = rows.filter((x) => x.status === "approved");
        setMembers(approved);
        setUid((current) => current || approved[0]?.uid || "");
      })
      .catch(() => setNotice("Зөвшөөрөгдсөн гишүүний бүртгэлүүдийг ачаалж чадсангүй."));
  }, [open]);

  const selected = useMemo(() => members.find((x) => x.uid === uid) ?? null, [members, uid]);
  const manualXp = Math.max(0, Math.floor(Number(xp) || 0));
  const manualCoin = Math.max(0, Math.floor(Number(coin) || 0));

  const submitEvent = async () => {
    if (!selected || !eventId.trim()) {
      setNotice("Эвентийн дугаар болон гишүүнээ сонгоно уу.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const reward = await grantEventReward({
        uid: selected.uid,
        nickname: selected.nickname,
        eventId,
        placement,
      });
      setNotice(`${selected.nickname} · +${reward.xp} XP · +${reward.coin} ONI`);
      setEventId("");
    } catch (error) {
      const code = error instanceof Error ? error.message : "failed";
      setNotice(
        code === "already_rewarded"
          ? "Энэ эвент дээр тухайн гишүүн шагналаа аль хэдийн авсан байна."
          : "Эвентийн шагнал олгох үед алдаа гарлаа.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submitManual = async () => {
    if (!selected || (manualXp === 0 && manualCoin === 0)) {
      setNotice("Гишүүнээ сонгоод XP эсвэл ONI coin-оос дор хаяж нэгийг оруулна уу.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const reward = await grantManualReward({
        uid: selected.uid,
        nickname: selected.nickname,
        xp: manualXp,
        coin: manualCoin,
        reason,
      });
      setNotice(
        `${selected.nickname} · +${reward.xp} XP · +${reward.coin} ONI · шинэ үлдэгдэл ${reward.balanceAfter} ONI`,
      );
      setXp("0");
      setCoin("0");
      setReason("");
    } catch (error) {
      const code = error instanceof Error ? error.message : "failed";
      setNotice(
        code === "reward_too_large"
          ? "Нэг удаагийн олголт 1,000,000 XP / ONI-оос их байж болохгүй."
          : code === "invalid_reward"
            ? "XP эсвэл ONI coin-оос дор хаяж нэгийг 1-ээс их утгаар оруулна уу."
            : "XP / ONI coin олгох үед алдаа гарлаа.",
      );
    } finally {
      setBusy(false);
    }
  };

  const navButton = navMount
    ? createPortal(
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className={`flex min-h-[44px] w-full items-center gap-3 border px-3.5 text-left transition-colors clip-notch lg:border-0 lg:py-3 ${
            open
              ? "border-crimson/60 bg-crimson/15 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground lg:hover:bg-midnight/60"
          }`}
        >
          <Coins className="h-4 w-4 shrink-0 text-crimson/80" />
          <span className="whitespace-nowrap text-[0.7rem] font-medium tracking-[0.18em]">
            XP / COIN
          </span>
        </button>,
        navMount,
      )
    : null;

  const modal = open
    ? createPortal(
        <div
          className="fixed inset-0 z-[140] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="XP болон ONI coin удирдах"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Хаах"
            onClick={() => setOpen(false)}
          />
          <section className="relative max-h-[88svh] w-full max-w-lg overflow-y-auto border border-white/10 bg-ink p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[0.62rem] tracking-[0.18em] text-crimson">ONI АХИЦ БА ШАГНАЛ</p>
                <h2 className="mt-1 text-xl font-semibold">XP / ONI COIN</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-11 w-11 shrink-0 touch-manipulation place-items-center text-white/60"
                aria-label="Хаах"
              >
                <X className="pointer-events-none h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 border border-white/10 bg-black/20 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("manual");
                  setNotice("");
                }}
                className={`min-h-10 px-3 text-[0.62rem] font-semibold tracking-[0.12em] ${
                  mode === "manual" ? "bg-crimson/15 text-white" : "text-white/45"
                }`}
              >
                ГАР ОЛГОЛТ
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("event");
                  setNotice("");
                }}
                className={`min-h-10 px-3 text-[0.62rem] font-semibold tracking-[0.12em] ${
                  mode === "event" ? "bg-crimson/15 text-white" : "text-white/45"
                }`}
              >
                ЭВЕНТ
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs text-white/45">ГИШҮҮН</span>
                <select
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  className="mt-2 min-h-11 w-full border border-white/10 bg-black/30 px-3 text-base sm:text-sm"
                >
                  {members.map((m) => (
                    <option key={m.uid} value={m.uid}>
                      {m.nickname} · {m.cpmId}
                    </option>
                  ))}
                </select>
              </label>

              {mode === "manual" ? (
                <>
                  <p className="text-xs leading-5 text-white/45">
                    Сонгосон member-д хүссэн хэмжээгээр XP болон ONI coin нэмнэ. Олголт бүр ledger-д
                    админ үйлдэл гэж бүртгэгдэнэ.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs text-white/45">XP НЭМЭХ</span>
                      <input
                        type="number"
                        min="0"
                        max="1000000"
                        step="1"
                        inputMode="numeric"
                        value={xp}
                        onChange={(e) => setXp(e.target.value)}
                        className="mt-2 min-h-11 w-full border border-white/10 bg-black/30 px-3 text-base sm:text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-white/45">ONI COIN НЭМЭХ</span>
                      <input
                        type="number"
                        min="0"
                        max="1000000"
                        step="1"
                        inputMode="numeric"
                        value={coin}
                        onChange={(e) => setCoin(e.target.value)}
                        className="mt-2 min-h-11 w-full border border-white/10 bg-black/30 px-3 text-base sm:text-sm"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs text-white/45">ТАЙЛБАР · ЗААВАЛ БИШ</span>
                    <input
                      value={reason}
                      maxLength={180}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Ж: Meet bonus / admin correction"
                      className="mt-2 min-h-11 w-full border border-white/10 bg-black/30 px-3 text-base sm:text-sm"
                    />
                  </label>
                </>
              ) : (
                <>
                  <p className="text-xs leading-5 text-white/45">
                    Эвентэд оролцсон гишүүний байр, оролцоонд тохирсон XP болон ONI coin-ыг нэг удаа
                    олгоно.
                  </p>
                  <label className="block">
                    <span className="text-xs text-white/45">ЭВЕНТИЙН ДУГААР</span>
                    <input
                      value={eventId}
                      onChange={(e) => setEventId(e.target.value)}
                      placeholder="Ж: mongol-63-2026-09"
                      className="mt-2 min-h-11 w-full border border-white/10 bg-black/30 px-3 text-base sm:text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-white/45">ҮР ДҮН</span>
                    <select
                      value={placement}
                      onChange={(e) => setPlacement(e.target.value as EventRewardPlacement)}
                      className="mt-2 min-h-11 w-full border border-white/10 bg-black/30 px-3 text-base sm:text-sm"
                    >
                      <option value="participation">Оролцсон · +250 XP / +150 ONI</option>
                      <option value="third">3-р байр · +500 XP / +300 ONI</option>
                      <option value="second">2-р байр · +750 XP / +500 ONI</option>
                      <option value="first">1-р байр · +1200 XP / +800 ONI</option>
                    </select>
                  </label>
                </>
              )}

              {notice ? (
                <p className="border border-white/10 bg-white/[0.03] p-3 text-xs text-white/70">
                  {notice}
                </p>
              ) : null}

              <button
                type="button"
                disabled={
                  busy ||
                  !selected ||
                  (mode === "event" ? !eventId.trim() : manualXp === 0 && manualCoin === 0)
                }
                onClick={() => void (mode === "event" ? submitEvent() : submitManual())}
                className="inline-flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 border border-crimson/40 bg-crimson/10 text-xs font-semibold tracking-[0.12em] disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Award className="h-4 w-4" />
                )}
                {mode === "event" ? "ЭВЕНТИЙН ШАГНАЛ ОЛГОХ" : "XP / ONI COIN ОЛГОХ"}
              </button>
            </div>
          </section>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {navButton}
      {modal}
    </>
  );
}
