import { useEffect, useMemo, useState } from "react";
import { Flame, Heart, Sparkles, Trophy, Zap } from "lucide-react";
import {
  fetchPublicMemberProfile,
  fetchSocialFeed,
  reactToTarget,
  type PublicMemberProfile,
  type SocialEvent,
} from "@/data/social";
import { ONI_VAULT, levelForXp } from "@/lib/oni-progression";
import { OniCosmeticFx } from "./OniCosmeticFx";

const REACTIONS = ["🔥", "🖤", "⚡", "👹"] as const;
export function OniSocialHub({ activeNickname }: { activeNickname: string }) {
  const [feed, setFeed] = useState<SocialEvent[]>([]);
  const [profile, setProfile] = useState<PublicMemberProfile | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => {
    void fetchSocialFeed()
      .then(setFeed)
      .catch(() => setFeed([]));
  }, []);
  useEffect(() => {
    if (!activeNickname) {
      setProfile(null);
      return;
    }
    let live = true;
    void fetchPublicMemberProfile(activeNickname)
      .then((x) => {
        if (live) setProfile(x);
      })
      .catch(() => {
        if (live) setProfile(null);
      });
    return () => {
      live = false;
    };
  }, [activeNickname]);
  const equippedIds = useMemo(
    () => (profile ? Object.values(profile.profile.equipped) : []),
    [profile],
  );
  const equipped = useMemo(
    () =>
      equippedIds
        .map((id) => ONI_VAULT.find((x) => x.id === id))
        .filter(Boolean),
    [equippedIds],
  );
  const react = async (e: SocialEvent, emoji: (typeof REACTIONS)[number]) => {
    setBusy(e.id);
    setNotice("");
    try {
      await reactToTarget("feed", e.id, emoji);
      setFeed((v) => v.map((x) => (x.id === e.id ? { ...x, reactions: x.reactions + 1 } : x)));
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setNotice(
        code === "daily_limit"
          ? "Өнөөдрийн 8 reaction дууссан."
          : code === "already_reacted"
            ? "Энэ activity-д өнөөдөр аль хэдийн reaction өгсөн."
            : "Reaction хийхэд member account шаардлагатай.",
      );
    } finally {
      setBusy("");
    }
  };
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <p className="hud-label text-crimson">CLAN FEED</p>
          <h2 className="mt-2 text-3xl font-semibold">NEXUS ACTIVITY</h2>
          <p className="mt-2 text-sm text-white/45">
            Achievement, event win, content approval, unlock зэрэг public activity энд автоматаар
            гарна.
          </p>
          {notice ? (
            <p className="mt-4 border border-crimson/25 bg-crimson/5 p-3 text-xs">{notice}</p>
          ) : null}
          <div className="mt-5 space-y-3">
            {feed.length ? (
              feed.slice(0, 18).map((e) => (
                <article key={e.id} className="border border-white/10 bg-white/[.025] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[.62rem] tracking-[.2em] text-crimson">
                        {e.type.replaceAll("_", " ").toUpperCase()}
                      </span>
                      <h3 className="mt-1 text-lg font-semibold">{e.title}</h3>
                      <p className="mt-1 text-sm text-white/50">{e.detail}</p>
                      <p className="mt-2 text-xs text-white/35">
                        {e.nickname}
                        {e.createdAt ? ` · ${new Date(e.createdAt).toLocaleString("mn-MN")}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-white/45">{e.reactions} reactions</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {REACTIONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        disabled={busy === e.id}
                        onClick={() => void react(e, r)}
                        className="min-h-10 min-w-11 border border-white/10 bg-white/[.03] px-3 text-sm disabled:opacity-40"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <p className="border-y border-white/10 py-6 text-sm text-white/40">
                Feed одоогоор хоосон.
              </p>
            )}
          </div>
        </div>
        <aside>
          {profile ? (
            <OniCosmeticFx
              effectIds={equippedIds}
              entranceKey={profile.profile.uid}
              className="sticky top-24 border border-crimson/30"
            >
              <div className="bg-crimson/[.045] p-5">
                <p className="hud-label text-crimson">MEMBER PROFILE</p>
                <h2 className="mt-3 text-3xl font-semibold">{profile.profile.nickname}</h2>
                <p className="mt-1 text-sm text-white/55">
                  LV.{levelForXp(profile.profile.xp)} · {profile.rank} · Prestige{" "}
                  {profile.profile.prestige}
                </p>
                <div className="mt-5 grid grid-cols-3 gap-px bg-white/10">
                  <div className="bg-ink p-3">
                    <Zap className="h-4 w-4 text-crimson" />
                    <strong className="mt-2 block">{profile.profile.meetCount}</strong>
                    <span className="text-[.6rem] text-white/40">MEET</span>
                  </div>
                  <div className="bg-ink p-3">
                    <Trophy className="h-4 w-4 text-crimson" />
                    <strong className="mt-2 block">{profile.profile.eventCount}</strong>
                    <span className="text-[.6rem] text-white/40">EVENT</span>
                  </div>
                  <div className="bg-ink p-3">
                    <Sparkles className="h-4 w-4 text-crimson" />
                    <strong className="mt-2 block">{profile.profile.creatorCount}</strong>
                    <span className="text-[.6rem] text-white/40">CONTENT</span>
                  </div>
                </div>
                <div className="mt-5">
                  <p className="text-xs tracking-[.18em] text-white/40">EQUIPPED / BADGES</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {equipped.length ? (
                      equipped.map((x) => (
                        <span
                          key={x!.id}
                          className="border border-crimson/25 bg-crimson/5 px-2.5 py-1.5 text-[.65rem]"
                        >
                          {x!.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-white/35">
                        Одоогоор cosmetic equip хийгээгүй.
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-5">
                  <p className="text-xs tracking-[.18em] text-white/40">GARAGE SHOWCASE</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {profile.vehicles.slice(0, 2).map((v) => (
                      <article key={v.id} className="overflow-hidden border border-white/10">
                        <img src={v.image} alt={v.name} className="h-28 w-full object-cover" />
                        <div className="p-3">
                          <strong className="text-sm">{v.name}</strong>
                          <p className="text-xs text-white/40">{v.summary}</p>
                        </div>
                      </article>
                    ))}
                    {!profile.vehicles.length ? (
                      <p className="text-xs text-white/35">Garage showcase хоосон.</p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-5">
                  <p className="text-xs tracking-[.18em] text-white/40">RECENT ACTIVITY</p>
                  <div className="mt-2 space-y-2">
                    {profile.recent.map((e) => (
                      <div key={e.id} className="border-l border-crimson/40 pl-3">
                        <p className="text-sm">{e.title}</p>
                        <p className="text-xs text-white/35">{e.detail}</p>
                      </div>
                    ))}
                    {!profile.recent.length ? (
                      <p className="text-xs text-white/35">Recent activity алга.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </OniCosmeticFx>
          ) : (
            <div className="border border-white/10 p-5 text-sm text-white/40">
              <Heart className="mb-3 h-5 w-5 text-crimson" />
              Гишүүн сонгоход progression profile, badges, garage showcase, recent activity энд
              гарна.
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
