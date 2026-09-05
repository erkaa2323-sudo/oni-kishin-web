import { useEffect, useMemo, useState } from "react";

import crewHall from "@/assets/crew/crew-hall.jpg";
import {
  CREW_ROLES,
  CREW_STATUS_LABEL,
  fetchCrew,
  type CrewMember,
  type CrewRoleId,
} from "@/data/crew";
import { OniHudNav } from "./OniHudNav";
import { OniFooter } from "./OniFooter";

type Filter = CrewRoleId | "all";

export function OniCrewStage() {
  const [roster, setRoster] = useState<CrewMember[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    let alive = true;
    void fetchCrew().then((r) => {
      if (!alive) return;
      if (r.status === "error") {
        setLoadState("error");
        setLoadError(r.reason);
        return;
      }
      setRoster(r.rows);
      setActiveId(r.rows[0]?.id ?? "");
      setLoadState("ready");
    });
    return () => {
      alive = false;
    };
  }, []);

  const visible = useMemo(
    () => (filter === "all" ? roster : roster.filter((m) => m.roleId === filter)),
    [roster, filter],
  );

  const active = roster.find((m) => m.id === activeId) ?? visible[0] ?? roster[0];

  const selectFilter = (f: Filter) => {
    setFilter(f);
    const next = f === "all" ? roster : roster.filter((m) => m.roleId === f);
    if (next.length && !next.some((m) => m.id === activeId)) setActiveId(next[0]!.id);
  };

  return (
    <div className="relative min-h-screen bg-ink">
      <OniHudNav />

      <main className="relative">
        <section className="relative isolate overflow-hidden" aria-labelledby="crew-title">
          {/* backdrop */}
          <div className="absolute inset-0">
            <img
              src={crewHall}
              alt=""
              aria-hidden="true"
              width={1920}
              height={1088}
              fetchPriority="high"
              decoding="async"
              className="h-full w-full scale-105 object-cover opacity-70"
            />
          </div>
          <div
            className="pointer-events-none absolute inset-x-[-10%] bottom-0 top-[10%] animate-haze blur-3xl"
            style={{
              background:
                "radial-gradient(45% 55% at 40% 65%, oklch(0.55 0.215 25.5 / 0.18), transparent 70%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "var(--gradient-vignette)" }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "var(--gradient-floor)" }}
          />
          <div className="pointer-events-none absolute inset-0 scanline-veil opacity-20 mix-blend-overlay" />

          <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-[110rem] flex-col px-5 pb-8 pt-24 sm:px-8 sm:pt-28">
            <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
              <div className="min-w-0">
                <span className="hud-label hud-rule block pl-11 text-crimson/85">
                  SECTOR 01 / CREW
                </span>
                <h1
                  id="crew-title"
                  className="mt-3 text-cinema text-4xl text-foreground sm:text-6xl"
                >
                  БҮРЭЛДЭХҮҮН
                </h1>
              </div>
              <span className="hud-label hidden shrink-0 sm:block">
                {loadState === "ready" ? `${visible.length} / ${roster.length} НЭГЖ` : "—"}
              </span>
            </header>

            {/* filters */}
            <div
              className="-mx-5 mt-6 flex snap-x gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
              role="tablist"
              aria-label="Үүргээр шүүх"
            >
              {[{ id: "all" as const, label: "БҮГД", code: "ALL" }, ...CREW_ROLES].map((r) => {
                const on = filter === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => selectFilter(r.id as Filter)}
                    className={`shrink-0 snap-start border px-4 py-3 text-[0.62rem] tracking-[0.24em] transition-colors duration-300 clip-notch ${
                      on
                        ? "border-crimson/70 bg-crimson/20 text-foreground"
                        : "border-border bg-ink/50 text-muted-foreground backdrop-blur-md hover:border-crimson/50 hover:text-foreground"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>

            {loadState !== "ready" || roster.length === 0 ? (
              <div className="mt-8 flex flex-1 items-center justify-center">
                <div className="max-w-md border border-dashed border-border bg-ink/60 p-8 text-center backdrop-blur-md">
                  <span className="hud-label block text-crimson/80">
                    {loadState === "loading"
                      ? "ROSTER SYNC"
                      : loadState === "error"
                        ? "ROSTER UNAVAILABLE"
                        : "ROSTER EMPTY"}
                  </span>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {loadState === "loading"
                      ? "Бүрэлдэхүүний бүртгэл ачаалж байна…"
                      : loadState === "error"
                        ? loadError
                        : "Бүртгэгдсэн идэвхтэй гишүүн одоогоор алга. Админ бүртгэл нэмсний дараа энд харагдана."}
                  </p>
                </div>
              </div>
            ) : null}

            {/* stage */}
            <div
              className={`relative mt-4 ${loadState === "ready" && roster.length ? "grid" : "hidden"} flex-1 grid-rows-[auto_auto] gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:grid-rows-1 lg:items-center lg:gap-10`}
            >
              {/* identity panel */}
              {active ? (
                <div key={active.id} className="order-2 min-w-0 animate-rise lg:order-1">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="h-1.5 w-1.5 shrink-0 bg-crimson animate-pulse-soft" />
                    <span className="hud-label truncate">
                      {CREW_STATUS_LABEL[active.status]} —{" "}
                      {CREW_ROLES.find((r) => r.id === active.roleId)?.code}
                    </span>
                  </div>
                  <h2 className="mt-3 flex min-w-0 items-baseline gap-3 text-cinema text-5xl text-foreground sm:text-6xl">
                    <span className="truncate">{active.callsign}</span>
                    {active.kana ? (
                      <span className="shrink-0 text-lg text-crimson/70">{active.kana}</span>
                    ) : null}
                  </h2>
                  <p className="mt-2 text-sm tracking-[0.14em] text-crimson/90">{active.title}</p>
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                    {active.bio}
                  </p>

                  <dl className="mt-6 grid gap-px overflow-hidden border border-border bg-border/60 sm:grid-cols-3 lg:grid-cols-1">
                    {active.traits.map((t) => (
                      <div key={t.label} className="min-w-0 bg-ink/70 px-4 py-3 backdrop-blur-md">
                        <dt className="hud-label truncate">{t.label}</dt>
                        <dd className="mt-1 truncate text-sm text-foreground">{t.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              {/* portrait */}
              <div className="relative order-1 flex min-h-[42svh] items-end justify-center lg:order-2 lg:min-h-[62svh]">
                <div
                  className="pointer-events-none absolute inset-x-[10%] bottom-[4%] top-[12%] blur-[70px]"
                  style={{
                    background:
                      "radial-gradient(50% 50% at 50% 60%, oklch(0.55 0.215 25.5 / 0.32), transparent 72%)",
                  }}
                />
                {active?.portrait ? (
                  <img
                    key={active.id}
                    src={active.portrait}
                    alt={`${active.callsign} — ${active.title}`}
                    width={1024}
                    height={1536}
                    decoding="async"
                    className="relative h-[42svh] w-auto animate-rise object-contain drop-shadow-[0_30px_70px_rgba(0,0,0,0.85)] sm:h-[52svh] lg:h-[68svh]"
                  />
                ) : (
                  <div className="relative grid h-[42svh] w-40 place-items-center border border-dashed border-border text-center lg:h-[68svh]">
                    <span className="hud-label px-3">ЗУРАГ БАЙХГҮЙ</span>
                  </div>
                )}
              </div>
            </div>

            {/* roster selector */}
            <div
              className={`relative z-10 mt-6 ${loadState === "ready" && roster.length ? "" : "hidden"}`}
            >
              <span className="hud-label block">БҮРТГЭЛ</span>
              <ul
                className="-mx-5 mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0"
                aria-label="Гишүүд"
              >
                {visible.map((m) => {
                  const on = m.id === active?.id;
                  return (
                    <li key={m.id} className="shrink-0 snap-start">
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setActiveId(m.id)}
                        className={`group flex w-36 items-center gap-3 border px-3 py-3 text-left transition-colors duration-300 clip-notch sm:w-44 ${
                          on
                            ? "border-crimson/70 bg-crimson/15"
                            : "border-border bg-ink/60 backdrop-blur-md hover:border-crimson/50"
                        }`}
                      >
                        <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden border border-border bg-midnight/60">
                          {m.portrait ? (
                            <img
                              src={m.portrait}
                              alt=""
                              aria-hidden="true"
                              width={1024}
                              height={1536}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover object-top"
                            />
                          ) : (
                            <span className="hud-label text-[0.5rem]">N/A</span>
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs tracking-[0.16em] text-foreground">
                            {m.callsign}
                          </span>
                          <span className="hud-label block truncate text-[0.55rem]">
                            {CREW_ROLES.find((r) => r.id === m.roleId)?.code}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <OniFooter />
    </div>
  );
}
