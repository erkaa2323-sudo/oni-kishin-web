import { Bot, Crown, Gauge, Map, Radio, Rotate3D, Sparkles, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { fetchVehicles, type Vehicle } from "@/data/garage";
import {
  fetchActiveMeet,
  fetchParticipants,
  type MeetParticipant,
  type MeetSession,
} from "@/data/meet";
import { fetchSocialFeed, type SocialEvent } from "@/data/social";
import { OniHudNav } from "./OniHudNav";

type DistrictId = "hq" | "drift" | "garage" | "archive" | "ai" | "arena" | "docks";

type DistrictSelection = {
  district: DistrictId;
  route: string;
  name: string;
};

const districts: Array<{
  id: DistrictId;
  label: string;
  route: string;
  icon: typeof Crown;
}> = [
  { id: "hq", label: "ONI CITADEL", route: "/profile", icon: Crown },
  { id: "drift", label: "KISHIN MOUNTAIN", route: "/meet", icon: Radio },
  { id: "garage", label: "KISHIN GARAGE", route: "/garage", icon: Gauge },
  { id: "archive", label: "MEMORY ARCHIVE", route: "/gallery", icon: Sparkles },
  { id: "ai", label: "SHIZUKI AI TOWER", route: "/oni-ai", icon: Bot },
  { id: "arena", label: "ONI ARENA", route: "/meet", icon: Users },
  { id: "docks", label: "AKUMA DOCKS", route: "/garage", icon: Map },
];

const toActiveRiderCount = (participants: MeetParticipant[]) =>
  new Set(participants.map((item) => item.cpmNickname.toLocaleLowerCase("mn-MN"))).size;

export function OniStreetOpsStage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [meet, setMeet] = useState<MeetSession | null>(null);
  const [participants, setParticipants] = useState<MeetParticipant[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [feed, setFeed] = useState<SocialEvent[]>([]);
  const [worldReady, setWorldReady] = useState(false);
  const [worldError, setWorldError] = useState(false);
  const [selection, setSelection] = useState<DistrictSelection | null>(null);

  useEffect(() => {
    let alive = true;

    Promise.all([fetchActiveMeet(), fetchVehicles(), fetchSocialFeed().catch(() => [])]).then(
      async ([meetResult, garageResult, social]) => {
        if (!alive) return;

        const currentMeet = meetResult.status === "ok" ? meetResult.session : null;
        setMeet(currentMeet);
        setVehicles(garageResult.status === "ok" ? garageResult.rows : []);
        setFeed(social);

        if (currentMeet) {
          const rows = await fetchParticipants(currentMeet.id);
          if (alive) setParticipants(rows);
        }
      },
    );

    return () => {
      alive = false;
    };
  }, []);

  const activeRiders = useMemo(() => toActiveRiderCount(participants), [participants]);
  const eventWins = useMemo(() => feed.filter((item) => item.type === "event_win").length, [feed]);
  const worldPulse = Math.min(100, 24 + activeRiders * 5 + eventWins * 4 + vehicles.length * 2);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "oni-world:ready") {
        setWorldReady(true);
        setWorldError(false);
      }

      if (event.data?.type === "oni-world:error") {
        setWorldError(true);
      }

      if (event.data?.type === "oni-world:district") {
        setSelection({
          district: event.data.district as DistrictId,
          route: String(event.data.route ?? "/street-ops"),
          name: String(event.data.name ?? "ONI WORLD"),
        });
      }

      if (event.data?.type === "oni-world:enter" && typeof event.data.route === "string") {
        window.location.assign(event.data.route);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!worldReady) return;
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "oni-world:state",
        payload: {
          meetActive: Boolean(meet),
          activeRiders,
          machines: vehicles.length,
          pulse: worldPulse,
        },
      },
      window.location.origin,
    );
  }, [activeRiders, meet, vehicles.length, worldPulse, worldReady]);

  const focusDistrict = (district: DistrictId) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "oni-world:focus", district },
      window.location.origin,
    );
  };

  const resetWorld = () => {
    setSelection(null);
    iframeRef.current?.contentWindow?.postMessage(
      { type: "oni-world:reset" },
      window.location.origin,
    );
  };

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-ink text-foreground">
      <OniHudNav />

      <main className="relative h-[100svh] min-h-[680px] w-full overflow-hidden bg-[#030307]">
        <iframe
          ref={iframeRef}
          src="/oni-world-3d-host.html"
          title="ONI WORLD 360° 3D megacity"
          className="absolute inset-0 h-full w-full border-0"
          allow="fullscreen"
        />

        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-48 bg-gradient-to-b from-black/80 via-black/30 to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-52 bg-gradient-to-t from-black/80 via-black/25 to-transparent"
          aria-hidden="true"
        />

        <section className="pointer-events-none absolute left-4 right-4 top-24 z-20 flex items-start justify-between gap-3 sm:left-7 sm:right-7 lg:top-28">
          <div className="max-w-[72vw] border border-white/10 bg-black/45 px-3 py-3 backdrop-blur-xl clip-notch sm:px-4">
            <span className="hud-label text-crimson/90">ONI WORLD // 2099</span>
            <h1 className="mt-1 text-cinema text-3xl leading-none sm:text-4xl">3D MEGACITY</h1>
            <p className="mt-2 hidden max-w-lg text-[0.68rem] leading-5 text-white/55 sm:block">
              Drag хийж 360° эргүүл. Pinch хийж zoom. District дээр tap хийхэд camera тухайн бүс рүү
              cinematic байдлаар шилжинэ.
            </p>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-px border border-white/10 bg-white/10 text-right backdrop-blur-xl">
            <div className="bg-black/55 px-3 py-2">
              <span className="hud-label block text-[0.48rem]">WORLD</span>
              <strong className="mt-1 block text-[0.64rem] tracking-[0.12em] text-crimson">
                {meet ? "LIVE" : "STANDBY"}
              </strong>
            </div>
            <div className="bg-black/55 px-3 py-2">
              <span className="hud-label block text-[0.48rem]">PULSE</span>
              <strong className="mt-1 block text-[0.64rem] tracking-[0.12em]">{worldPulse}%</strong>
            </div>
          </div>
        </section>

        <aside className="absolute bottom-5 left-4 z-20 hidden max-w-[calc(100vw-2rem)] gap-2 sm:flex sm:left-7">
          {districts.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => focusDistrict(id)}
              className="group pointer-events-auto flex min-h-10 items-center gap-2 border border-white/10 bg-black/45 px-3 text-[0.58rem] font-semibold tracking-[0.12em] text-white/60 backdrop-blur-xl transition hover:border-crimson/50 hover:text-white"
            >
              <Icon className="h-3.5 w-3.5 text-crimson/75" />
              <span className="hidden xl:inline">{label}</span>
            </button>
          ))}
        </aside>

        <div className="absolute bottom-5 right-4 z-30 flex flex-col items-end gap-2 sm:right-7">
          {selection ? (
            <div className="w-[min(330px,calc(100vw-2rem))] border border-crimson/35 bg-black/75 p-4 backdrop-blur-2xl clip-notch">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="hud-label text-crimson/90">DISTRICT LOCKED</span>
                  <h2 className="mt-1 text-cinema text-2xl leading-none">{selection.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={resetWorld}
                  className="pointer-events-auto grid h-8 w-8 place-items-center border border-white/10 bg-white/5 text-white/55 transition hover:text-white"
                  aria-label="World view рүү буцах"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                <button
                  type="button"
                  onClick={() => window.location.assign(selection.route)}
                  className="pointer-events-auto min-h-11 border border-crimson/60 bg-crimson/15 px-4 text-left text-[0.64rem] font-bold tracking-[0.16em] text-white transition hover:bg-crimson/25"
                >
                  ENTER DISTRICT →
                </button>
                <button
                  type="button"
                  onClick={resetWorld}
                  className="pointer-events-auto min-h-11 border border-white/10 bg-white/5 px-3 text-white/60 transition hover:text-white"
                  aria-label="360 degree world view"
                >
                  <Rotate3D className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="pointer-events-none flex items-center gap-2 border border-white/10 bg-black/45 px-3 py-2 text-[0.58rem] tracking-[0.12em] text-white/55 backdrop-blur-xl">
              <Rotate3D className="h-3.5 w-3.5 text-crimson" />
              360° WORLD CONTROL
            </div>
          )}
        </div>

        {worldError ? (
          <div className="absolute inset-x-4 top-1/2 z-40 -translate-y-1/2 border border-crimson/40 bg-black/90 p-5 text-center backdrop-blur-2xl clip-notch sm:inset-x-auto sm:left-1/2 sm:w-[430px] sm:-translate-x-1/2">
            <span className="hud-label text-crimson">3D ENGINE OFFLINE</span>
            <h2 className="mt-2 text-cinema text-3xl">WORLD SAFE MODE</h2>
            <p className="mt-3 text-xs leading-6 text-white/55">
              3D engine-ийн CDN ачаалж чадсангүй. Доорх district navigation ажилласаар байна.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {districts.slice(0, 6).map(({ id, label, route }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => window.location.assign(route)}
                  className="pointer-events-auto min-h-11 border border-white/10 bg-white/5 px-3 text-[0.58rem] font-semibold tracking-[0.1em] text-white/75"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
