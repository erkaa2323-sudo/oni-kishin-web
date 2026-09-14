import { Link } from "@tanstack/react-router";
import { Flag, Gauge, Radio, ShieldCheck, Trophy, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchVehicles, type Vehicle } from "@/data/garage";
import {
  deriveLifecycle,
  fetchActiveMeet,
  fetchParticipants,
  LIFECYCLE_LABEL,
  type MeetParticipant,
  type MeetSession,
} from "@/data/meet";
import { fetchSocialFeed, type SocialEvent } from "@/data/social";
import { OniHudNav } from "./OniHudNav";

const disciplineLabel: Record<Vehicle["categoryId"], string> = {
  drift: "DRIFT OPS",
  street: "STREET OPS",
  track: "TRACK OPS",
};

const formatDate = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("mn-MN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export function OniStreetOpsStage() {
  const [meet, setMeet] = useState<MeetSession | null>(null);
  const [participants, setParticipants] = useState<MeetParticipant[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [feed, setFeed] = useState<SocialEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchActiveMeet(), fetchVehicles(), fetchSocialFeed().catch(() => [])]).then(
      async ([meetResult, garageResult, social]) => {
        if (!alive) return;
        const currentMeet = meetResult.status === "ok" ? meetResult.session : null;
        setMeet(currentMeet);
        setVehicles(garageResult.status === "ok" ? garageResult.rows : []);
        setFeed(social);
        if (currentMeet) setParticipants(await fetchParticipants(currentMeet.id));
        if (alive) setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const lifecycle = deriveLifecycle(meet);
  const featured = useMemo(() => vehicles.slice(0, 6), [vehicles]);
  const eventWins = useMemo(
    () => feed.filter((item) => item.type === "event_win").slice(0, 6),
    [feed],
  );
  const activeRiders = useMemo(() => {
    const unique = new Set(
      participants.map((item) => item.cpmNickname.toLocaleLowerCase("mn-MN")),
    );
    return unique.size;
  }, [participants]);

  return (
    <div className="min-h-screen bg-ink text-foreground">
      <OniHudNav />
      <main className="mx-auto w-full max-w-[110rem] px-4 pb-16 pt-28 sm:px-7 lg:pt-32">
        <section className="relative overflow-hidden border border-border bg-midnight/70 p-5 clip-notch sm:p-7 lg:p-9">
          <div className="absolute inset-0 scanline-veil opacity-25" aria-hidden="true" />
          <div className="relative grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
            <div>
              <span className="hud-label text-crimson/85">ONI CITY / LIVE OPERATIONS</span>
              <h1 className="mt-3 text-cinema text-4xl leading-none sm:text-5xl lg:text-6xl">
                STREET OPS
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                ONI ID, Garage DNA, Meet болон event activity-г нэг command board дээр холбосон
                live ажиллагааны төв.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link
                  to="/meet"
                  className="inline-flex min-h-[44px] items-center gap-2 border border-crimson/60 bg-crimson/15 px-4 text-[0.65rem] font-semibold tracking-[0.18em] text-foreground clip-notch"
                >
                  <Radio className="h-4 w-4" /> LIVE MEET
                </Link>
                <Link
                  to="/garage"
                  className="inline-flex min-h-[44px] items-center gap-2 border border-border bg-ink/55 px-4 text-[0.65rem] font-semibold tracking-[0.18em] text-muted-foreground clip-notch"
                >
                  <Gauge className="h-4 w-4" /> GARAGE DNA
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px bg-border">
              <div className="bg-ink/90 p-4">
                <span className="hud-label">OPS STATUS</span>
                <strong className="mt-2 block text-cinema text-xl">
                  {LIFECYCLE_LABEL[lifecycle]}
                </strong>
              </div>
              <div className="bg-ink/90 p-4">
                <span className="hud-label">ACTIVE RIDERS</span>
                <strong className="mt-2 block text-cinema text-2xl">{activeRiders}</strong>
              </div>
              <div className="bg-ink/90 p-4">
                <span className="hud-label">GARAGE UNITS</span>
                <strong className="mt-2 block text-cinema text-2xl">{vehicles.length}</strong>
              </div>
              <div className="bg-ink/90 p-4">
                <span className="hud-label">EVENT WINS</span>
                <strong className="mt-2 block text-cinema text-2xl">{eventWins.length}</strong>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="border border-border bg-midnight/55 p-5 clip-notch sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
              <div>
                <span className="hud-label text-crimson/80">CURRENT OPERATION</span>
                <h2 className="mt-2 text-cinema text-3xl">
                  {meet?.title ?? "NO ACTIVE OPERATION"}
                </h2>
              </div>
              <span className="hud-label">
                {meet ? formatDate(meet.scheduledAt) : "STANDBY"}
              </span>
            </div>

            {loading ? (
              <p className="py-8 text-sm text-muted-foreground">OPS data ачаалж байна…</p>
            ) : meet ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="border border-border bg-ink/45 p-4">
                  <Flag className="h-4 w-4 text-crimson" />
                  <span className="hud-label mt-3 block">STATUS</span>
                  <strong className="mt-1 block text-sm">{LIFECYCLE_LABEL[lifecycle]}</strong>
                </div>
                <div className="border border-border bg-ink/45 p-4">
                  <Users className="h-4 w-4 text-crimson" />
                  <span className="hud-label mt-3 block">ROSTER</span>
                  <strong className="mt-1 block text-sm">
                    {meet.registered}/{meet.capacity ?? 20}
                  </strong>
                </div>
                <div className="border border-border bg-ink/45 p-4">
                  <ShieldCheck className="h-4 w-4 text-crimson" />
                  <span className="hud-label mt-3 block">ACCESS</span>
                  <strong className="mt-1 block text-sm">REGISTERED CREW</strong>
                </div>
              </div>
            ) : (
              <p className="py-8 text-sm leading-6 text-muted-foreground">
                Одоогоор идэвхтэй operation алга. Admin шинэ Meet нээхэд энэ board автоматаар
                шинэчлэгдэнэ.
              </p>
            )}

            {participants.length ? (
              <div className="mt-5 border-t border-border pt-5">
                <span className="hud-label">DEPLOYED CREW</span>
                <div className="mt-3 flex flex-wrap gap-2">
                  {participants.slice(0, 20).map((member) => (
                    <span
                      key={`${member.cpmNickname}-${member.registeredAt}`}
                      className="border border-border bg-ink/45 px-3 py-2 text-xs tracking-wide"
                    >
                      {member.cpmNickname}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="border border-border bg-midnight/55 p-5 clip-notch sm:p-6">
            <div className="border-b border-border pb-4">
              <span className="hud-label text-crimson/80">EVENT HISTORY</span>
              <h2 className="mt-2 text-cinema text-3xl">RECENT WINS</h2>
            </div>
            <div className="mt-4 space-y-3">
              {eventWins.length ? (
                eventWins.map((item) => (
                  <div key={item.id} className="border border-border bg-ink/45 p-4">
                    <div className="flex items-start gap-3">
                      <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-crimson" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-sm">{item.nickname}</strong>
                          <span className="hud-label">{formatDate(item.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-foreground/85">
                          {item.title}
                        </p>
                        {item.detail ? (
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {item.detail}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-6 text-sm text-muted-foreground">
                  Event win activity хараахан бүртгэгдээгүй байна.
                </p>
              )}
            </div>
          </section>
        </div>

        <section className="mt-6 border border-border bg-midnight/55 p-5 clip-notch sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
            <div>
              <span className="hud-label text-crimson/80">GARAGE DNA / OPS READY</span>
              <h2 className="mt-2 text-cinema text-3xl">FEATURED MACHINES</h2>
            </div>
            <Link to="/garage" className="hud-label text-crimson hover:text-foreground">
              БҮХ ГАРАЖ →
            </Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {featured.map((car) => (
              <article
                key={car.id}
                className="overflow-hidden border border-border bg-ink/45 clip-notch"
              >
                {car.image ? (
                  <img
                    src={car.image}
                    alt=""
                    className="aspect-[16/9] w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="hud-label text-crimson/80">
                      {disciplineLabel[car.categoryId]}
                    </span>
                    <span className="hud-label">{car.dna.registry}</span>
                  </div>
                  <h3 className="mt-2 text-cinema text-2xl">{car.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PILOT / {car.ownerCallsign}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-px bg-border">
                    <div className="bg-midnight/75 p-3">
                      <span className="hud-label">BUILD</span>
                      <strong className="mt-1 block truncate text-xs">{car.dna.build}</strong>
                    </div>
                    <div className="bg-midnight/75 p-3">
                      <span className="hud-label">CLASS</span>
                      <strong className="mt-1 block text-xs">{car.dna.discipline}</strong>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
