import { useMemo, useState } from "react";
import { Bot, CheckCircle2, ChevronDown, ChevronUp, Loader2, Send, ShieldAlert, X } from "lucide-react";

import {
  executeAdminCopilotAction,
  runAdminCopilotCommand,
  type CopilotAction,
} from "@/data/admin-copilot";
import type { AdminActor } from "@/data/admin";
import { useOniAuth } from "@/hooks/useOniAuth";
import type { BrainTurn } from "@/lib/oni-brain";
import type { OniState } from "@/lib/oni-emotion";
import { OniLive2D } from "./OniLive2D";

type ChatLine = { id: string; role: "user" | "oni"; text: string };

const QUICK = [
  "Ерөнхий төлөвийг харуул",
  "Хүлээгдэж буй хүсэлтүүдийг шалга",
  "Одоогийн уулзалтыг шалга",
  "Гаражийн төлөвийг харуул",
  "Галерейн төлөвийг харуул",
];

function toHistory(lines: ChatLine[]): BrainTurn[] {
  return lines.slice(-10).map((line) => ({ role: line.role, text: line.text }));
}

export function OniAdminCopilot() {
  const auth = useOniAuth();
  const actor: AdminActor | null =
    auth.phase === "authorized" && auth.profile
      ? { uid: auth.profile.uid, role: auth.profile.role }
      : null;

  const [open, setOpen] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<OniState>("idle");
  const [action, setAction] = useState<CopilotAction | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([
    {
      id: "welcome",
      role: "oni",
      text: "Admin ONI онлайн. Members, хүсэлт, meet, garage, gallery, music, audit дээр команд өгч болно.",
    },
  ]);

  const riskText = useMemo(() => {
    if (!action) return "";
    return action.risk === "high" ? "ӨНДӨР ЭРСДЭЛ" : action.risk === "medium" ? "ДУНД ЭРСДЭЛ" : "БАГА ЭРСДЭЛ";
  }, [action]);

  if (!actor || !open) {
    if (!actor) return null;
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[80] inline-flex min-h-[48px] items-center gap-2 border border-crimson/60 bg-midnight/95 px-4 text-[0.68rem] font-semibold tracking-[0.16em] text-foreground shadow-2xl backdrop-blur-xl clip-notch"
      >
        <Bot className="h-4 w-4 text-crimson" /> ONI ADMIN AI
      </button>
    );
  }

  const send = async (forced?: string) => {
    const text = (forced ?? input).trim();
    if (!text || busy) return;
    setInput("");
    setAction(null);
    const userLine: ChatLine = { id: `u${Date.now()}`, role: "user", text };
    const nextLines = [...lines, userLine];
    setLines(nextLines);
    setBusy(true);
    setState("listening");
    await new Promise((resolve) => window.setTimeout(resolve, 140));
    setState("thinking");
    const reply = await runAdminCopilotCommand(text, toHistory(nextLines));
    setBusy(false);
    setState(reply.state);
    setAction(reply.action ?? null);
    setLines((prev) => [...prev, { id: `o${Date.now()}`, role: "oni", text: reply.text }]);
  };

  const execute = async () => {
    if (!action || busy) return;
    setBusy(true);
    setState(action.risk === "high" ? "serious" : "thinking");
    const result = await executeAdminCopilotAction(action, actor);
    setBusy(false);
    if (result.ok) {
      setState("happy");
      setLines((prev) => [
        ...prev,
        { id: `ok${Date.now()}`, role: "oni", text: `Гүйцэтгэлээ: ${action.summary}` },
      ]);
      setAction(null);
      return;
    }
    setState("concerned");
    setLines((prev) => [
      ...prev,
      { id: `err${Date.now()}`, role: "oni", text: `Гүйцэтгэж чадсангүй: ${result.error}` },
    ]);
  };

  return (
    <aside
      aria-label="ONI Admin AI Copilot"
      className="fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-[80] overflow-hidden border border-crimson/45 bg-midnight/95 shadow-2xl backdrop-blur-2xl sm:left-auto sm:right-4 sm:w-[28rem]"
    >
      <div className="flex min-h-[48px] items-center justify-between border-b border-border px-3">
        <button
          type="button"
          onClick={() => setMinimized((value) => !value)}
          className="flex min-h-[44px] flex-1 items-center gap-2 text-left"
        >
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <span>
            <span className="block text-[0.72rem] font-semibold tracking-[0.18em] text-foreground">ONI ADMIN COPILOT</span>
            <span className="block text-[0.58rem] tracking-[0.14em] text-muted-foreground">LIVE2D · FIREBASE ACTIONS · AUDIT</span>
          </span>
          {minimized ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />}
        </button>
        <button
          type="button"
          aria-label="ONI Admin AI хаах"
          onClick={() => setOpen(false)}
          className="ml-2 inline-flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!minimized ? (
        <div className="grid max-h-[78svh] grid-rows-[13rem_minmax(7rem,1fr)_auto] sm:grid-rows-[15rem_minmax(8rem,1fr)_auto]">
          <div className="relative overflow-hidden border-b border-border bg-ink/70">
            <div className="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_50%_65%,rgba(190,18,60,.22),transparent_58%)]" />
            <div className="absolute inset-0">
              <OniLive2D state={state} glow={0.9} speaking={state === "speaking"} />
            </div>
            <div className="pointer-events-none absolute left-3 top-3 border border-border bg-ink/70 px-2.5 py-1.5 backdrop-blur-md">
              <span className="text-[0.58rem] font-semibold tracking-[0.16em] text-crimson/90">{state.toUpperCase()}</span>
            </div>
          </div>

          <div className="overflow-y-auto p-3">
            <div className="space-y-2" role="log" aria-live="polite">
              {lines.slice(-12).map((line) => (
                <div
                  key={line.id}
                  className={`max-w-[92%] border px-3 py-2 text-xs leading-relaxed ${
                    line.role === "user"
                      ? "ml-auto border-crimson/30 bg-crimson/10 text-foreground"
                      : "border-border bg-ink/65 text-muted-foreground"
                  }`}
                >
                  <span className="mb-1 block text-[0.55rem] font-semibold tracking-[0.14em] text-crimson/75">
                    {line.role === "user" ? "ADMIN" : "ONI"}
                  </span>
                  {line.text}
                </div>
              ))}
              {busy ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-crimson" /> ONI боловсруулж байна…
                </div>
              ) : null}
            </div>

            {action ? (
              <div className={`mt-3 border p-3 ${action.risk === "high" ? "border-crimson/60 bg-crimson/10" : "border-amber-400/35 bg-amber-400/5"}`}>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-crimson" />
                  <span className="text-[0.58rem] font-semibold tracking-[0.16em] text-foreground">{riskText}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{action.summary}</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void execute()}
                  className="mt-3 inline-flex min-h-[42px] items-center gap-2 border border-crimson/55 bg-crimson/18 px-3 text-[0.62rem] font-semibold tracking-[0.15em] text-foreground hover:bg-crimson/28 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" /> БАТАЛГААЖУУЛЖ ГҮЙЦЭТГЭХ
                </button>
              </div>
            ) : null}
          </div>

          <div className="border-t border-border bg-ink/75 p-3">
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
              {QUICK.map((text) => (
                <button
                  key={text}
                  type="button"
                  disabled={busy}
                  onClick={() => void send(text)}
                  className="shrink-0 border border-border bg-midnight/60 px-2.5 py-1.5 text-[0.58rem] text-muted-foreground hover:border-crimson/40 hover:text-foreground disabled:opacity-50"
                >
                  {text}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                placeholder="Ж: Kitsune гишүүнийг архивла / «Friday Meet» үүсгэ / gallery төлөв харуул"
                className="min-h-[48px] flex-1 resize-none border border-border bg-midnight/80 px-3 py-2 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/55 focus:border-crimson/55 sm:text-sm"
              />
              <button
                type="button"
                aria-label="Команд илгээх"
                disabled={busy || !input.trim()}
                onClick={() => void send()}
                className="inline-flex w-12 shrink-0 items-center justify-center border border-crimson/55 bg-crimson/18 text-foreground hover:bg-crimson/28 disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
