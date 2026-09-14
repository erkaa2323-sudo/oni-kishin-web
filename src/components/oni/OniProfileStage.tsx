import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  CalendarDays,
  CarFront,
  Coins,
  Copy,
  Crown,
  Gauge,
  Image,
  Medal,
  Trophy,
  Users,
} from "lucide-react";

import { getMyAchievementClaims, getMyProgression } from "@/data/progression";
import type { MemberAccount } from "@/data/member-auth";
import { fetchMyOniIdentity, type OniIdentity } from "@/data/profile";
import {
  ONI_VAULT,
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
  const [identity, setIdentity] = useState<OniIdentity | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [copyNotice, setCopyNotice] = useState("");

  const onAccount = useCallback((next: MemberAccount | null) => setAccount(next), []);

  useEffect(() => {
    let cancelled = false;
    if (account?.status !== "approved") {
      setProfile(null);
      setIdentity(null);
      setAchievementCount(0);
      return;
    }

    setLoadingProfile(true);
    void Promise.all([getMyProgression(), getMyAchievementClaims(), fetchMyOniIdentity(account)])
      .then(([nextProfile, claims, nextIdentity]) => {
        if (cancelled) return;
        setProfile(nextProfile);
        setAchievementCount(claims.size);
        setIdentity(nextIdentity);
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [account]);

  const rank = useMemo(() => (profile ? rankForXp(profile.xp) : null), [profile]);
  const nextRank = useMemo(() => (profile ? nextRankForXp(profile.xp) : null), [profile]);
  const level = profile ? levelForXp(profile.xp) : 1;
  const equippedTitle = ONI_VAULT.find(
    (item) => item.category === "title" && item.id === profile?.equipped["title"],
  );
  const progress =
    profile && nextRank && rank
      ? Math.min(
          100,
          Math.max(0, ((profile.xp - rank.minXp) / (nextRank.minXp - rank.minXp)) * 100),
        )
      : profile
        ? 100
        : 0;

  const copyOniId = async () => {
    if (!identity?.oniId) return;
    try {
      await navigator.clipboard.writeText(identity.oniId);
      setCopyNotice("ONI ID ХУУЛАГДЛАА");
    } catch {
      setCopyNotice(`ONI ID: ${identity.oniId}`);
    }
    window.setTimeout(() => setCopyNotice(""), 1800);
  };

  return (
    <div className="min-h-screen bg-ink text-foreground">
      <OniHudNav />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-8 sm:pt-32">
        <section aria-labelledby="profile-title">
          <span className="hud-label text-crimson/85">ONI ID / DIGITAL CREW PASSPORT</span>
          <h1 id="profile-title" className="mt-4 text-cinema text-5xl sm:text-6xl">
            ONI ID
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Таны crew identity, rank, гараж, Meet оролцоо болон achievement нэг профайлд холбогдоно.
          </p>

          <OniMemberGate onAccount={onAccount} allowAccountActions />
        </section>

        {account?.status === "approved" ? (
          <section className="mt-8 space-y-6" aria-label="Profile мэдээлэл">
            <div className="glass-panel relative overflow-hidden p-5 clip-notch sm:p-7">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,oklch(0.55_0.215_25.5/0.18),transparent_36%)]" />
              <div className="relative grid gap-6 sm:grid-cols-[8.5rem_minmax(0,1fr)_auto] sm:items-end">
                <div className="aspect-[3/4] overflow-hidden border border-crimson/35 bg-midnight/70 clip-notch">
                  {identity?.portrait ? (
                    <img
                      src={identity.portrait}
                      alt={`${identity.nickname} — ONI ID хөрөг`}
                      width={512}
                      height={682}
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <div className="grid h-full place-items-center">
                      <Users className="h-7 w-7 text-crimson/60" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => void copyOniId()}
                    className="inline-flex min-h-11 items-center gap-2 border border-crimson/35 bg-crimson/10 px-3 text-left hud-label text-crimson transition-colors hover:bg-crimson/20"
                    aria-label="ONI ID хуулах"
                  >
                    {identity?.oniId || account.memberId || "ONI MEMBER"}
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <h2 className="mt-3 truncate text-cinema text-4xl sm:text-5xl">
                    {identity?.nickname || account.nickname}
                  </h2>
                  <p className="mt-2 text-xs tracking-[0.12em] text-muted-foreground">
                    CPM ID {identity?.cpmId || account.cpmId}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-[0.65rem] tracking-[0.12em] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Crown className="h-3.5 w-3.5 text-crimson" />
                      {identity?.role || "CREW MEMBER"}
                    </span>
                    {identity?.joinedAt ? (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-crimson" />
                        {identity.joinedAt}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="hud-label">LEVEL {level}</p>
                  <p className="mt-1 text-sm text-crimson">{rank?.name ?? "AWAKENED"}</p>
                  {equippedTitle ? (
                    <p className="mt-2 text-[0.65rem] tracking-[0.16em] text-foreground">
                      {equippedTitle.name}
                    </p>
                  ) : null}
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
              {copyNotice ? (
                <p
                  className="relative mt-3 text-[0.65rem] tracking-[0.14em] text-crimson"
                  role="status"
                >
                  {copyNotice}
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
              <div className={statClass}>
                <CarFront className="h-4 w-4 text-crimson" />
                <p className="mt-3 hud-label">GARAGE</p>
                <p className="mt-1 text-2xl">{identity?.vehicles.length ?? "—"}</p>
              </div>
            </div>

            {identity?.mainVehicle ? (
              <a
                href={`/garage?vehicle=${encodeURIComponent(identity.mainVehicle.id)}${identity.mainVehicle.ownerMemberId ? `&owner=${encodeURIComponent(identity.mainVehicle.ownerMemberId)}` : ""}`}
                className="group grid gap-4 overflow-hidden border border-crimson/30 bg-midnight/55 p-4 clip-notch transition-colors hover:border-crimson/60 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="aspect-video overflow-hidden bg-ink/70">
                  {identity.mainVehicle.image ? (
                    <img
                      src={identity.mainVehicle.image}
                      alt=""
                      aria-hidden="true"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <span className="hud-label text-crimson/80">MAIN MACHINE</span>
                  <h3 className="mt-2 truncate text-cinema text-2xl">
                    {identity.mainVehicle.name}
                  </h3>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {[
                      identity.mainVehicle.drivetrain,
                      identity.mainVehicle.horsepower
                        ? `${identity.mainVehicle.horsepower} HP`
                        : "",
                      identity.mainVehicle.liveryTheme,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Garage DNA бүртгэл"}
                  </p>
                </div>
                <CarFront className="hidden h-6 w-6 text-crimson sm:block" />
              </a>
            ) : null}

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
