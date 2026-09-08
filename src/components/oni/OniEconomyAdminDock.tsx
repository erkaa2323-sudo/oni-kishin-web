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

const localInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

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

  useEffect(() => {
    if (open) void load();
  }, [open]);

  const selected = useMemo(
    () => members.find((row) => row.uid === adjustUid) ?? null,
    [members, adjustUid],
  );

  const attendanceAction = async (uid: string, confirmed: boolean) => {
    setBusy(`attendance:${uid}`);
    setNotice("");
    try {
      if (confirmed) await revokeCurrentMeetAttendance(uid);
      else await confirmCurrentMeetAttendance(uid);
      await load();
      setNotice(
        confirmed
          ? "Уулзалтад оролцсон баталгааг цуцаллаа."
          : "Оролцоог баталгаажууллаа. Тухайн гишүүн уулзалтын XP болон ONI шагналаа авах эрхтэй боллоо.",
      );
    } catch {
      setNotice("Уулзалтын оролцооны төлөвийг өөрчилж чадсангүй.");
    } finally {
      setBusy("");
    }
  };

  const saveWeek = async () => {
    if (!weekId || !weekStart || !weekEnd)
      return setNotice("Долоо хоногийн дугаар, эхлэх болон дуусах цаг шаардлагатай.");
    setBusy("week");
    setNotice("");
    try {
      await configureEconomyWeek({
        weekId,
        startsAt: new Date(weekStart),
        endsAt: new Date(weekEnd),
        enabled: weekEnabled,
      });
      setNotice("Долоо хоногийн шагнал авах хугацааг хадгаллаа.");
      await load();
    } catch {
      setNotice("Долоо хоногийн хугацааг хадгалж чадсангүй.");
    } finally {
      setBusy("");
    }
  };

  const startSeason = async () => {
    if (!seasonId || !seasonStart || !seasonEnd)
      return setNotice("Улирлын дугаар, эхлэх болон дуусах цаг шаардлагатай.");
    setBusy("season");
    setNotice("");
    try {
      await startNewEconomySeason({
        seasonId,
        startsAt: new Date(seasonStart),
        endsAt: new Date(seasonEnd),
      });
      setNotice(
        "Шинэ улирал эхэллээ. Өмнөх улирлын чансаа архивлагдаж, улирлын XP 0-ээс эхэлнэ. Нийт хуримтлуулсан XP устахгүй.",
      );
      await load();
    } catch {
      setNotice("Шинэ улирал эхлүүлж чадсангүй.");
    } finally {
      setBusy("");
    }
  };

  const adjust = async () => {
    const amount = Number(adjustAmount);
    if (!selected || !Number.isInteger(amount) || !amount || !adjustReason.trim())
      return setNotice("Гишүүн, бүхэл тоон ONI хэмжээ, засварын шалтгаан шаардлагатай.");
    setBusy("adjust");
    setNotice("");
    try {
      const result = await adjustMemberCoin({ uid: selected.uid, amount, reason: adjustReason });
      setNotice(
        `${selected.nickname} · шинэ үлдэгдэл ${result.balanceAfter.toLocaleString()} ONI. Засварын шалтгаан үйлдлийн бүртгэлд хадгалагдлаа.`,
      );
      setAdjustAmount("");
      setAdjustReason("");
    } catch {
      setNotice("ONI үлдэгдлийг засварлаж чадсангүй.");
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-[65] inline-flex min-h-11 items-center gap-2 border border-emerald-400/35 bg-ink/95 px-3 text-[.62rem] font-semibold tracking-[0.1em] text-white shadow-2xl"
      >
        <Coins className="h-4 w-4 text-emerald-300" />
        ONI ЭДИЙН ЗАСАГ
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[96] overflow-y-auto bg-black/80 p-3 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="ONI эдийн засгийн удирдлага"
        >
          <section className="mx-auto my-4 w-full max-w-3xl border border-white/10 bg-ink p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.62rem] tracking-[0.18em] text-emerald-300">
                  ONI УДИРДЛАГЫН ТӨВ
                </p>
                <h2 className="mt-1 text-xl font-semibold">ЭДИЙН ЗАСАГ БА ШАГНАЛ</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 text-white/60"
                aria-label="Хаах"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-white/45">
              Уулзалтын оролцоо, долоо хоногийн шагнал, улирал болон гишүүний ONI үлдэгдлийг энд
              удирдана.
            </p>
            {notice ? (
              <p className="mt-4 border border-white/10 bg-white/[0.03] p-3 text-xs text-white/75">
                {notice}
              </p>
            ) : null}

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="border border-white/10 p-4">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-emerald-300" />
                  <h3 className="font-semibold">УУЛЗАЛТЫН ОРОЛЦОО</h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-white/45">
                  Зөвхөн бүртгүүлсэн байх нь шагнал өгөхгүй. Админ оролцоог баталгаажуулсны дараа
                  тухайн гишүүн уулзалтын XP болон ONI шагналаа авна.
                </p>
                <div className="mt-4 max-h-64 divide-y divide-white/10 overflow-auto">
                  {attendance.length ? (
                    attendance.map((row) => (
                      <div key={row.uid} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <strong className="block truncate text-sm">{row.nickname}</strong>
                          <span
                            className={`text-[0.62rem] ${row.confirmed ? "text-emerald-300" : "text-white/35"}`}
                          >
                            {row.confirmed ? "ОРОЛЦСОН НЬ БАТАЛГААЖСАН" : "ЗӨВХӨН БҮРТГҮҮЛСЭН"}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={busy === `attendance:${row.uid}`}
                          onClick={() => void attendanceAction(row.uid, row.confirmed)}
                          className="min-h-9 border border-white/10 px-3 text-[0.62rem] disabled:opacity-40"
                        >
                          {row.confirmed ? "ЦУЦЛАХ" : "БАТЛАХ"}
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="py-4 text-xs text-white/35">
                      Одоогийн уулзалтад бүртгүүлсэн гишүүн алга.
                    </p>
                  )}
                </div>
              </section>

              <section className="border border-white/10 p-4">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-crimson" />
                  <h3 className="font-semibold">ДОЛОО ХОНОГИЙН ШАГНАЛ</h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-white/45">
                  Тухайн долоо хоногт шагнал авах боломжтой хугацааг тохируулна.
                </p>
                <div className="mt-4 space-y-3">
                  <input
                    value={weekId}
                    onChange={(e) => setWeekId(e.target.value)}
                    placeholder="Ж: 2026-W37"
                    className="min-h-10 w-full border border-white/10 bg-black/25 px-3 text-base sm:text-sm"
                  />
                  <input
                    type="datetime-local"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                    className="min-h-10 w-full border border-white/10 bg-black/25 px-3 text-base sm:text-sm"
                  />
                  <input
                    type="datetime-local"
                    value={weekEnd}
                    onChange={(e) => setWeekEnd(e.target.value)}
                    className="min-h-10 w-full border border-white/10 bg-black/25 px-3 text-base sm:text-sm"
                  />
                  <label className="flex items-center gap-2 text-xs text-white/60">
                    <input
                      type="checkbox"
                      checked={weekEnabled}
                      onChange={(e) => setWeekEnabled(e.target.checked)}
                    />
                    Долоо хоногийн шагнал авах эрхийг нээх
                  </label>
                  <button
                    type="button"
                    disabled={busy === "week"}
                    onClick={() => void saveWeek()}
                    className="min-h-10 w-full border border-crimson/35 bg-crimson/10 text-xs font-semibold"
                  >
                    {busy === "week" ? (
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    ) : (
                      "ДОЛОО ХОНОГИЙН ТОХИРГООГ ХАДГАЛАХ"
                    )}
                  </button>
                </div>
              </section>

              <section className="border border-white/10 p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-crimson" />
                  <h3 className="font-semibold">УЛИРЛЫН УДИРДЛАГА</h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-white/45">
                  Шинэ улирал эхлүүлэхэд өмнөх улирлын чансаа архивлагдаж, улирлын XP 0 болно. Нийт
                  хуримтлуулсан XP хэвээр үлдэнэ.
                </p>
                <div className="mt-4 space-y-3">
                  <input
                    value={seasonId}
                    onChange={(e) => setSeasonId(e.target.value)}
                    placeholder="Ж: S01-2026"
                    className="min-h-10 w-full border border-white/10 bg-black/25 px-3 text-base sm:text-sm"
                  />
                  <input
                    type="datetime-local"
                    value={seasonStart}
                    onChange={(e) => setSeasonStart(e.target.value)}
                    className="min-h-10 w-full border border-white/10 bg-black/25 px-3 text-base sm:text-sm"
                  />
                  <input
                    type="datetime-local"
                    value={seasonEnd}
                    onChange={(e) => setSeasonEnd(e.target.value)}
                    className="min-h-10 w-full border border-white/10 bg-black/25 px-3 text-base sm:text-sm"
                  />
                  <button
                    type="button"
                    disabled={busy === "season"}
                    onClick={() => void startSeason()}
                    className="min-h-10 w-full border border-crimson/45 bg-crimson/10 text-xs font-semibold"
                  >
                    ШИНЭ УЛИРАЛ ЭХЛҮҮЛЭХ
                  </button>
                </div>
              </section>

              <section className="border border-white/10 p-4">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-amber-300" />
                  <h3 className="font-semibold">ONI ҮЛДЭГДЭЛ ЗАСВАРЛАХ</h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-white/45">
                  Гараар хийсэн өөрчлөлт бүр шалтгаан, админы ID болон өөрчлөлтийн дараах
                  үлдэгдэлтэйгээ үйлдлийн бүртгэлд хадгалагдана.
                </p>
                <div className="mt-4 space-y-3">
                  <select
                    value={adjustUid}
                    onChange={(e) => setAdjustUid(e.target.value)}
                    className="min-h-10 w-full border border-white/10 bg-black/25 px-3 text-base sm:text-sm"
                  >
                    {members.map((member) => (
                      <option key={member.uid} value={member.uid}>
                        {member.nickname} · {member.cpmId}
                      </option>
                    ))}
                  </select>
                  <input
                    inputMode="numeric"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="Ж: +500 эсвэл -300"
                    className="min-h-10 w-full border border-white/10 bg-black/25 px-3 text-base sm:text-sm"
                  />
                  <input
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Засвар хийж буй шалтгаан"
                    className="min-h-10 w-full border border-white/10 bg-black/25 px-3 text-base sm:text-sm"
                  />
                  <button
                    type="button"
                    disabled={busy === "adjust"}
                    onClick={() => void adjust()}
                    className="min-h-10 w-full border border-amber-300/30 bg-amber-300/[0.06] text-xs font-semibold"
                  >
                    ҮЛДЭГДЛИЙГ ЗАСВАРЛАЖ БҮРТГЭХ
                  </button>
                </div>
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
