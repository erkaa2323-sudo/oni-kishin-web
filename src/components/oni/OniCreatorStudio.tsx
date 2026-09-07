import { useEffect, useRef, useState } from "react";
import { Camera, Download, ImagePlus, RefreshCw, Sparkles, X } from "lucide-react";

export type CreatorPreset = "profile" | "garage" | "instagram" | "meet" | "crew";

const PRESETS: Array<{ id: CreatorPreset; label: string; size: string; copy: string }> = [
  { id: "profile", label: "PROFILE CARD", size: "1:1", copy: "Гишүүний cinematic profile card" },
  { id: "garage", label: "GARAGE COVER", size: "16:9", copy: "Машины garage hero cover" },
  { id: "instagram", label: "INSTAGRAM", size: "4:5", copy: "Social feed poster" },
  { id: "meet", label: "MEET POSTER", size: "4:5", copy: "Meet / event announcement" },
  { id: "crew", label: "CREW BANNER", size: "16:9", copy: "Crew cinematic banner" },
];

function buildBrief(preset: CreatorPreset, nickname: string, cpmId: string, note: string) {
  const label = PRESETS.find((item) => item.id === preset)?.label ?? preset;
  return `ONI SHIZUKI CREATOR — ${label}. Subject: uploaded CPM vehicle screenshot. Member: ${nickname || "ONI MEMBER"}${cpmId ? ` / CPM ${cpmId}` : ""}. Preserve the vehicle identity, paint, decals and proportions. ONI And Kishin visual system: midnight-black cinematic world, controlled crimson light, premium Japanese-anime motorsport editorial energy, strong mobile-safe typography area, no fake logos, no invented sponsor marks. ${note.trim() || "Keep the car as the visual hero and leave clean safe areas for real text."}`;
}

export function OniCreatorStudio({ open, onClose, onAskShizuki }: { open: boolean; onClose: () => void; onAskShizuki: (text: string) => void }) {
  const [preset, setPreset] = useState<CreatorPreset>("profile");
  const [nickname, setNickname] = useState("");
  const [cpmId, setCpmId] = useState("");
  const [note, setNote] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => { if (source?.startsWith("blob:")) URL.revokeObjectURL(source); }, [source]);
  if (!open) return null;

  const selectFile = (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 12 * 1024 * 1024) { onAskShizuki("Creator Studio: зураг 12MB-аас том байна. Жижиг screenshot сонгоход туслаач."); return; }
    if (source?.startsWith("blob:")) URL.revokeObjectURL(source);
    setSource(URL.createObjectURL(file));
    setFileName(file.name);
  };
  const brief = buildBrief(preset, nickname.trim(), cpmId.trim(), note);
  const ask = () => onAskShizuki(`${brief}\n\nЭнэ asset-д зориулсан богино creative direction, headline болон production prompt бэлд.`);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/80 p-0 backdrop-blur-md sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="ONI Shizuki Creator Studio">
      <section className="flex max-h-[94svh] w-full max-w-5xl flex-col overflow-hidden border border-crimson/35 bg-ink shadow-2xl sm:clip-notch">
        <header className="flex shrink-0 items-center gap-3 border-b border-border bg-midnight/70 px-4 py-3 sm:px-5">
          <span className="grid h-10 w-10 place-items-center border border-crimson/45 bg-crimson/12 text-crimson clip-notch"><Sparkles className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="hud-label block text-crimson/85">ONI SHIZUKI / CREATE</span><strong className="block truncate text-cinema text-xl text-foreground">AI CREATOR STUDIO</strong></span>
          <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center border border-border text-foreground clip-notch" aria-label="Creator Studio хаах"><X className="h-4 w-4" /></button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1.05fr_.95fr] lg:overflow-hidden">
          <div className="flex min-h-[22rem] flex-col border-b border-border p-4 lg:border-b-0 lg:border-r lg:p-5">
            <div className="flex items-center justify-between gap-3"><span className="hud-label">01 / VEHICLE SOURCE</span><span className="hud-label text-crimson/75">JPG · PNG · WEBP · ≤12MB</span></div>
            <button type="button" onClick={() => inputRef.current?.click()} className="relative mt-3 flex min-h-[18rem] flex-1 items-center justify-center overflow-hidden border border-dashed border-crimson/35 bg-midnight/35 clip-notch">
              {source ? <img src={source} alt="Оруулсан машины screenshot" className="absolute inset-0 h-full w-full object-contain" /> : <span className="flex flex-col items-center gap-3 px-8 text-center"><ImagePlus className="h-8 w-8 text-crimson" /><strong className="text-cinema text-2xl text-foreground">МАШИНЫ SCREENSHOT</strong><span className="max-w-sm text-xs leading-relaxed text-muted-foreground">CPM screenshot-оо оруул. Shizuki үүнийг ONI visual system-д зориулсан creative source болгон ашиглана.</span></span>}
            </button>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => selectFile(e.target.files?.[0])} />
            <div className="mt-3 flex items-center gap-2"><button type="button" onClick={() => inputRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 border border-border px-4 text-xs text-foreground clip-notch"><Camera className="h-4 w-4" />{source ? "ЗУРАГ СОЛИХ" : "ЗУРАГ ОРУУЛАХ"}</button>{fileName ? <span className="min-w-0 truncate text-xs text-muted-foreground">{fileName}</span> : null}</div>
          </div>

          <div className="flex min-h-0 flex-col p-4 lg:overflow-y-auto lg:p-5">
            <span className="hud-label">02 / ASSET TYPE</span>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
              {PRESETS.map((item) => <button key={item.id} type="button" onClick={() => setPreset(item.id)} aria-pressed={preset === item.id} className={`min-h-[72px] border p-3 text-left transition-colors clip-notch ${preset === item.id ? "border-crimson/65 bg-crimson/14" : "border-border bg-midnight/30"}`}><span className="block text-[.68rem] font-semibold tracking-[.13em] text-foreground">{item.label}</span><span className="hud-label mt-1 block text-[.48rem]">{item.size} · {item.copy}</span></button>)}
            </div>
            <span className="hud-label mt-5">03 / MEMBER DATA</span>
            <div className="mt-3 grid gap-2 sm:grid-cols-2"><input value={nickname} onChange={(e) => setNickname(e.target.value.slice(0,40))} placeholder="Nickname / ж: KITSUNE" className="min-h-11 min-w-0 border border-border bg-midnight/45 px-3 text-base text-foreground outline-none clip-notch focus:border-crimson/60" /><input value={cpmId} onChange={(e) => setCpmId(e.target.value.slice(0,40))} placeholder="CPM ID (сонголттой)" className="min-h-11 min-w-0 border border-border bg-midnight/45 px-3 text-base text-foreground outline-none clip-notch focus:border-crimson/60" /></div>
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0,500))} placeholder="Нэмэлт хүсэлт: mood, text, meet date…" rows={3} className="mt-2 min-h-[88px] resize-none border border-border bg-midnight/45 px-3 py-3 text-base text-foreground outline-none clip-notch focus:border-crimson/60" />
            <div className="mt-4 border border-crimson/25 bg-crimson/7 p-3 clip-notch"><span className="hud-label text-crimson/85">SHIZUKI CREATIVE DIRECTOR</span><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Машины төрхийг хадгалж, ONI midnight + crimson cinematic design system, сонгосон asset ratio болон nickname-ийг нэг production brief болгон бэлдэнэ.</p></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={ask} disabled={!source} className="inline-flex min-h-12 items-center justify-center gap-2 bg-crimson px-4 text-xs font-semibold tracking-[.14em] text-white clip-notch disabled:opacity-40"><Sparkles className="h-4 w-4" />SHIZUKI-Д БЭЛДҮҮЛЭХ</button><button type="button" onClick={() => { setNickname(""); setCpmId(""); setNote(""); setPreset("profile"); }} className="inline-flex min-h-12 items-center justify-center gap-2 border border-border px-4 text-xs tracking-[.14em] text-foreground clip-notch"><RefreshCw className="h-4 w-4" />RESET</button></div>
            <div className="mt-3 flex items-start gap-2 text-[.65rem] leading-relaxed text-muted-foreground"><Download className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>V1 нь screenshot intake + 5 preset + Shizuki creative brief-ийг нэгтгэсэн. Image-generation backend холбогдоогүй үед хуурамч “generated” зураг үзүүлэхгүй.</span></div>
          </div>
        </div>
      </section>
    </div>
  );
}
