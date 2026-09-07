import { useRef, useState } from "react";
import { Camera, Download, ImagePlus, RefreshCw, SendToBack, Sparkles, X } from "lucide-react";
import { firebaseAuth } from "@/integrations/firebase/client";
import { oniCreatorGenerate } from "@/lib/oni-creator.functions";
import { submitCreatorPublishRequest } from "@/data/creator-publish";

export type CreatorPreset = "profile" | "garage" | "instagram" | "meet" | "crew";
const PRESETS: Array<{ id: CreatorPreset; label: string; size: string; copy: string }> = [
  { id: "profile", label: "PROFILE CARD", size: "1:1", copy: "Гишүүний cinematic profile card" },
  { id: "garage", label: "GARAGE COVER", size: "16:9", copy: "Машины garage hero cover" },
  { id: "instagram", label: "INSTAGRAM", size: "4:5", copy: "Social feed poster" },
  { id: "meet", label: "MEET POSTER", size: "4:5", copy: "Meet / event announcement" },
  { id: "crew", label: "CREW BANNER", size: "16:9", copy: "Crew cinematic banner" },
];

async function resizeDataUrl(source: string, max: number, quality: number): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image(); el.onload = () => resolve(el); el.onerror = reject; el.crossOrigin = "anonymous"; el.src = source;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function compressImage(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(file);
  });
  return resizeDataUrl(raw, 1600, .86);
}

async function galleryAsset(source: string): Promise<string> {
  let quality = .82;
  for (const max of [1280, 1120, 960]) {
    const data = await resizeDataUrl(source, max, quality);
    if (data.length <= 880_000) return data;
    quality -= .08;
  }
  throw new Error("asset_too_large");
}

export function OniCreatorStudio({ open, onClose, onAskShizuki }: { open: boolean; onClose: () => void; onAskShizuki: (text: string) => void }) {
  const [preset,setPreset]=useState<CreatorPreset>("profile"),[nickname,setNickname]=useState(""),[cpmId,setCpmId]=useState(""),[note,setNote]=useState(""),[source,setSource]=useState<string|null>(null),[result,setResult]=useState<string|null>(null),[busy,setBusy]=useState(false),[publishing,setPublishing]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[fileName,setFileName]=useState("");
  const inputRef=useRef<HTMLInputElement|null>(null);
  if(!open)return null;

  const selectFile=async(file?:File)=>{
    if(!file||!file.type.startsWith("image/"))return;
    if(file.size>12*1024*1024){setError("Зураг 12MB-аас их байна.");return}
    setBusy(true);setError("");setNotice("");
    try{setSource(await compressImage(file));setResult(null);setFileName(file.name)}catch{setError("Зургийг бэлтгэж чадсангүй.")}finally{setBusy(false)}
  };

  const generate=async()=>{
    if(!source||busy)return;
    const user=firebaseAuth.currentUser;
    if(!user){setError("Creator ашиглахын тулд ONI member account-аараа нэвтэрнэ үү.");return}
    setBusy(true);setError("");setNotice("");
    try{
      const idToken=await user.getIdToken();
      const r=await oniCreatorGenerate({data:{idToken,sourceDataUrl:source,preset,nickname:nickname.trim(),cpmId:cpmId.trim(),note:note.trim()}});
      if(!r.ok){setError(r.message);return}
      setResult(r.imageUrl);
      setNotice("Asset бэлэн боллоо. Download хийж эсвэл Gallery approval-д илгээж болно.");
      if(r.text)onAskShizuki(`Creator дууслаа. ${r.text}`);
    }catch{setError("Creator түр алдаа гаргалаа.")}finally{setBusy(false)}
  };

  const download=()=>{
    if(!result)return;
    const a=document.createElement("a");a.href=result;a.download=`oni-${preset}-${nickname||"member"}.jpg`;document.body.appendChild(a);a.click();a.remove();
  };

  const publish=async()=>{
    if(!result||publishing)return;
    setPublishing(true);setError("");setNotice("");
    try{
      const optimized=await galleryAsset(result);
      const label=PRESETS.find(p=>p.id===preset)?.label??"CREATOR";
      const r=await submitCreatorPublishRequest({nickname,cpmId,preset,title:`${nickname.trim()||"ONI MEMBER"} · ${label}`,image:optimized});
      if(!r.ok){setError(r.message);return}
      setNotice("Gallery publish хүсэлт илгээгдлээ. Admin баталсны дараа Gallery-д автоматаар орно.");
      onAskShizuki("Creator asset Gallery approval-д амжилттай илгээгдлээ. ✨");
    }catch{setError("Gallery-д бэлтгэхэд алдаа гарлаа. Дахин оролдоно уу.")}finally{setPublishing(false)}
  };

  const reset=()=>{setNickname("");setCpmId("");setNote("");setPreset("profile");setResult(null);setError("");setNotice("")};

  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/80 backdrop-blur-md sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="ONI Shizuki Creator Studio"><section className="flex max-h-[94svh] w-full max-w-5xl flex-col overflow-hidden border border-crimson/35 bg-ink shadow-2xl sm:clip-notch"><header className="flex shrink-0 items-center gap-3 border-b border-border bg-midnight/70 px-4 py-3"><span className="grid h-10 w-10 place-items-center border border-crimson/45 bg-crimson/12 text-crimson clip-notch"><Sparkles className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="hud-label block text-crimson/85">ONI SHIZUKI / CREATE</span><strong className="block truncate text-cinema text-xl text-foreground">AI CREATOR STUDIO</strong></span><button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center border border-border text-foreground clip-notch" aria-label="Хаах"><X className="h-4 w-4"/></button></header><div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1.05fr_.95fr]"><div className="flex min-h-[22rem] flex-col border-b border-border p-4 lg:border-b-0 lg:border-r"><div className="flex items-center justify-between"><span className="hud-label">01 / VEHICLE SOURCE</span><span className="hud-label text-crimson/75">≤12MB</span></div><button type="button" onClick={()=>inputRef.current?.click()} className="relative mt-3 flex min-h-[18rem] flex-1 items-center justify-center overflow-hidden border border-dashed border-crimson/35 bg-midnight/35 clip-notch">{(result||source)?<img src={result||source||""} alt="Creator preview" className="absolute inset-0 h-full w-full object-contain"/>:<span className="flex flex-col items-center gap-3 px-8 text-center"><ImagePlus className="h-8 w-8 text-crimson"/><strong className="text-cinema text-2xl text-foreground">МАШИНЫ SCREENSHOT</strong><span className="text-xs text-muted-foreground">CPM screenshot-оо оруул.</span></span>}</button><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>void selectFile(e.target.files?.[0])}/><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={()=>inputRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 border border-border px-4 text-xs text-foreground clip-notch"><Camera className="h-4 w-4"/>ЗУРАГ</button>{result&&<><button type="button" onClick={download} className="inline-flex min-h-11 items-center gap-2 border border-crimson/50 bg-crimson/12 px-4 text-xs text-foreground clip-notch"><Download className="h-4 w-4"/>DOWNLOAD</button><button type="button" onClick={()=>void publish()} disabled={publishing} className="inline-flex min-h-11 items-center gap-2 border border-emerald-500/50 bg-emerald-500/10 px-4 text-xs text-emerald-200 clip-notch disabled:opacity-50"><SendToBack className="h-4 w-4"/>{publishing?"ИЛГЭЭЖ БАЙНА…":"GALLERY-Д ИЛГЭЭХ"}</button></>}<span className="min-w-0 truncate self-center text-xs text-muted-foreground">{fileName}</span></div></div><div className="flex min-h-0 flex-col p-4 lg:overflow-y-auto"><span className="hud-label">02 / ASSET TYPE</span><div className="mt-3 grid grid-cols-2 gap-2">{PRESETS.map(item=><button key={item.id} type="button" onClick={()=>setPreset(item.id)} aria-pressed={preset===item.id} className={`min-h-[72px] border p-3 text-left clip-notch ${preset===item.id?"border-crimson/65 bg-crimson/14":"border-border bg-midnight/30"}`}><span className="block text-[.68rem] font-semibold tracking-[.13em] text-foreground">{item.label}</span><span className="hud-label mt-1 block text-[.48rem]">{item.size} · {item.copy}</span></button>)}</div><span className="hud-label mt-5">03 / MEMBER DATA</span><div className="mt-3 grid gap-2 sm:grid-cols-2"><input value={nickname} onChange={e=>setNickname(e.target.value.slice(0,40))} placeholder="Nickname" className="min-h-11 border border-border bg-midnight/45 px-3 text-base text-foreground outline-none clip-notch"/><input value={cpmId} onChange={e=>setCpmId(e.target.value.slice(0,40))} placeholder="CPM ID" className="min-h-11 border border-border bg-midnight/45 px-3 text-base text-foreground outline-none clip-notch"/></div><textarea value={note} onChange={e=>setNote(e.target.value.slice(0,500))} placeholder="Mood, text, meet date…" rows={3} className="mt-2 min-h-[88px] resize-none border border-border bg-midnight/45 px-3 py-3 text-base text-foreground outline-none clip-notch"/>{error&&<p className="mt-3 border border-crimson/40 bg-crimson/10 p-3 text-xs text-foreground clip-notch">{error}</p>}{notice&&<p className="mt-3 border border-emerald-500/30 bg-emerald-500/8 p-3 text-xs text-emerald-200 clip-notch">{notice}</p>}<div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={()=>void generate()} disabled={!source||busy} className="inline-flex min-h-12 items-center justify-center gap-2 bg-crimson px-4 text-xs font-semibold tracking-[.14em] text-white clip-notch disabled:opacity-40"><Sparkles className="h-4 w-4"/>{busy?"CREATING…":result?"REGENERATE":"GENERATE"}</button><button type="button" onClick={reset} className="inline-flex min-h-12 items-center justify-center gap-2 border border-border px-4 text-xs tracking-[.14em] text-foreground clip-notch"><RefreshCw className="h-4 w-4"/>RESET</button></div><p className="mt-3 text-[.65rem] leading-relaxed text-muted-foreground">Generate → Preview → Regenerate → Download → Gallery approval гэсэн бүтэн урсгалтай. Gallery-д зөвхөн admin баталсан asset нийтлэгдэнэ.</p></div></div></section></div>;
}
