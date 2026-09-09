import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  Check,
  Coins,
  Crown,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Trophy,
  WalletCards,
  Zap,
} from "lucide-react";
import { OniHudNav } from "./OniHudNav";
import { OniFooter } from "./OniFooter";
import {
  claimAchievement,
  claimPrestige,
  claimWeeklyMission,
  getCurrentSeasonConfig,
  getCurrentWeeklyConfig,
  getMyAchievementClaims,
  getMyProgression,
  getMyProgressionLedger,
  getMyWeeklyClaims,
  getMyWeeklyProgress,
  getProgressionLeaderboard,
} from "@/data/progression";
import {
  levelForXp,
  nextRankForXp,
  rankForXp,
  type OniProgressionProfile,
} from "@/lib/oni-progression";
import {
  ONI_ACHIEVEMENTS,
  WEEKLY_MISSIONS,
  statsFromLedger,
  weeklyMissionProgress,
  weeklyProgressValue,
  type AchievementId,
  type ProgressionLedgerEntry,
  type SeasonConfig,
  type WeeklyConfig,
  type WeeklyProgress,
} from "@/lib/progression-rewards";

const inWindow = (start: string | null | undefined, end: string | null | undefined) => {
  if (!start || !end) return false;
  const now = Date.now();
  return now >= new Date(start).getTime() && now < new Date(end).getTime();
};

const shortDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("mn-MN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "—";

export function OniProgressionStage() {
  const [profile, setProfile] = useState<OniProgressionProfile | null>(null);
  const [leaders, setLeaders] = useState<OniProgressionProfile[]>([]);
  const [ledger, setLedger] = useState<ProgressionLedgerEntry[]>([]);
  const [weekConfig, setWeekConfig] = useState<WeeklyConfig | null>(null);
  const [seasonConfig, setSeasonConfig] = useState<SeasonConfig | null>(null);
  const [weekly, setWeekly] = useState<WeeklyProgress | null>(null);
  const [weeklyClaims, setWeeklyClaims] = useState<Set<string>>(new Set());
  const [achievementClaims, setAchievementClaims] = useState<Set<AchievementId>>(new Set());
  const [state, setState] = useState<"loading" | "ready" | "guest" | "error">("loading");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const [mine, board, history, config, season, weekProgress, badgeClaims] = await Promise.all([
        getMyProgression(),
        getProgressionLeaderboard().catch(() => []),
        getMyProgressionLedger().catch(() => []),
        getCurrentWeeklyConfig().catch(() => null),
        getCurrentSeasonConfig().catch(() => null),
        getMyWeeklyProgress().catch(() => null),
        getMyAchievementClaims().catch(() => new Set<AchievementId>()),
      ]);
      const claims = config?.weekId
        ? await getMyWeeklyClaims(config.weekId).catch(() => new Set<string>())
        : new Set<string>();
      setProfile(mine);
      setLeaders(board);
      setLedger(history.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")));
      setWeekConfig(config);
      setSeasonConfig(season);
      setWeekly(weekProgress);
      setWeeklyClaims(claims);
      setAchievementClaims(badgeClaims);
      setState(mine ? "ready" : "guest");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
    const onReward = () => void load();
    window.addEventListener("oni:progression-reward", onReward);
    return () => window.removeEventListener("oni:progression-reward", onReward);
  }, [load]);

  const rank = profile ? rankForXp(profile.xp) : null;
  const next = profile ? nextRankForXp(profile.xp) : null;
  const stats = useMemo(
    () => (profile ? statsFromLedger(ledger, 0, profile.lifetimeXp) : null),
    [ledger, profile],
  );
  const eligibleAchievements = useMemo(
    () =>
      stats
        ? new Set(
            ONI_ACHIEVEMENTS.filter((achievement) => achievement.test(stats)).map(
              (achievement) => achievement.id,
            ),
          )
        : new Set<AchievementId>(),
    [stats],
  );
  const legacyWeekly = useMemo(() => weeklyMissionProgress(ledger), [ledger]);
  const weekOpen =
    !!weekConfig?.enabled &&
    !!weekConfig.weekId &&
    inWindow(weekConfig.startsAt, weekConfig.endsAt);
  const seasonOpen =
    !!seasonConfig?.enabled &&
    !!seasonConfig.seasonId &&
    inWindow(seasonConfig.startsAt, seasonConfig.endsAt);
  const progress = useMemo(() => {
    if (!profile || !rank || !next) return profile ? 100 : 0;
    return Math.min(
      100,
      Math.max(0, ((profile.xp - rank.minXp) / (next.minXp - rank.minXp)) * 100),
    );
  }, [profile, rank, next]);
  const earnedCoin = useMemo(
    () => ledger.filter((row) => row.coin > 0).reduce((sum, row) => sum + row.coin, 0),
    [ledger],
  );
  const spentCoin = useMemo(
    () => ledger.filter((row) => row.coin < 0).reduce((sum, row) => sum + Math.abs(row.coin), 0),
    [ledger],
  );

  const claimMission = async (missionId: string) => {
    setBusy(`mission:${missionId}`);
    setNotice("");
    try {
      const result = await claimWeeklyMission(missionId);
      if (result === "claimed") {
        setNotice("WEEKLY REWARD CLAIMED ✨ ONI Coin Wallet-д орлоо.");
        window.dispatchEvent(
          new CustomEvent("oni:progression-reward", { detail: { source: "weekly", missionId } }),
        );
        await load();
      } else if (result === "already") {
        setNotice("Энэ weekly mission-ийн reward аль хэдийн авсан байна.");
      } else if (result === "not_ready") {
        setNotice("Mission complete болоогүй эсвэл weekly claim window хаалттай байна.");
      } else {
        setNotice("Weekly reward system Admin-аар идэвхжээгүй байна.");
      }
    } catch {
      setNotice("Weekly reward claim баталгаажуулж чадсангүй.");
    } finally {
      setBusy("");
    }
  };

  const claimBadge = async (achievementId: AchievementId) => {
    setBusy(`badge:${achievementId}`);
    setNotice("");
    try {
      const result = await claimAchievement(achievementId);
      if (result === "claimed" || result === "already") {
        setNotice(
          result === "claimed"
            ? "ACHIEVEMENT PERMANENTLY UNLOCKED ✨"
            : "Энэ badge аль хэдийн таны collection-д байна.",
        );
        await load();
      } else {
        setNotice("Achievement-ийн шаардлага хараахан хангагдаагүй байна.");
      }
    } catch {
      setNotice("Achievement claim баталгаажуулж чадсангүй.");
    } finally {
      setBusy("");
    }
  };

  const prestige = async () => {
    setBusy("prestige");
    setNotice("");
    try {
      const result = await claimPrestige();
      if (result === "claimed") {
        setNotice(
          "PRESTIGE ASCENSION COMPLETE 👹 Current Rank XP reset; Coin, Lifetime/Season XP болон achievements хэвээр үлдлээ.",
        );
        await load();
      } else if (result === "max") {
        setNotice("PRESTIGE III · MAX хүрсэн байна.");
      } else {
        setNotice("Prestige хийхийн тулд current Rank XP 26,000 хүрсэн байх ёстой.");
      }
    } catch {
      setNotice("Prestige transaction баталгаажуулж чадсангүй.");
    } finally {
      setBusy("");
    }
  };

  const missionValue = (kind: "meet" | "creator" | "activity") =>
    weekConfig?.weekId && weekly?.weekId === weekConfig.weekId
      ? weeklyProgressValue(weekly, kind)
      : kind === "meet"
        ? legacyWeekly.meet
        : kind === "creator"
          ? legacyWeekly.creator
          : legacyWeekly.activity;

  return (
    <div className="min-h-screen bg-ink text-white">
      <OniHudNav />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6">
        <header className="border-b border-white/10 pb-7">
          <p className="text-xs tracking-[0.32em] text-crimson">ONI NEXUS // PROGRESSION</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">
            ӨӨРИЙН ДОМОГОО ӨСГӨ.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
            Баталгаажсан Meet attendance, Event, Creator contribution-аас XP / ONI Coin авч Rank,
            Prestige, permanent badges болон Season Reputation-оо өсгөнө. ONI Coin нь бодит мөнгө
            биш.
          </p>
        </header>

        {state === "loading" ? (
          <p className="py-16 text-white/50">NEXUS profile ачаалж байна…</p>
        ) : state !== "ready" || !profile ? (
          <section className="my-8 border border-white/10 bg-white/[0.03] p-6">
            <LockKeyhole className="h-6 w-6 text-crimson" />
            <h2 className="mt-4 text-xl">CREW ACCOUNT ШААРДЛАГАТАЙ</h2>
            <p className="mt-2 text-sm text-white/55">
              Approved Crew account-аар нэвтэрсний дараа progression profile идэвхжинэ.
            </p>
          </section>
        ) : (
          <>
            <section className="my-8 grid gap-3 md:grid-cols-3">
              <div className="border border-crimson/30 bg-crimson/[0.06] p-5 md:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs tracking-[0.25em] text-white/45">{profile.nickname}</p>
                    <h2 className="mt-2 text-3xl font-semibold">
                      P{profile.prestige} · LV.{levelForXp(profile.xp)} · {rank?.name}
                    </h2>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/45">SEASON XP</p>
                    <strong className="text-2xl">{profile.seasonXp.toLocaleString()}</strong>
                  </div>
                </div>
                <div className="mt-6 h-2 overflow-hidden bg-white/10">
                  <div
                    className="h-full bg-crimson transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-white/45">
                  {next
                    ? `${profile.xp.toLocaleString()} / ${next.minXp.toLocaleString()} XP → ${next.name}`
                    : `${profile.xp.toLocaleString()} XP · MAX RANK`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-px bg-white/10">
                <div className="bg-ink p-5">
                  <Coins className="h-5 w-5 text-crimson" />
                  <strong className="mt-3 block text-2xl">{profile.coin.toLocaleString()}</strong>
                  <span className="text-xs text-white/45">ONI COIN</span>
                </div>
                <div className="bg-ink p-5">
                  <Trophy className="h-5 w-5 text-crimson" />
                  <strong className="mt-3 block text-2xl">{achievementClaims.size}</strong>
                  <span className="text-xs text-white/45">BADGES</span>
                </div>
              </div>
            </section>

            {notice ? (
              <p className="mb-6 border border-crimson/25 bg-crimson/[0.06] p-3 text-xs">
                {notice}
              </p>
            ) : null}

            <section className="grid gap-3 md:grid-cols-3">
              {[
                ["MEETS", profile.meetCount],
                ["CREATOR", profile.creatorCount],
                ["EVENTS", profile.eventCount],
              ].map(([label, value]) => (
                <div key={String(label)} className="border border-white/10 bg-white/[0.025] p-4">
                  <span className="text-[0.62rem] tracking-[0.2em] text-white/40">{label}</span>
                  <strong className="mt-2 block text-2xl">{Number(value).toLocaleString()}</strong>
                </div>
              ))}
            </section>

            <section className="mt-10 grid gap-3 md:grid-cols-2">
              <article className="border border-white/10 bg-white/[0.02] p-5">
                <p className="text-xs tracking-[0.24em] text-crimson">CURRENT SEASON</p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <strong className="text-2xl">{seasonConfig?.seasonId || "UNASSIGNED"}</strong>
                    <p className="mt-2 text-xs text-white/40">
                      {seasonOpen
                        ? "SEASON ACTIVE"
                        : seasonConfig?.enabled
                          ? "OUTSIDE ACTIVE WINDOW"
                          : "SEASON NOT ACTIVE"}
                    </p>
                  </div>
                  <span className="text-xs text-white/45">
                    ENDS · {shortDate(seasonConfig?.endsAt)}
                  </span>
                </div>
              </article>
              <article className="border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-300" />
                  <p className="text-xs tracking-[0.24em] text-amber-200">PRESTIGE ASCENSION</p>
                </div>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <div>
                    <strong className="text-2xl">PRESTIGE {profile.prestige} / 3</strong>
                    <p className="mt-2 text-xs leading-5 text-white/40">
                      26,000 current XP дээр ascension хийнэ. Coin, Lifetime XP, Season XP болон
                      achievement claims хадгалагдана.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={profile.prestige >= 3 || profile.xp < 26000 || busy === "prestige"}
                    onClick={() => void prestige()}
                    className="min-h-10 shrink-0 border border-amber-300/30 bg-amber-300/[0.06] px-4 text-[0.65rem] font-semibold disabled:opacity-30"
                  >
                    ASCEND
                  </button>
                </div>
              </article>
            </section>

            <section className="mt-10 border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-2">
                <WalletCards className="h-5 w-5 text-crimson" />
                <div>
                  <p className="text-xs tracking-[0.24em] text-crimson">ONI WALLET</p>
                  <h2 className="mt-1 text-2xl font-semibold">COIN FLOW</h2>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-px bg-white/10 text-center">
                <div className="bg-ink p-4">
                  <span className="text-[0.62rem] text-white/40">BALANCE</span>
                  <strong className="mt-2 block">🪙 {profile.coin.toLocaleString()}</strong>
                </div>
                <div className="bg-ink p-4">
                  <span className="text-[0.62rem] text-white/40">EARNED LOG</span>
                  <strong className="mt-2 block text-emerald-300">
                    +{earnedCoin.toLocaleString()}
                  </strong>
                </div>
                <div className="bg-ink p-4">
                  <span className="text-[0.62rem] text-white/40">SPENT LOG</span>
                  <strong className="mt-2 block text-rose-300">
                    -{spentCoin.toLocaleString()}
                  </strong>
                </div>
              </div>
            </section>

            <section className="mt-10">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs tracking-[0.25em] text-crimson">WEEKLY ORDERS</p>
                  <h2 className="mt-2 text-2xl font-semibold">ЭНЭ 7 ХОНОГИЙН MISSION</h2>
                </div>
                <span className={`text-xs ${weekOpen ? "text-emerald-300" : "text-amber-300"}`}>
                  {weekOpen
                    ? `SECURE WEEK · ${weekConfig?.weekId}`
                    : "CLAIM WINDOW CLOSED / SETUP PENDING"}
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {WEEKLY_MISSIONS.map((mission) => {
                  const value = missionValue(mission.kind);
                  const done = value >= mission.target;
                  const isClaimed = weeklyClaims.has(mission.id);
                  const canClaim = weekOpen && done && !isClaimed;
                  return (
                    <article
                      key={mission.id}
                      className={`border p-4 ${done ? "border-emerald-400/30 bg-emerald-400/[0.05]" : "border-white/10 bg-white/[0.025]"}`}
                    >
                      <div className="flex justify-between gap-3">
                        <strong className="text-sm">{mission.label}</strong>
                        <span className="text-xs text-white/45">
                          {Math.min(value, mission.target)}/{mission.target}
                        </span>
                      </div>
                      <div className="mt-3 h-1.5 bg-white/10">
                        <div
                          className="h-full bg-crimson"
                          style={{ width: `${Math.min(100, (value / mission.target) * 100)}%` }}
                        />
                      </div>
                      <p className="mt-3 text-xs text-white/45">Reward · 🪙 {mission.rewardCoin}</p>
                      <button
                        type="button"
                        disabled={!canClaim || busy === `mission:${mission.id}`}
                        onClick={() => void claimMission(mission.id)}
                        className="mt-4 min-h-10 w-full border border-emerald-400/30 bg-emerald-400/[0.06] text-[0.65rem] font-semibold tracking-[0.14em] disabled:opacity-35"
                      >
                        {isClaimed ? (
                          <span className="inline-flex items-center gap-2">
                            <Check className="h-3.5 w-3.5" />
                            CLAIMED
                          </span>
                        ) : done ? (
                          "CLAIM REWARD"
                        ) : (
                          "IN PROGRESS"
                        )}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="mt-10">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-crimson" />
                <div>
                  <p className="text-xs tracking-[0.25em] text-crimson">ACHIEVEMENTS</p>
                  <h2 className="mt-1 text-2xl font-semibold">PERMANENT ONI BADGES</h2>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ONI_ACHIEVEMENTS.map((achievement) => {
                  const eligible = eligibleAchievements.has(achievement.id);
                  const owned = achievementClaims.has(achievement.id);
                  return (
                    <article
                      key={achievement.id}
                      className={`border p-4 ${owned ? "border-emerald-400/35 bg-emerald-400/[0.05]" : eligible ? "border-crimson/35 bg-crimson/[0.05]" : "border-white/10 bg-white/[0.02] opacity-65"}`}
                    >
                      <div className="flex items-center justify-between">
                        <strong>{achievement.name}</strong>
                        {owned ? (
                          <ShieldCheck className="h-4 w-4 text-emerald-300" />
                        ) : eligible ? (
                          <Sparkles className="h-4 w-4 text-crimson" />
                        ) : (
                          <LockKeyhole className="h-4 w-4 text-white/30" />
                        )}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-white/45">
                        {achievement.description}
                      </p>
                      <button
                        type="button"
                        disabled={!eligible || owned || busy === `badge:${achievement.id}`}
                        onClick={() => void claimBadge(achievement.id)}
                        className="mt-4 min-h-9 w-full border border-white/10 text-[0.62rem] font-semibold tracking-[0.12em] disabled:opacity-35"
                      >
                        {owned ? "PERMANENTLY OWNED" : eligible ? "CLAIM BADGE" : "LOCKED"}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="mt-10">
              <p className="text-xs tracking-[0.25em] text-crimson">WALLET LEDGER</p>
              <h2 className="mt-2 text-2xl font-semibold">ОРЛОГО / ЗАРЛАГЫН ТҮҮХ</h2>
              <div className="mt-4 divide-y divide-white/10 border-y border-white/10">
                {ledger.length ? (
                  ledger.slice(0, 14).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-4 py-3 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-white/65">
                          {entry.sourceType.replaceAll("_", " ").toUpperCase()}
                        </span>
                        {entry.balanceAfter != null ? (
                          <span className="mt-1 block text-[0.6rem] text-white/30">
                            BALANCE AFTER · {entry.balanceAfter.toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                      <span
                        className={`shrink-0 ${entry.coin < 0 ? "text-rose-300" : entry.coin > 0 ? "text-emerald-300" : "text-white/45"}`}
                      >
                        {entry.xp ? `${entry.xp > 0 ? "+" : ""}${entry.xp} XP · ` : ""}🪙{" "}
                        {entry.coin > 0 ? "+" : ""}
                        {entry.coin.toLocaleString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-5 text-sm text-white/40">Wallet history одоогоор хоосон.</p>
                )}
              </div>
            </section>
          </>
        )}

        <section className="mt-12">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-crimson" />
              <h2 className="text-xl font-semibold">SEASON REPUTATION</h2>
            </div>
            <span className="text-xs text-white/35">
              {seasonConfig?.seasonId || "NO ACTIVE SEASON"}
            </span>
          </div>
          <div className="mt-4 divide-y divide-white/10 border-y border-white/10">
            {leaders.length ? (
              leaders.slice(0, 10).map((entry, index) => (
                <div key={entry.uid} className="flex items-center justify-between py-3 text-sm">
                  <span>
                    <b className="mr-4 text-crimson">#{index + 1}</b>
                    {entry.nickname}
                  </span>
                  <span className="text-white/55">
                    {entry.seasonXp.toLocaleString()} XP · P{entry.prestige} ·{" "}
                    {rankForXp(entry.xp).name}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-5 text-sm text-white/40">Season ranking одоогоор хоосон.</p>
            )}
          </div>
        </section>
      </main>
      <OniFooter />
    </div>
  );
}
