import { useEffect, useMemo, useState } from "react";

import garageBay from "@/assets/garage/garage-bay.jpg";
import {
  BUILD_STAGE_LABEL,
  VEHICLE_CATEGORIES,
  fetchVehicles,
  type Vehicle,
  type VehicleCategoryId,
} from "@/data/garage";
import { OniHudNav } from "./OniHudNav";
import { OniFooter } from "./OniFooter";

type Filter = VehicleCategoryId | "all";

export function OniGarageStage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    let alive = true;
    void fetchVehicles().then((r) => {
      if (!alive) return;
      if (r.status === "error") {
        setLoadState("error");
        setLoadError(r.reason);
        return;
      }
      setVehicles(r.rows);
      setActiveId(r.rows[0]?.id ?? "");
      setLoadState("ready");
    });
    return () => {
      alive = false;
    };
  }, []);

  const visible = useMemo(
    () => (filter === "all" ? vehicles : vehicles.filter((v) => v.categoryId === filter)),
    [vehicles, filter],
  );
  const active = vehicles.find((v) => v.id === activeId) ?? visible[0] ?? vehicles[0];

  const selectFilter = (f: Filter) => {
    setFilter(f);
    const next = f === "all" ? vehicles : vehicles.filter((v) => v.categoryId === f);
    if (next.length && !next.some((v) => v.id === activeId)) setActiveId(next[0]!.id);
  };

  return (
    <div className="relative min-h-screen bg-ink">
      <OniHudNav />

      <main className="relative">
        <section className="relative isolate overflow-hidden" aria-labelledby="garage-title">
          <div className="absolute inset-0">
            <img
              src={garageBay}
              alt=""
              aria-hidden="true"
              width={1920}
              height={1080}
              fetchPriority="high"
              decoding="async"
              className="h-full w-full scale-105 object-cover opacity-60"
            />
          </div>
          <div
            className="pointer-events-none absolute inset-x-[-10%] bottom-0 top-[20%] animate-haze blur-3xl"
            style={{
              background:
                "radial-gradient(45% 50% at 50% 70%, oklch(0.55 0.215 25.5 / 0.16), transparent 70%)",
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
                  SECTOR 02 / GARAGE
                </span>
                <h1
                  id="garage-title"
                  className="mt-3 text-cinema text-4xl text-foreground sm:text-6xl"
                >
                  ГАРАЖ
                </h1>
              </div>
              <span className="hud-label hidden shrink-0 sm:block">
                {loadState === "ready" ? `${visible.length} / ${vehicles.length} НЭГЖ` : "—"}
              </span>
            </header>

            <div
              className="-mx-5 mt-6 flex snap-x gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
              role="tablist"
              aria-label="Ангиллаар шүүх"
            >
              {[{ id: "all" as const, label: "БҮГД", code: "ALL" }, ...VEHICLE_CATEGORIES].map(
                (c) => {
                  const on = filter === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => selectFilter(c.id as Filter)}
                      className={`shrink-0 snap-start border px-4 py-3 text-[0.62rem] tracking-[0.24em] transition-colors duration-300 clip-notch ${
                        on
                          ? "border-crimson/70 bg-crimson/20 text-foreground"
                          : "border-border bg-ink/50 text-muted-foreground backdrop-blur-md hover:border-crimson/50 hover:text-foreground"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                },
              )}
            </div>

            {loadState !== "ready" || vehicles.length === 0 ? (
              <div className="mt-8 flex flex-1 items-center justify-center">
                <div className="max-w-md border border-dashed border-border bg-ink/60 p-8 text-center backdrop-blur-md">
                  <span className="hud-label block text-crimson/80">
                    {loadState === "loading"
                      ? "GARAGE SYNC"
                      : loadState === "error"
                        ? "GARAGE UNAVAILABLE"
                        : "GARAGE EMPTY"}
                  </span>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {loadState === "loading"
                      ? "Гаражийн бүртгэл ачаалж байна…"
                      : loadState === "error"
                        ? loadError
                        : "Нийтлэгдсэн автомашины бичлэг одоогоор алга. Админ бүртгэл нэмсний дараа энд харагдана."}
                  </p>
                </div>
              </div>
            ) : null}

            {/* showcase */}
            <div
              className={`relative mt-2 flex-1 ${loadState === "ready" && vehicles.length ? "flex" : "hidden"} flex-col justify-center gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-center lg:gap-10`}
            >
              <div className="min-w-0">
                {active ? (
                  <>
                    <div className="relative flex items-center justify-center">
                      <div
                        className="pointer-events-none absolute inset-x-[8%] bottom-[10%] top-[20%] blur-[70px]"
                        style={{
                          background:
                            "radial-gradient(50% 50% at 50% 60%, oklch(0.55 0.215 25.5 / 0.28), transparent 72%)",
                        }}
                      />
                      {active.image ? (
                        <div key={active.id} className="relative w-full animate-rise">
                          <img
                            src={active.image}
                            alt={`${active.name} — ${active.ownerCallsign}`}
                            width={1536}
                            height={1024}
                            decoding="async"
                            className="w-full animate-breathe object-contain drop-shadow-[0_40px_60px_rgba(0,0,0,0.75)]"
                          />
                          <div
                            className="pointer-events-none absolute inset-x-[6%] top-[86%] h-[36%] scale-y-[-1] opacity-20 blur-[3px]"
                            style={{
                              backgroundImage: `url(${active.image})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center top",
                              maskImage:
                                "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent 70%)",
                              WebkitMaskImage:
                                "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent 70%)",
                            }}
                          />
                        </div>
                      ) : (
                        <div className="grid h-48 w-full place-items-center border border-dashed border-border">
                          <span className="hud-label">ЗУРАГ БАЙХГҮЙ</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <div className="min-w-0">
                        <span className="hud-label block">
                          {VEHICLE_CATEGORIES.find((c) => c.id === active.categoryId)?.code}
                          {active.buildStage ? ` — ${BUILD_STAGE_LABEL[active.buildStage]}` : ""}
                        </span>
                        <h2 className="mt-2 flex min-w-0 items-baseline gap-3 text-cinema text-4xl text-foreground sm:text-5xl">
                          <span className="truncate">{active.name}</span>
                          {active.kana ? (
                            <span className="shrink-0 text-base text-crimson/70">
                              {active.kana}
                            </span>
                          ) : null}
                        </h2>
                        <p className="mt-2 text-sm tracking-[0.14em] text-crimson/90">
                          ЭЗЭН — {active.ownerCallsign}
                        </p>
                        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                          {active.summary}
                        </p>
                      </div>

                      <dl className="grid gap-px self-start overflow-hidden border border-border bg-border/60 sm:grid-cols-2">
                        {active.specs.map((s) => (
                          <div
                            key={s.label}
                            className="min-w-0 bg-ink/70 px-4 py-3 backdrop-blur-md"
                          >
                            <dt className="hud-label truncate">{s.label}</dt>
                            <dd className="mt-1 truncate text-sm text-foreground">{s.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </>
                ) : null}
              </div>

              {/* selector: horizontal on mobile, vertical on desktop */}
              <div className="min-w-0">
                <span className="hud-label block">ЦУГЛУУЛГА</span>
                <ul
                  className="-mx-5 mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
                  aria-label="Автомашинууд"
                >
                  {visible.map((v) => {
                    const on = v.id === active?.id;
                    return (
                      <li key={v.id} className="shrink-0 snap-start lg:w-full">
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => setActiveId(v.id)}
                          className={`flex w-44 items-center gap-3 border px-3 py-3 text-left transition-colors duration-300 clip-notch lg:w-full ${
                            on
                              ? "border-crimson/70 bg-crimson/15"
                              : "border-border bg-ink/60 backdrop-blur-md hover:border-crimson/50"
                          }`}
                        >
                          <span className="grid h-10 w-14 shrink-0 place-items-center overflow-hidden border border-border bg-midnight/60">
                            {v.image ? (
                              <img
                                src={v.image}
                                alt=""
                                aria-hidden="true"
                                width={1536}
                                height={1024}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="hud-label text-[0.5rem]">N/A</span>
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs tracking-[0.16em] text-foreground">
                              {v.name}
                            </span>
                            <span className="hud-label block truncate text-[0.55rem]">
                              {v.ownerCallsign}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <OniFooter />
    </div>
  );
}
