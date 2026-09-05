import { Link } from "@tanstack/react-router";

import { ONI_DESTINATIONS, CLAN_NAME } from "@/lib/oni-nav";
import { OniMark } from "./OniMark";

export function OniFooter() {
  return (
    <footer className="border-t border-border bg-ink">
      <div className="mx-auto max-w-[110rem] px-5 py-14 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center border border-crimson/45 bg-crimson/10 text-crimson clip-notch">
                <OniMark className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-cinema text-lg tracking-[0.16em] text-foreground">
                  ONI HUB V3
                </span>
                <span className="hud-label block truncate">{CLAN_NAME}</span>
              </span>
            </div>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
              Монголын CPM клан {CLAN_NAME}-ийн албан ёсны дижитал төв.
            </p>
          </div>

          <nav aria-label="Хөлийн цэс" className="min-w-0">
            <span className="hud-label block">ХЭСГҮҮД</span>
            <ul className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4 lg:grid-cols-2">
              {ONI_DESTINATIONS.map((d) => (
                <li key={d.to}>
                  <Link
                    to={d.to}
                    className="text-sm text-muted-foreground transition-colors hover:text-crimson"
                  >
                    {d.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <span className="hud-label">ONI HUB V3 — ONI CITY</span>
          <span className="hud-label">{CLAN_NAME}</span>
        </div>
      </div>
    </footer>
  );
}
