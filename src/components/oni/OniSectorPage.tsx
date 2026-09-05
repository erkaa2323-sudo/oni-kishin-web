import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { OniHudNav } from "./OniHudNav";

/**
 * Placeholder sector shell. Each destination gets a polished holding screen
 * until its database-backed module is migrated in.
 */
export function OniSectorPage({
  index,
  code,
  title,
  description,
}: {
  index: string;
  code: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative min-h-screen bg-ink">
      <OniHudNav />
      <div className="pointer-events-none absolute inset-0 scanline-veil opacity-30" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--gradient-vignette)" }}
      />
      <main className="relative mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-5 py-32 sm:px-8">
        <span className="hud-label hud-rule block pl-11 text-crimson/85">
          SECTOR {index} / {code}
        </span>
        <h1 className="mt-6 text-cinema text-5xl text-foreground sm:text-7xl">{title}</h1>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {description}
        </p>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground/80">
          Энэ хэсэг бэлтгэгдэж байна. Одоогийн өгөгдөл шилжүүлэгдсэний дараа нээгдэнэ.
        </p>
        <Link
          to="/"
          className="mt-10 inline-flex w-fit items-center gap-3 border border-border px-5 py-3 text-[0.65rem] tracking-[0.24em] text-foreground transition-colors clip-notch hover:border-crimson/60 hover:bg-crimson/10"
        >
          <ArrowLeft className="h-4 w-4" />
          НҮҮР ХУУДАС
        </Link>
      </main>
    </div>
  );
}
