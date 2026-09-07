import { useEffect, useMemo, useState } from "react";
import { Award, Loader2, X } from "lucide-react";
import { listMemberAccounts, type MemberAccount } from "@/data/member-auth";
import { grantEventReward, type EventRewardPlacement } from "@/data/progression-admin";

export function OniEventRewardDock() {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<MemberAccount[]>([]);
  const [uid, setUid] = useState("");
  const [eventId, setEventId] = useState("");
  const [placement, setPlacement] = useState<EventRewardPlacement>("participation");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) return; void listMemberAccounts().then((rows) => { const approved = rows.filter((x) => x.status === "approved"); setMembers(approved); setUid((current) => current || approved[0]?.uid || ""); }).catch(() => setNotice("Member account ачаалж чадсангүй.")); }, [open]);
  const selected = useMemo(() => members.find((x) => x.uid === uid) ?? null, [members, uid]);
  const submit = async () => {
    if (!selected || !eventId.trim()) { setNotice("Event ID болон member сонгоно уу."); return; }
    setBusy(true); setNotice("");
    try { const reward = await grantEventReward({ uid: selected.uid, nickname: selected.nickname, eventId, placement }); setNotice(`${selected.nickname} · +${reward.xp} XP · +${reward.coin} ONI`); setEventId(""); }
    catch (error) { const code = error instanceof Error ? error.message : "failed"; setNotice(code === "already_rewarded" ? "Энэ event дээр энэ member reward авсан байна." : "Event reward олгох үед алдаа гарлаа."); }
    finally { setBusy(false); }
  };
  return <><button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-[80] inline-flex min-h-11 items-center gap-2 border border-crimson/40 bg-ink/95 px-4 text-xs font-semibold tracking-[0.14em] text-white shadow-2xl"><Award className="h-4 w-4 text-crimson"/>EVENT REWARD</button>{open?<div className="fixed inset-0 z-[95] flex items-end bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:justify-center" role="dialog" aria-modal="true"><section className="w-full max-w-lg border border-white/10 bg-ink p-5 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-[0.62rem] tracking-[0.22em] text-crimson">ONI PROGRESSION</p><h2 className="mt-1 text-xl font-semibold">EVENT REWARD</h2></div><button type="button" onClick={()=>setOpen(false)} className="p-2 text-white/60"><X className="h-5 w-5"/></button></div><div className="mt-5 space-y-4"><label className="block"><span className="text-xs text-white/45">MEMBER</span><select value={uid} onChange={(e)=>setUid(e.target.value)} className="mt-2 min-h-11 w-full border border-white/10 bg-black/30 px-3 text-base sm:text-sm">{members.map((m)=><option key={m.uid} value={m.uid}>{m.nickname} · {m.cpmId}</option>)}</select></label><label className="block"><span className="text-xs text-white/45">EVENT ID</span><input value={eventId} onChange={(e)=>setEventId(e.target.value)} placeholder="mongol-63-2026-09" className="mt-2 min-h-11 w-full border border-white/10 bg-black/30 px-3 text-base sm:text-sm"/></label><label className="block"><span className="text-xs text-white/45">RESULT</span><select value={placement} onChange={(e)=>setPlacement(e.target.value as EventRewardPlacement)} className="mt-2 min-h-11 w-full border border-white/10 bg-black/30 px-3 text-base sm:text-sm"><option value="participation">Оролцсон · +250 XP / +150 ONI</option><option value="third">3-р байр · +500 XP / +300 ONI</option><option value="second">2-р байр · +750 XP / +500 ONI</option><option value="first">1-р байр · +1200 XP / +800 ONI</option></select></label>{notice?<p className="border border-white/10 bg-white/[0.03] p-3 text-xs text-white/70">{notice}</p>:null}<button type="button" disabled={busy || !selected || !eventId.trim()} onClick={()=>void submit()} className="inline-flex min-h-11 w-full items-center justify-center gap-2 border border-crimson/40 bg-crimson/10 text-xs font-semibold tracking-[0.16em] disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Award className="h-4 w-4"/>}REWARD ОЛГОХ</button></div></section></div>:null}</>;
}