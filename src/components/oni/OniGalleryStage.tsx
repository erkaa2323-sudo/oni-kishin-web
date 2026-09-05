import { useEffect, useMemo, useState } from "react";
import { Maximize2, X } from "lucide-react";

import oniCity from "@/assets/oni-city-bg.jpg";
import {
  fetchGallery,
  GALLERY_CATEGORIES,
  type GalleryCategory,
  type GalleryItem,
} from "@/data/gallery";
import { OniFooter } from "./OniFooter";
import { OniHudNav } from "./OniHudNav";

type Filter = GalleryCategory | "all";

const categoryLabel = (category: GalleryCategory): string =>
  GALLERY_CATEGORIES.find((item) => item.id === category)?.code ?? "ONI";

export function OniGalleryStage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<GalleryItem | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let alive = true;
    void fetchGallery().then((result) => {
      if (!alive) return;
      if (result.status === "error") {
        setLoadError(result.reason);
        setLoadState("error");
        return;
      }
      setItems(result.rows);
      setLoadState("ready");
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", close);
    };
  }, [selected]);

  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.category === filter)),
    [filter, items],
  );

  return (
    <div className="relative min-h-screen bg-ink">
      <OniHudNav />
      <main>
        <section
          className="relative isolate min-h-screen overflow-hidden"
          aria-labelledby="gallery-title"
        >
          <div className="pointer-events-none absolute inset-0">
            <img
              src={oniCity}
              alt=""
              aria-hidden="true"
              width={1920}
              height={1080}
              fetchPriority="high"
              className="h-full w-full scale-105 object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/85 to-ink" />
            <div className="absolute inset-0 scanline-veil opacity-25" />
          </div>

          <div className="relative mx-auto max-w-[110rem] px-5 pb-20 pt-28 sm:px-8 sm:pt-32">
            <header className="grid gap-5 border-b border-border pb-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="min-w-0">
                <span className="hud-label hud-rule block pl-11 text-crimson/85">
                  SECTOR 06 / VISUAL ARCHIVE
                </span>
                <h1
                  id="gallery-title"
                  className="mt-3 text-cinema text-5xl text-foreground sm:text-7xl"
                >
                  ГАЛЕРЕЙ
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Oni And Kishin кланы уулзалт, машин болон шөнийн дурсамжууд.
                </p>
              </div>
              <span className="hud-label">
                {loadState === "ready" ? `${visible.length} / ${items.length} КАДР` : "SYNC"}
              </span>
            </header>

            <div
              className="-mx-5 mt-6 flex snap-x gap-2 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0"
              role="tablist"
              aria-label="Зургийн ангилал"
            >
              {[{ id: "all" as const, label: "БҮГД", code: "ALL" }, ...GALLERY_CATEGORIES].map(
                (category) => {
                  const active = filter === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilter(category.id)}
                      className={`shrink-0 snap-start border px-4 py-3 text-[0.62rem] tracking-[0.24em] transition-colors clip-notch ${active ? "border-crimson/70 bg-crimson/20 text-foreground" : "border-border bg-ink/60 text-muted-foreground hover:border-crimson/50 hover:text-foreground"}`}
                    >
                      {category.label}
                    </button>
                  );
                },
              )}
            </div>

            {loadState !== "ready" || visible.length === 0 ? (
              <div className="mt-10 grid min-h-64 place-items-center border border-dashed border-border bg-ink/45 p-8 text-center backdrop-blur-md">
                <div>
                  <span className="hud-label block text-crimson/80">
                    {loadState === "loading"
                      ? "GALLERY SYNC"
                      : loadState === "error"
                        ? "GALLERY UNAVAILABLE"
                        : "NO SIGNAL"}
                  </span>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {loadState === "loading"
                      ? "Галерейн зургууд ачаалж байна…"
                      : loadState === "error"
                        ? loadError
                        : "Энэ ангилалд зураг алга."}
                  </p>
                </div>
              </div>
            ) : null}

            {loadState === "ready" && visible.length > 0 ? (
              <ul
                className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                aria-label="ONI галерейн зургууд"
              >
                {visible.map((item, index) => (
                  <li
                    key={item.id}
                    className={index === 0 && filter === "all" ? "sm:col-span-2" : ""}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(item)}
                      className="group relative block w-full overflow-hidden border border-border bg-midnight text-left transition-colors duration-500 hover:border-crimson/60"
                      aria-label={`${item.title} зургийг томоор үзэх`}
                    >
                      <span
                        className={`block overflow-hidden ${index === 0 && filter === "all" ? "aspect-[16/9]" : "aspect-[4/3]"}`}
                      >
                        <img
                          src={item.image}
                          alt={`${item.title} — ${item.owner}`}
                          loading={index < 3 ? "eager" : "lazy"}
                          decoding="async"
                          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035] group-hover:brightness-110"
                        />
                      </span>
                      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent opacity-90" />
                      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 sm:p-5">
                        <span className="min-w-0">
                          <span className="hud-label block text-crimson/90">
                            {categoryLabel(item.category)}
                          </span>
                          <span className="mt-1 block truncate text-cinema text-2xl text-foreground">
                            {item.title}
                          </span>
                          <span className="mt-1 block truncate text-xs tracking-[0.12em] text-muted-foreground">
                            {item.owner}
                            {item.build ? ` · ${item.build}` : ""}
                          </span>
                        </span>
                        <Maximize2 className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-crimson" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      </main>
      <OniFooter />

      {selected ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-ink/95 p-3 backdrop-blur-xl sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={selected.title}
          onClick={() => setSelected(null)}
        >
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Зураг хаах"
            className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 grid h-11 w-11 place-items-center border border-border bg-ink/80 text-foreground clip-notch hover:border-crimson/60 hover:text-crimson"
          >
            <X className="h-5 w-5" />
          </button>
          <figure
            className="flex max-h-full max-w-6xl flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={selected.image}
              alt={`${selected.title} — ${selected.owner}`}
              className="max-h-[78svh] w-auto max-w-full object-contain shadow-2xl"
            />
            <figcaption className="border-x border-b border-border bg-ink/90 p-4">
              <span className="hud-label text-crimson/85">{categoryLabel(selected.category)}</span>
              <h2 className="mt-1 text-cinema text-2xl text-foreground sm:text-3xl">
                {selected.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selected.owner}
                {selected.build ? ` · ${selected.build}` : ""}
              </p>
            </figcaption>
          </figure>
        </div>
      ) : null}
    </div>
  );
}
