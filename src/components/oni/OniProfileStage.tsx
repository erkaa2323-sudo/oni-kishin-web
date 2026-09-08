import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, Coins, Gauge, Image, Medal, Trophy, Users } from "lucide-react";

import { getMyAchievementClaims, getMyProgression } from "@/data/progression";
import type { MemberAccount } from "@/data/member-auth";
import {
  levelForXp,
  nextRankForXp,
  rankForXp,
  type OniProgressionProfile,
} from "@/lib/oni-progression";
import { OniFooter } from "./OniFooter";
import { OniHudNav } from "./OniHudNav";
import { OniMemberGate } from "./OniMemberGate";

const statClass = "border border-border bg-midnight/55 p-4 clip-notch";

export function OniProfileStage() {
  const [account, setAccount] = useState<MemberAccount | null>(null);
  const [profile, setProfile] = useState<OniProgressionProfile | null>(null);
  const [achievementCount, setAchievementCount] = useState(0);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const onAccount = useCallback((next: MemberAccount | null) => setAccount(next), []);

  useEffect(() => {
    let cancelled = false;
    if (account?.status !== "approved") {
      setProfile(null);
      setAchievementCount(0);
      return;
    }

    setLoadingProfile(true);
    void Promise.all([getMyProgression(), getMyAchievementClaims()])
      .then(([nextProfile, claims]) => {
        if (cancelled) return;
        setProfile(nextProfile);
        setAchievementCount(claims.size);
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [account?.status]);

  const rank = useMemo(() => (profile ? rankForXp(profile.xp) : null), [profile]);
  const nextRank = useMemo(() => (profile ? nextRankForXp(profile.xp) : null), [profile]);
  const level = profile ? levelForXp(profile.xp) : 1;
  const progress =
    profile && nextRank && rank
      ? Math.min(
          100,
          Math.max(0, ((profile.xp - rank.minXp) / (nextRank.minXp - rank.minXp)) * 100),
        )
      : profile
        ? 100
        : 0;

  return (
    <div className="min-h-screen bg-ink text-foreground">
      <OniHudNav />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-8 sm:pt-32">
        <section aria-labelledby="profile-title">
          <span className="hud-label text-crimson/85">ACCOUNT / PROFILE</span>
          <h1 id="profile-title" className="mt-4 text-cinema text-5xl sm:text-6xl">
            PROFILE
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Crew account, XP, ONI Coin, Meet оролцоо болон achievement мэдээллээ нэг дороос харна.
          </p>

          <OniMemberGate onAccount={onAccount} allowAccountActions />
        </section>

        {account?.status === "approved" ? (
          <section className="mt-8 space-y-6" aria-label="Profile мэдээлэл">
            <div className="glass-panel p-5 clip-notch sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="hud-label text-crimson/80">
                    {account.memberId || "ONI MEMBER"}
                  </span>
                  <h2 className="mt-2 text-cinema text-4xl">{account.nickname}</h2>
                  <p className="mt-2 text-xs text-muted-foreground">CPM ID: {account.cpmId}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="hud-label">LEVEL {level}</p>
                  <p className="mt-1 text-sm text-crimson">{rank?.name ?? "AWAKENED"}</p>
                </div>
              </div>

              <div className="mt-6 h-2 overflow-hidden bg-border/60">
                <div
                  className="h-full bg-crimson transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[0.65rem] text-muted-foreground">
                <span>
                  {profile
                    ? `${profile.xp.toLocaleString()} XP`
                    : loadingProfile
                      ? "УНШИЖ БАЙНА…"
                      : "0 XP"}
                </span>
                <span>
                  {nextRank
                    ? `${nextRank.minXp.toLocaleString()} XP → ${nextRank.name}`
                    : "MAX RANK"}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className={statClass}>
                <Gauge className="h-4 w-4 text-crimson" />
                <p className="mt-3 hud-label">XP</p>
                <p className="mt-1 text-2xl">{profile?.xp.toLocaleString() ?? "—"}</p>
              </div>
              <div className={statClass}>
                <Coins className="h-4 w-4 text-crimson" />
                <p className="mt-3 hud-label">COIN</p>
                <p className="mt-1 text-2xl">{profile?.coin.toLocaleString() ?? "—"}</p>
              </div>
              <div className={statClass}>
                <Users className="h-4 w-4 text-crimson" />
                <p className="mt-3 hud-label">MEET</p>
                <p className="mt-1 text-2xl">{profile?.meetCount ?? "—"}</p>
              </div>
              <div className={statClass}>
                <Trophy className="h-4 w-4 text-crimson" />
                <p className="mt-3 hud-label">EVENT</p>
                <p className="mt-1 text-2xl">{profile?.eventCount ?? "—"}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                to="/garage"
                className={`${statClass} group transition-colors hover:border-crimson/55`}
              >
                <Medal className="h-4 w-4 text-crimson" />
                <p className="mt-3 text-cinema text-2xl">GARAGE</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Өөрийн машин болон Crew garage руу орох.
                </p>
              </Link>
              <Link
                to="/gallery"
                className={`${statClass} group transition-colors hover:border-crimson/55`}
              >
                <Image className="h-4 w-4 text-crimson" aria-hidden="true" />
                <p className="mt-3 text-cinema text-2xl">GALLERY</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Зураг, creator контент болон дурсамжаа харах.
                </p>
              </Link>
              <Link
                to="/meet"
                className={`${statClass} group transition-colors hover:border-crimson/55`}
              >
                <Users className="h-4 w-4 text-crimson" />
                <p className="mt-3 text-cinema text-2xl">MEET</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Meet бүртгэл болон оролцооны хэсэг.
                </p>
              </Link>
              <Link
                to="/progression"
                className={`${statClass} group transition-colors hover:border-crimson/55`}
              >
                <Award className="h-4 w-4 text-crimson" />
                <p className="mt-3 text-cinema text-2xl">ACHIEVEMENTS</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Одоогоор {achievementCount} achievement claim хийсэн.
                </p>
              </Link>
              <Link
                to="/progression"
                className={`${statClass} group transition-colors hover:border-crimson/55`}
              >
                <Coins className="h-4 w-4 text-crimson" />
                <p className="mt-3 text-cinema text-2xl">ARCHIVE</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  XP, Coin, reward болон progression түүхээ харах.
                </p>
              </Link>
            </div>
          </section>
        ) : null}
      </main>
      <OniFooter />
    </div>
  );
}
