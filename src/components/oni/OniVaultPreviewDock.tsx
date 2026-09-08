import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { ONI_VAULT } from "@/lib/oni-progression";
import { OniCosmeticFx } from "./OniCosmeticFx";

export function OniVaultPreviewDock() {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("aura-red-moon");
  const selected = ONI_VAULT.find((item) => item.id === selectedId) ?? ONI_VAULT[0]!;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-3 z-[70] inline-flex min-h-11 items-center gap-2 border border-crimson/55 bg-ink/90 px-3 text-[0.58rem] font-semibold tracking-[0.16em] text-foreground shadow-2xl backdrop-blur-xl clip-notch sm:bottom-6 sm:right-6"
        aria-label="Vault effect live preview нээх"
      >
        <Sparkles className="h-4 w-4 text-crimson" />
        FX PREVIEW
      </button>
    );
  }

  return (
    <aside className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-3 z-[70] w-[min(92vw,28rem)] overflow-hidden border border-crimson/45 bg-ink/95 shadow-2xl backdrop-blur-xl sm:bottom-6 sm:right-6">
      <header className="flex items-center gap-3 border-b border-white/10 px-3 py-2.5">
        <Sparkles className="h-4 w-4 text-crimson" />
        <div className="min-w-0 flex-1">
          <p className="hud-label text-crimson">ONI VAULT / LIVE GPU</p>
          <p className="truncate text-xs text-white/50">Авахаасаа өмнө effect-ээ бодитоор үз</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="grid h-10 w-10 shrink-0 place-items-center border border-white/10 text-white/70"
          aria-label="Preview хаах"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <OniCosmeticFx
        effectIds={[selected.id]}
        entranceKey={selected.id}
        className="min-h-56"
        preview
      >
        <div className="relative flex min-h-56 flex-col justify-between bg-black/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[0.58rem] tracking-[0.22em] text-white/55">LIVE PREVIEW</span>
            <span className="text-[0.58rem] tracking-[0.18em] text-crimson">
              {selected.rarity}
            </span>
          </div>
          <div className="relative mx-auto grid h-20 w-20 place-items-center border border-white/15 bg-black/35 text-cinema text-3xl text-white shadow-2xl clip-notch">
            鬼
          </div>
          <div>
            <h3 className="text-cinema text-2xl text-white">{selected.name}</h3>
            <p className="mt-1 text-xs leading-5 text-white/55">{selected.description}</p>
            <p className="mt-2 text-[0.62rem] tracking-[0.12em] text-white/45">
              🪙 {selected.price.toLocaleString()} · {selected.minXp.toLocaleString()} XP
            </p>
          </div>
        </div>
      </OniCosmeticFx>

      <div className="flex gap-2 overflow-x-auto border-t border-white/10 p-2">
        {ONI_VAULT.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelectedId(item.id)}
            aria-pressed={selected.id === item.id}
            className={`min-h-10 shrink-0 border px-3 text-[0.55rem] tracking-[0.12em] ${
              selected.id === item.id
                ? "border-crimson/70 bg-crimson/15 text-white"
                : "border-white/10 bg-white/[0.025] text-white/50"
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>
    </aside>
  );
}
