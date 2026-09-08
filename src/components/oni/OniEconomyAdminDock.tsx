import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Coins, Loader2, Settings2, ShieldCheck, X } from "lucide-react";
import { listMemberAccounts, type MemberAccount } from "@/data/member-auth";
import {
  adjustMemberCoin,
  configureEconomyWeek,
  confirmCurrentMeetAttendance,
  getEconomySeasonConfig,
  getEconomyWeekConfig,
  listCurrentMeetAttendanceCandidates,
  revokeCurrentMeetAttendance,
  startNewEconomySeason,
  type AttendanceCandidate,
} from "@/data/economy-admin";

const localInput = (value?: string | null) => value ? new Date(value).toISOString().slice(0, 16) : "";

export function OniEconomyAdminDock() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [attendance, setAttendance] = useState<AttendanceCandidate[]>([]);
  const [members, setMembers] = useState<MemberAccount[]>([]);
  const [weekId, setWeekId] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [weekEnabled, setWeekEnabled] = useState(true);
  const [seasonId, setSeasonId] = useState("");
  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");
  const [adjustUid, setAdjustUid] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const load = async () => {
    const [attendanceRows, accounts, week, season] = await Promise.all([
      listCurrentMeetAttendanceCandidates().catch(() => []),
      listMemberAccounts().catch(() => []),
      getEconomyWeekConfig().catch(() => null),
      getEconomySeasonConfig().catch(() => null),
    ]);
    setAttendance(attendanceRows);
    const approved = accounts.filter((row) => row.status === "approved");
    setMembers(approved);
    setAdjustUid((current) => current || approved[0]?.uid || "");
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

  useEffect(() => { if (open) void load(); }, [open]);
  const selected = useMemo(() => members.find((row) => row.uid === adjustUid) ?? null, [members, adjustUid]);

  const attendanceAction = async (uid: string, confirmed: boolean) => {
    setBusy(`attendance:${uid}`); setNotice("");
    try {
      if (confirmed) await revokeCurrentMeetAttendance(uid);
      else await confirmCurrentMeetAttendance(uid);
      await load();
      setNotice(confirmed ? "Attendance revoke хийлээ." : "Attendance баталгаажлаа. Reward bridge одоо тухайн rider-ийн Meet reward-ийг олгож чадна.");
    } catch { setNotice("Attendance өөрчилж чадсангүй."); }
    finally { setBusy(""); }
  };

  const saveWeek = async () => {
    if (!weekId || !weekStart || !weekEnd) return setNotice("Week ID, эхлэх/дуусах цаг шаардлагатай.");
    setBusy("week"); setNotice("");
    try {
      await configureEconomyWeek({ weekId, startsAt: new Date(weekStart), endsAt: new Date(weekEnd), enabled: weekEnabled });
      setNotice("Secure weekly claim window хадгалагдлаа.");
      await load();
    } catch { setNotice("Weekly window хадгалж чадсангүй."); }
    finally { setBusy(""); }
  };

  const startSeason = async () => {
    if (!seasonId || !seasonStart || !seasonEnd) return setNotice("Season ID, эхлэх/дуусах цаг шаардлагатай.");
    setBusy("season"); setNotice("");
    try {
      await startNewEconomySeason({ seasonId, startsAt: new Date(seasonStart), endsAt: new Date(seasonEnd) });
      setNotice("Шинэ season эхэллээ. Өмнөх season snapshot archive-д хадгалагдаж, season XP reset хийгдлээ.");
      await load();
    } catch { setNotice("Season start хийж чадсангүй."); }
    finally { setBusy(""); }
  };

  const adjust = async () => {
    const amount = Number(adjustAmount);
    if (!selected || !Number.isInteger(amount) || !amount || !adjustReason.trim()) return setNotice("Member, бүхэл Coin amount, reason шаардлагатай.");
    setBusy("adjust"); setNotice("");
    try {
      const result = await adjustMemberCoin({ uid: selected.uid, amount, reason: adjustReason });
      setNotice(`${selected.nickname} · шинэ balance ${result.balanceAfter.toLocaleString()} ONI. Ledger-д audit reason хадгалагдлаа.`);
      setAdjustAmount(""); setAdjustReason("");
    } catch { setNotice("Coin adjustment хийж чадсангүй."); }
    finally { setBusy(""); }
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 left-5 z-[80] inline-flex min-h-11 items-center gap-2 border border-emerald-400/35 bg-ink/95 px-4 text-xs font-semibold tracking-[0.14em] text-white shadow-2xl"><Coins className="h-4 w-4 text-emerald-300"/>ECONOMY</button>
    {open ? <div className="fixed inset-0 z-[96] overflow-y-auto bg-black/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
      <section className="mx-auto my-4 w-full max-w-3xl border border-white/10 bg-ink p-5 shadow-2xl">
        <div className="flex items-center justify-between"><div><p className="text-[0.62rem] tracking-[0.22em] text-emerald-300">ONI CONTROL CENTER</p><h2 className="mt-1 text-xl font-semibold">ECONOMY / ATTENDANCE / SEASON</h2></div><button type="button" onClick={() => setOpen(false)} className="p-2 text-white/60"><X className="h-5 w-5"/></button></div>
        {notice ? <p className="mt-4 border border-white/10 bg-white/[0.03] p-3 text-xs text-white/75">{notice}</p> : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="border border-white/10 p-4"><div className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-emerald-300"/><h3 className="font-semibold">MEET ATTENDANCE</h3></div><p className="mt-2 text-xs leading-5 text-white/45">Registration өөрөө reward өгөхгүй. Admin энд attendance баталсны дараа л Meet XP/Coin claim нээгдэнэ.</p><div className="mt-4 max-h-64 divide-y divide-white/10 overflow-auto">{attendance.length ? attendance.map((row) => <div key={row.uid} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><strong className="block truncate text-sm">{row.nickname}</strong><span className={`text-[0.62rem] ${row.confirmed ? "text-emerald-300" : "text-white/35"}`}>{row.confirmed ? "ATTENDED" : "REGISTERED ONLY"}</span></div><button type="button" disabled={busy === `attendance:${row.uid}`} onClick={() => void attendanceAction(row.uid, row.confirmed)} className="min-h-9 border border-white/10 px-3 text-[0.62rem] disabled:opacity-40">{row.confirmed ? "REVOKE" : "CONFIRM"}</button></div>) : <p className="py-4 text-xs text-white/35">Current Meet participant алга.</p>}</div></section>

          <section className="border border-white/10 p-4"><div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-crimson"/><h3 className="font-semibold">SECURE WEEK</h3></div><div className="mt-4 space-y-3"><input value={weekId} onChange={(e) => setWeekId(e.target.value)} placeholder="2026-W37" className="min-h-10 w-full border border-white/10 bg-black/25 px-3 text-base sm:text-sm"/><input type="datetime-local" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="min-h-10 w-full border border-white/10 bg-black/25 px-3 text-base sm:text-sm"/><input type="datetime-local" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} className="min-h-10 w-full border border-white/10 bg-black/25 px-3 text-base sm:text-sm"/><label className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" checked={weekEnabled} onChange={(e) => setWeekEnabled(e.target.checked)}/>Weekly claims enabled</label><button type="button" disabled={busy === "week"} onClick={() => void saveWeek()} className="min-h-10 w-full border border-crimson/35 bg-crimson/10 text-xs font-semibold">{busy === "week" ? <Loader2 className="mx-auto h-4 w-4 animate-spin"/> : "SAVE WEEK"}</button></div></section>

          <section className="border border-white/10 p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-crimson"/><h3 className="font-semibold">SEASON CONTROL</h3></div><p className="mt-2 text-xs leading-5 text-white/45">Start хийхэд өмнөх season leaderboard snapshot archive-д хадгалагдаж, бүх profile-ийн seasonXp 0 болно. Lifetime XP устахгүй.</p><div className="mt-4 space-y-3"><input value={seasonId} onChange={(e) => setSeasonId(e.target.value)} placeholder="S01-2026" className="min-h-10 w-full border border-white/10 bg-black/25 px-3 text-base sm:text-sm"/><input type="datetime-local" value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} className="min-h-10 w-full border border-white/10 bg-black/25 px-3 text-base sm:text-sm"/><input type="datetime-local" value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} className="min-h-10 w-full border border-white/10 bg-black/25 px-3 text-base sm:text-sm"/><button type="button" disabled={busy === "season"} onClick={() => void startSeason()} className="min-h-10 w-full border border-crimson/45 bg-crimson/10 text-xs font-semibold">START / ROTATE SEASON</button></div></section>

          <section className="border border-white/10 p-4"><div className="flex items-center gap-2"><Coins className="h-4 w-4 text-amber-300"/><h3 className="font-semibold">COIN CORRECTION</h3></div><p className="mt-2 text-xs leading-5 text-white/45">Manual adjustment бүр reason + admin UID + balanceAfter-тай Wallet Ledger-д үлдэнэ.</p><div className="mt-4 space-y-3"><select value={adjustUid} onChange={(e) => setAdjustUid(e.target.value)} className="min-h-10 w-full border border-white/10 bg-black/25 px-3 text-base sm:text-sm">{members.map((member) => <option key={member.uid} value={member.uid}>{member.nickname} · {member.cpmId}</option>)}</select><input inputMode="numeric" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder="+500 эсвэл -300" className="min-h-10 w-full border border-white/10 bg-black/25 px-3 text-base sm:text-sm"/><input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Correction reason" className="min-h-10 w-full border border-white/10 bg-black/25 px-3 text-base sm:text-sm"/><button type="button" disabled={busy === "adjust"} onClick={() => void adjust()} className="min-h-10 w-full border border-amber-300/30 bg-amber-300/[0.06] text-xs font-semibold">APPLY LEDGERED ADJUSTMENT</button></div></section>
        </div>
      </section>
    </div> : null}
  </>;
}
