import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { ONI_DESTINATIONS, CLAN_NAME } from "@/lib/oni-nav";
import { OniMark } from "./OniMark";

export function OniHudNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const primary = ONI_DESTINATIONS.slice(0, 6);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled
            ? "border-b border-border bg-ink/80 backdrop-blur-xl"
            : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto grid max-w-[110rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-7 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:py-4">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-3"
            aria-label={`${CLAN_NAME} — нүүр хуудас`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center border border-crimson/45 bg-crimson/10 text-crimson clip-notch">
              <OniMark className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-cinema text-lg tracking-[0.16em] text-foreground sm:text-xl">
                ONI HUB
              </span>
              <span className="hud-label block truncate text-[0.5rem] sm:text-[0.55rem]">
                {CLAN_NAME}
              </span>
            </span>
          </Link>

          <nav aria-label="Үндсэн цэс" className="hidden justify-center lg:flex">
            <ul className="flex items-center gap-1">
              {primary.map((d) => (
                <li key={d.to}>
                  <Link
                    to={d.to}
                    activeOptions={{ exact: d.to === "/" }}
                    activeProps={{ "data-on": "true" }}
                    className="group relative block px-3.5 py-2 transition-colors duration-300 data-[on=true]:text-foreground"
                  >
                    <span className="block text-[0.7rem] font-medium tracking-[0.22em] text-muted-foreground transition-colors duration-300 group-hover:text-foreground group-data-[on=true]:text-foreground">
                      {d.label}
                    </span>
                    <span className="absolute inset-x-3.5 bottom-1 h-px origin-left scale-x-0 bg-crimson transition-transform duration-500 group-hover:scale-x-100 group-data-[on=true]:scale-x-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <Link
              to="/join"
              className="hidden items-center gap-2 border border-crimson/50 bg-crimson/12 px-4 py-2.5 text-[0.65rem] font-semibold tracking-[0.24em] text-foreground transition-all duration-300 clip-notch hover:bg-crimson/25 sm:inline-flex"
            >
              НЭГДЭХ
              <span className="h-1.5 w-1.5 bg-crimson animate-pulse-soft" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Цэс нээх"
              className="grid h-10 w-10 place-items-center border border-border text-foreground transition-colors clip-notch hover:border-crimson/60 hover:text-crimson lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Бүх хэсэг"
              className="hidden h-10 items-center gap-2 border border-border px-4 text-[0.6rem] tracking-[0.24em] text-muted-foreground transition-colors clip-notch hover:border-crimson/60 hover:text-foreground lg:inline-flex"
            >
              БҮГД
            </button>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-crimson/35 to-transparent" />
      </header>

      {/* Full-screen sector index */}
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-400 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!open}
      >
        <div
          className="absolute inset-0 bg-ink/94 backdrop-blur-2xl"
          onClick={() => setOpen(false)}
        />
        <div className="absolute inset-0 scanline-veil opacity-40" />
        <div className="relative flex h-full flex-col overflow-y-auto px-5 pb-12 pt-5 sm:px-10">
          <div className="flex items-center justify-between">
            <span className="hud-label">ONI CITY / SECTOR INDEX</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Цэс хаах"
              className="grid h-10 w-10 place-items-center border border-border text-foreground transition-colors clip-notch hover:border-crimson/60 hover:text-crimson"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav aria-label="Бүх хэсэг" className="mt-8 sm:mt-12">
            <ul className="mx-auto grid max-w-5xl gap-px bg-border sm:grid-cols-2">
              {ONI_DESTINATIONS.map((d) => (
                <li key={d.to} className="bg-ink">
                  <Link
                    to={d.to}
                    onClick={() => setOpen(false)}
                    className="group flex items-center gap-4 px-4 py-5 transition-colors duration-300 hover:bg-crimson/10 sm:px-6"
                  >
                    <span className="hud-label shrink-0 text-crimson/80">{d.index}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-cinema text-2xl text-foreground transition-transform duration-500 group-hover:translate-x-1 sm:text-3xl">
                        {d.label}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {d.desc}
                      </span>
                    </span>
                    <span className="hud-label shrink-0">{d.code}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}
