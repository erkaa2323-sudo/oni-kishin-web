import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { ONI_DESTINATIONS } from "@/lib/oni-nav";

/** Sector directory — the game-world way into every other destination. */
export function OniSectors() {
  const sectors = ONI_DESTINATIONS.filter((d) => d.to !== "/");

  return (
    <section
      aria-labelledby="oni-sectors-title"
      className="relative border-t border-border bg-ink py-20 sm:py-28"
    >
      <div className="pointer-events-none absolute inset-0 scanline-veil opacity-20" />
      <div className="relative mx-auto max-w-[110rem] px-5 sm:px-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
          <div className="min-w-0">
            <span className="hud-label hud-rule block pl-11 text-crimson/85">
              DIRECTORY / ХЭСГҮҮД
            </span>
            <h2
              id="oni-sectors-title"
              className="mt-4 text-cinema text-4xl text-foreground sm:text-6xl"
            >
              ХОТЫН ХЭСГҮҮД
            </h2>
          </div>
          <span className="hud-label shrink-0 hidden sm:block">{sectors.length} SECTORS</span>
        </div>

        <ul className="mt-12 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {sectors.map((d) => (
            <li key={d.to} className="bg-ink">
              <Link
                to={d.to}
                className="group relative flex h-full flex-col justify-between gap-10 overflow-hidden p-6 transition-colors duration-500 hover:bg-midnight/60 sm:p-8"
              >
                <span
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background:
                      "radial-gradient(80% 70% at 20% 100%, oklch(0.55 0.215 25.5 / 0.16), transparent 70%)",
                  }}
                />
                <div className="relative flex items-start justify-between gap-4">
                  <span className="hud-label text-crimson/80">{d.index}</span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-crimson" />
                </div>
                <div className="relative min-w-0">
                  <h3 className="truncate text-cinema text-3xl text-foreground sm:text-4xl">
                    {d.label}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{d.desc}</p>
                  <span className="hud-label mt-4 block">{d.code}</span>
                  <span className="mt-4 block h-px w-full origin-left scale-x-0 bg-crimson transition-transform duration-700 group-hover:scale-x-100" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
