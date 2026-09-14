import { Link } from "@tanstack/react-router";
import {
  Bot,
  Crown,
  Flag,
  Gauge,
  Map,
  Radio,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react";
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
  drift: "DRIFT DISTRICT",
  street: "NIGHT DISTRICT",
  track: "BATTLE ARENA",
};

const districts = [
  {
    code: "01",
    name: "ONI HQ",
    label: "CREW CORE",
    description: "ONI ID, crew roster, progression болон кланы гол төв.",
    to: "/profile" as const,
    Icon: Crown,
  },
  {
    code: "02",
    name: "DRIFT DISTRICT",
    label: "LIVE MEET",
    description: "Meet, private voice, бүртгэл болон live roster руу шууд нэвтэрнэ.",
    to: "/meet" as const,
    Icon: Radio,
  },
  {
    code: "03",
    name: "MACHINE SECTOR",
    label: "GARAGE DNA",
    description: "Crew-ийн машинууд, build, registry болон pilot identity.",
    to: "/garage" as const,
    Icon: Gauge,
  },
  {
    code: "04",
    name: "MEMORY ARCHIVE",
    label: "GALLERY",
    description: "Кланы зураг, event moment болон digital archive.",
    to: "/gallery" as const,
    Icon: Sparkles,
  },
  {
    code: "05",
    name: "AI COMMAND",
    label: "ONI SHIZUKI",
    description: "ONI AI commander, туслах болон smart command interface.",
    to: "/oni-ai" as const,
    Icon: Bot,
  },
];

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
  const featured = useMemo(() => vehicles.slice(0, 3), [vehicles]);
  const eventWins = useMemo(
    () => feed.filter((item) => item.type === "event_win").slice(0, 4),
    [feed],
  );
  const activeRiders = useMemo(() => {
    const unique = new Set(participants.map((item) => item.cpmNickname.toLocaleLowerCase("mn-MN")));
    return unique.size;
  }, [participants]);

  const worldState = meet ? "WORLD ACTIVE" : "CITY STANDBY";
  const worldPulse = Math.min(100, 24 + activeRiders * 5 + eventWins.length * 8 + vehicles.length * 2);

  return (
    <div className="min-h-screen bg-ink text-foreground">
      <OniHudNav />
      <main className="mx-auto w-full max-w-[110rem] px-4 pb-16 pt-28 sm:px-7 lg:pt-32">
        <section className="relative overflow-hidden border border-border bg-midnight/70 p-5 clip-notch sm:p-7 lg:p-9">
          <div className="absolute inset-0 scanline-veil opacity-30" aria-hidden="true" />
          <div
            className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-crimson/20 bg-crimson/5 blur-2xl"
            aria-hidden="true"
          />
          <div className="relative grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div>
              <span className="hud-label text-crimson/85">ONI CITY / DIGITAL WORLD</span>
              <h1 className="mt-3 text-cinema text-5xl leading-none sm:text-6xl lg:text-7xl">
                ONI WORLD
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Crew, Garage DNA, Meet, Event болон ONI AI-г нэг амьд digital city дотор холбосон
                кланы үндсэн ертөнц.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link
                  to="/meet"
                  className="inline-flex min-h-[44px] items-center gap-2 border border-crimson/60 bg-crimson/15 px-4 text-[0.65rem] font-semibold tracking-[0.18em] text-foreground clip-notch"
                >
                  <Radio className="h-4 w-4" /> LIVE DISTRICT
                </Link>
                <Link
                  to="/profile"
                  className="inline-flex min-h-[44px] items-center gap-2 border border-border bg-ink/55 px-4 text-[0.65rem] font-semibold tracking-[0.18em] text-muted-foreground clip-notch"
                >
                  <Crown className="h-4 w-4" /> DRIVER ID
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px bg-border">
              <div className="bg-ink/90 p-4">
                <span className="hud-label">WORLD STATE</span>
                <strong className="mt-2 block text-cinema text-xl">{worldState}</strong>
              </div>
              <div className="bg-ink/90 p-4">
                <span className="hud-label">WORLD PULSE</span>
                <strong className="mt-2 block text-cinema text-2xl">{worldPulse}%</strong>
              </div>
              <div className="bg-ink/90 p-4">
                <span className="hud-label">ACTIVE RIDERS</span>
                <strong className="mt-2 block text-cinema text-2xl">{activeRiders}</strong>
              </div>
              <div className="bg-ink/90 p-4">
                <span className="hud-label">MACHINES</span>
                <strong className="mt-2 block text-cinema text-2xl">{vehicles.length}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 border border-border bg-midnight/55 p-5 clip-notch sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
            <div>
              <span className="hud-label text-crimson/80">CITY NETWORK</span>
              <h2 className="mt-2 text-cinema text-3xl">WORLD DISTRICTS</h2>
            </div>
            <span className="hud-label">05 DISTRICTS ONLINE</span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {districts.map(({ code, name, label, description, to, Icon }) => (
              <Link
                key={name}
                to={to}
                className="group relative min-h-52 overflow-hidden border border-border bg-ink/50 p-4 transition hover:-translate-y-1 hover:border-crimson/60 hover:bg-crimson/5 clip-notch"
              >
                <div className="flex items-center justify-between">
                  <span className="hud-label text-crimson/80">{code}</span>
                  <Icon className="h-5 w-5 text-muted-foreground transition group-hover:text-crimson" />
                </div>
                <div className="mt-12">
                  <span className="hud-label">{label}</span>
                  <h3 className="mt-2 text-cinema text-2xl">{name}</h3>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">{description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="border border-border bg-midnight/55 p-5 clip-notch sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
              <div>
                <span className="hud-label text-crimson/80">LIVE WORLD EVENT</span>
                <h2 className="mt-2 text-cinema text-3xl">{meet?.title ?? "CITY IN STANDBY"}</h2>
              </div>
              <span className="hud-label">{meet ? formatDate(meet.scheduledAt) : "NO ACTIVE MEET"}</span>
            </div>

            {loading ? (
              <p className="py-8 text-sm text-muted-foreground">ONI WORLD data ачаалж байна…</p>
            ) : meet ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
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

                {participants.length ? (
                  <div className="mt-5 border-t border-border pt-5">
                    <span className="hud-label">LIVE RIDERS</span>
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
              </>
            ) : (
              <div className="py-8">
                <p className="text-sm leading-6 text-muted-foreground">
                  Одоогоор active Meet алга. Шинэ Meet нээгдэхэд ONI WORLD автоматаар live төлөвт
                  шилжинэ.
                </p>
                <Link to="/meet" className="hud-label mt-4 inline-flex text-crimson">
                  MEET ZONE РУУ →
                </Link>
              </div>
            )}
          </section>

          <section className="border border-border bg-midnight/55 p-5 clip-notch sm:p-6">
            <div className="border-b border-border pb-4">
              <span className="hud-label text-crimson/80">MISSION NETWORK</span>
              <h2 className="mt-2 text-cinema text-3xl">WORLD OBJECTIVES</h2>
            </div>
            <div className="mt-4 space-y-3">
              <Link to="/meet" className="flex items-start gap-3 border border-border bg-ink/45 p-4">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-crimson" />
                <div>
                  <strong className="text-sm">LIVE MEET DEPLOYMENT</strong>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Meet-д бүртгүүлж crew roster-д нэгдэн live district-ийг идэвхжүүл.
                  </p>
                </div>
              </Link>
              <Link to="/garage" className="flex items-start gap-3 border border-border bg-ink/45 p-4">
                <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-crimson" />
                <div>
                  <strong className="text-sm">GARAGE DNA SYNC</strong>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Crew machine registry болон build identity-г шалга.
                  </p>
                </div>
              </Link>
              <Link to="/oni-ai" className="flex items-start gap-3 border border-border bg-ink/45 p-4">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-crimson" />
                <div>
                  <strong className="text-sm">AI COMMAND LINK</strong>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    ONI Shizuki-гээс clan, Meet болон системийн тусламж ав.
                  </p>
                </div>
              </Link>
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section className="border border-border bg-midnight/55 p-5 clip-notch sm:p-6">
            <div className="flex items-end justify-between gap-3 border-b border-border pb-4">
              <div>
                <span className="hud-label text-crimson/80">BATTLE MEMORY</span>
                <h2 className="mt-2 text-cinema text-3xl">RECENT WINS</h2>
              </div>
              <Trophy className="h-5 w-5 text-crimson" />
            </div>
            <div className="mt-4 space-y-3">
              {eventWins.length ? (
                eventWins.map((item) => (
                  <div key={item.id} className="border border-border bg-ink/45 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-sm">{item.nickname}</strong>
                      <span className="hud-label">{formatDate(item.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-foreground/85">{item.title}</p>
                    {item.detail ? (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="py-6 text-sm text-muted-foreground">World history-д event win хараахан алга.</p>
              )}
            </div>
          </section>

          <section className="border border-border bg-midnight/55 p-5 clip-notch sm:p-6">
            <div className="flex items-end justify-between gap-3 border-b border-border pb-4">
              <div>
                <span className="hud-label text-crimson/80">GARAGE DNA / WORLD LINK</span>
                <h2 className="mt-2 text-cinema text-3xl">FEATURED MACHINES</h2>
              </div>
              <Map className="h-5 w-5 text-crimson" />
            </div>
            <div className="mt-4 space-y-3">
              {featured.map((car) => (
                <Link
                  key={car.id}
                  to="/garage"
                  className="grid gap-3 border border-border bg-ink/45 p-3 sm:grid-cols-[8rem_1fr]"
                >
                  {car.image ? (
                    <img
                      src={car.image}
                      alt=""
                      className="aspect-[16/9] w-full object-cover sm:h-full"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex aspect-[16/9] items-center justify-center bg-midnight/80">
                      <Gauge className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 py-1">
                    <span className="hud-label text-crimson/80">{disciplineLabel[car.categoryId]}</span>
                    <h3 className="mt-1 truncate text-cinema text-xl">{car.name}</h3>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      PILOT / {car.ownerCallsign} · {car.dna.registry}
                    </p>
                  </div>
                </Link>
              ))}
              {!featured.length && !loading ? (
                <p className="py-6 text-sm text-muted-foreground">Garage DNA machine хараахан алга.</p>
              ) : null}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
