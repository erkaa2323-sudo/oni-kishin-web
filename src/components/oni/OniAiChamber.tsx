import { useEffect, useMemo, useRef, useState } from "react";
import {
  ListMusic,
  Pause,
  Play,
  Repeat,
  Send,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import cityBg from "@/assets/oni-city-bg.jpg";
import oniCharacter from "@/assets/oni-character.webp";
import {
  ONI_SUGGESTIONS,
  draftOniReply,
  formatTime,
  EMPTY_TRACK,
  fetchTracks,
  type OniTrack,
  type OniMessage,
} from "@/data/oni-ai";
import { ONI_STATE_VISUALS, detectState, resolveState, type OniState } from "@/lib/oni-emotion";
import { answerOni, type BrainTurn } from "@/lib/oni-brain";
import { OniHudNav } from "./OniHudNav";
import { OniFooter } from "./OniFooter";

export function OniAiChamber() {
  const [tracks, setTracks] = useState<OniTrack[]>([]);

  useEffect(() => {
    let alive = true;
    void fetchTracks().then((r) => {
      if (alive && r.status === "ok") setTracks(r.rows);
    });
    return () => {
      alive = false;
    };
  }, []);

  /* ---------------------------------------------------------------- music */
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [muted, setMuted] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const track = tracks[trackIndex] ?? EMPTY_TRACK;
  const hasTracks = tracks.length > 0;

  const goTo = (i: number) => {
    if (!tracks.length) return;
    setTrackIndex(((i % tracks.length) + tracks.length) % tracks.length);
    setPosition(0);
  };

  const next = () => {
    if (shuffle && tracks.length > 1) {
      let n = trackIndex;
      while (n === trackIndex) n = Math.floor(Math.random() * tracks.length);
      goTo(n);
      return;
    }
    goTo(trackIndex + 1);
  };

  useEffect(() => {
    if (!playing || !hasTracks || track.duration <= 0) return;
    const el = audioRef.current;
    if (track.src && el) {
      void el.play().catch(() => setPlaying(false));
      return () => el.pause();
    }
    const id = window.setInterval(() => {
      setPosition((p) => {
        if (p + 1 >= track.duration) {
          if (repeat) return 0;
          window.setTimeout(next, 0);
          return track.duration;
        }
        return p + 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, trackIndex, repeat, shuffle]);

  const progress = track.duration > 0 ? Math.min(100, (position / track.duration) * 100) : 0;

  /* -------------------------------------------------- character state fsm */
  const [convState, setConvState] = useState<OniState | null>(null);
  const state = resolveState(convState, playing);
  const visual = ONI_STATE_VISUALS[state];
  const timers = useRef<number[]>([]);
  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  /* ----------------------------------------------------------------- chat */
  const [messages, setMessages] = useState<OniMessage[]>([
    {
      id: "m0",
      role: "oni",
      text: "ONI BRAIN онлайн. Танхимд тавтай морил. Асуултаа бичих эсвэл хөгжмөө тавь.",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  /**
   * Bounded, in-memory only conversation window handed to ONI BRAIN.
   * Never written to storage, cookies or the database.
   */
  const historyRef = useRef<BrainTurn[]>([]);
  useEffect(() => {
    historyRef.current = messages.slice(-6).map((m) => ({ role: m.role, text: m.text }));
  }, [messages]);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || thinking) return;
    const base = Date.now();
    setMessages((m) => [...m, { id: `u${base}`, role: "user", text }]);
    setInput("");

    const target = detectState(text);
    setConvState("listening");
    setThinking(true);

    const t1 = window.setTimeout(() => setConvState("thinking"), 320);
    timers.current.push(t1);

    void (async () => {
      const started = Date.now();
      let reply: {
        text: string;
        state?: OniState;
        sources?: Array<{ url: string; title: string }>;
      };
      try {
        reply = await answerOni(text, historyRef.current);
      } catch {
        reply = { text: draftOniReply(text), state: "concerned" };
      }
      // keep a short, visible thinking beat
      const wait = Math.max(0, 900 - (Date.now() - started));
      const t2 = window.setTimeout(() => {
        setMessages((m) => [
          ...m,
          { id: `o${base}`, role: "oni", text: reply.text, sources: reply.sources },
        ]);
        setThinking(false);
        setConvState(reply.state ?? target);
        const t3 = window.setTimeout(() => setConvState(null), 8000);
        timers.current.push(t3);
      }, wait);
      timers.current.push(t2);
    })();
  };

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  /* ------------------------------------------------------- shared pieces */
  const characterGlow = (
    <div
      className="pointer-events-none absolute inset-0 transition-opacity duration-700"
      style={{
        opacity: visual.glow,
        background:
          "radial-gradient(48% 46% at 50% 58%, oklch(0.55 0.215 25.5 / 0.35), transparent 72%)",
      }}
    />
  );

  const stateBadge = (
    <span className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 border border-crimson/45 bg-crimson/12 px-2.5 py-1.5 text-[0.55rem] tracking-[0.22em] text-foreground clip-notch">
      <span className="h-1.5 w-1.5 bg-crimson animate-pulse-soft" />
      {visual.label}
      <span className="text-crimson/80">/ {visual.code}</span>
    </span>
  );

  const backdrop = (
    <>
      <div className="absolute inset-0">
        <img
          src={cityBg}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          decoding="async"
          className="h-full w-full scale-105 object-cover opacity-45"
        />
      </div>
      <div
        className="pointer-events-none absolute inset-x-[-10%] bottom-0 top-[5%] animate-haze blur-3xl"
        style={{
          background:
            "radial-gradient(45% 55% at 50% 60%, oklch(0.55 0.215 25.5 / 0.16), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--gradient-vignette)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--gradient-floor)" }}
      />
      <div className="pointer-events-none absolute inset-0 scanline-veil opacity-20 mix-blend-overlay" />
    </>
  );

  const messageList = (
    <div
      ref={logRef}
      role="log"
      aria-live="polite"
      className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1"
    >
      {messages.map((m) => (
        <div
          key={m.id}
          className={
            m.role === "user"
              ? "ml-auto max-w-[85%] border border-border bg-midnight/80 px-3.5 py-2.5 text-[0.8rem] leading-relaxed break-words whitespace-pre-wrap text-foreground clip-notch"
              : "max-w-[92%] border border-crimson/35 bg-crimson/10 px-3.5 py-2.5 text-[0.8rem] leading-relaxed break-words whitespace-pre-wrap text-foreground clip-notch"
          }
        >
          <span className="hud-label mb-1 block text-[0.5rem] text-muted-foreground">
            {m.role === "user" ? "ТА" : "ONI BRAIN"}
          </span>
          {m.text}
          {m.role === "oni" && m.sources?.length ? (
            <ul className="mt-2 space-y-1 border-t border-crimson/20 pt-2">
              {m.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-[0.65rem] text-crimson underline underline-offset-2"
                  >
                    {source.title}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
      {thinking && (
        <div className="max-w-[60%] border border-crimson/30 bg-crimson/8 px-3.5 py-2.5 clip-notch">
          <span className="hud-label block text-[0.5rem] text-crimson/85">ONI BRAIN</span>
          <span className="mt-1 flex gap-1.5" aria-label="Бодож байна">
            <span className="h-1.5 w-1.5 bg-crimson animate-pulse-soft" />
            <span
              className="h-1.5 w-1.5 bg-crimson animate-pulse-soft"
              style={{ animationDelay: "0.25s" }}
            />
            <span
              className="h-1.5 w-1.5 bg-crimson animate-pulse-soft"
              style={{ animationDelay: "0.5s" }}
            />
          </span>
        </div>
      )}
    </div>
  );

  const composer = (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        send(input);
      }}
    >
      <label htmlFor="oni-ai-input" className="sr-only">
        ONI Brain-д асуулт бичих
      </label>
      <input
        id="oni-ai-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Асуултаа бичнэ үү…"
        autoComplete="off"
        autoCorrect="off"
        enterKeyHint="send"
        disabled={thinking}
        /* text-base = 16px: prevents iOS Safari focus zoom. Never go below. */
        className="min-h-[44px] w-full min-w-0 border border-border bg-midnight/70 px-3.5 py-3 text-base text-foreground outline-none transition-colors clip-notch placeholder:text-muted-foreground focus:border-crimson/60 disabled:opacity-60 lg:text-sm"
      />
      <button
        type="submit"
        aria-label="Илгээх"
        disabled={thinking}
        className="grid h-11 w-11 shrink-0 place-items-center border border-crimson/50 bg-crimson/15 text-foreground transition-colors clip-notch hover:bg-crimson/30 disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  );

  const transport = (compact = false) => (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => goTo(trackIndex - 1)}
        aria-label="Өмнөх"
        disabled={!hasTracks}
        className="grid h-11 w-11 shrink-0 place-items-center border border-border text-foreground transition-colors clip-notch hover:border-crimson/60 disabled:opacity-40"
      >
        <SkipBack className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? "Түр зогсоох" : "Тоглуулах"}
        disabled={!hasTracks}
        className="grid h-11 w-11 shrink-0 place-items-center border border-crimson/55 bg-crimson/18 text-foreground transition-colors clip-notch hover:bg-crimson/32 disabled:opacity-40"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Дараах"
        disabled={!hasTracks}
        className="grid h-11 w-11 shrink-0 place-items-center border border-border text-foreground transition-colors clip-notch hover:border-crimson/60 disabled:opacity-40"
      >
        <SkipForward className="h-4 w-4" />
      </button>
      {compact && (
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="Хөгжмийн тохиргоо ба ээлж"
          className="grid h-11 w-11 shrink-0 place-items-center border border-border text-muted-foreground transition-colors clip-notch hover:border-crimson/60 hover:text-foreground"
        >
          <ListMusic className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  const progressBar = (
    <div
      role="progressbar"
      aria-label="Тоглуулах явц"
      aria-valuemin={0}
      aria-valuemax={Math.max(track.duration, 1)}
      aria-valuenow={Math.floor(position)}
      className="h-1 w-full bg-border"
    >
      <div
        className="h-full bg-crimson transition-[width] duration-500"
        style={{ width: `${progress}%` }}
      />
    </div>
  );

  const queueList = !hasTracks ? (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <p className="max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
        Нийтлэгдсэн трэк одоогоор алга. Админ хөгжмийн мета өгөгдөл нэмсний дараа энд харагдана.
      </p>
    </div>
  ) : (
    <ul className="min-h-0 flex-1 space-y-px overflow-y-auto bg-border/60">
      {tracks.map((t, i) => (
        <li key={t.id} className="bg-ink/60">
          <button
            type="button"
            onClick={() => {
              goTo(i);
              setPlaying(true);
            }}
            aria-current={i === trackIndex}
            className={`flex min-h-[44px] w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-crimson/10 ${
              i === trackIndex ? "bg-crimson/12" : ""
            }`}
          >
            <span className="hud-label w-6 shrink-0 text-crimson/80">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground">{t.title}</span>
              <span className="block truncate text-[0.65rem] text-muted-foreground">
                {t.subtitle}
              </span>
            </span>
            <span className="hud-label shrink-0">{t.tag}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  const toggles = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setShuffle((s) => !s)}
        aria-pressed={shuffle}
        aria-label="Холих"
        className={`grid h-11 w-11 place-items-center border transition-colors clip-notch ${
          shuffle ? "border-crimson/60 text-crimson" : "border-border text-muted-foreground"
        }`}
      >
        <Shuffle className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setRepeat((r) => !r)}
        aria-pressed={repeat}
        aria-label="Давтах"
        className={`grid h-11 w-11 place-items-center border transition-colors clip-notch ${
          repeat ? "border-crimson/60 text-crimson" : "border-border text-muted-foreground"
        }`}
      >
        <Repeat className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        aria-pressed={muted}
        className="inline-flex min-h-[44px] items-center gap-2 border border-border px-3 text-[0.55rem] tracking-[0.22em] text-muted-foreground transition-colors clip-notch hover:text-foreground"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        {muted ? "ЧИМЭЭГҮЙ" : "ДУУ"}
      </button>
    </div>
  );

  const character = (
    <img
      src={oniCharacter}
      alt="ONI Brain дүрслэл"
      decoding="async"
      className={`pointer-events-none absolute inset-x-0 bottom-0 mx-auto h-full w-auto origin-bottom object-contain opacity-95 will-change-transform ${visual.motion}`}
      style={{
        filter: `drop-shadow(0 0 ${12 + visual.glow * 34}px oklch(0.55 0.215 25.5 / ${0.2 + visual.glow * 0.5}))`,
        transition: "filter 700ms var(--ease-cinema)",
      }}
    />
  );

  return (
    <div className="relative bg-ink">
      <OniHudNav />

      {/* ============================================ MOBILE: one screen */}
      <main
        className="relative isolate flex h-[100svh] flex-col overflow-hidden lg:hidden"
        aria-labelledby="oniai-title-m"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {backdrop}

        <div className="relative z-10 flex min-h-0 flex-1 flex-col px-3 pb-2 pt-[4.25rem]">
          {/* character region */}
          <section className="relative min-h-0 flex-[1.05] overflow-hidden border border-border bg-midnight/40 clip-notch">
            {characterGlow}
            {character}
            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
              <span className="min-w-0">
                <h1 id="oniai-title-m" className="text-cinema text-xl text-foreground">
                  ОНИ АЙ
                </h1>
                <span className="hud-label block text-[0.5rem]">ONI BRAIN · MUSIC</span>
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 p-2.5">{stateBadge}</div>
          </section>

          {/* chat region */}
          <section className="mt-2 flex min-h-0 flex-[1.25] flex-col border border-border bg-ink/80 p-2.5">
            {messageList}
            <ul className="mt-2 flex shrink-0 gap-2 overflow-x-auto pb-1">
              {ONI_SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => send(s)}
                    disabled={thinking}
                    className="min-h-[38px] whitespace-nowrap disabled:opacity-50 border border-border px-3 text-[0.6rem] text-muted-foreground transition-colors clip-notch hover:border-crimson/60"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 shrink-0">{composer}</div>
          </section>

          {/* compact now-playing strip */}
          <section className="mt-2 shrink-0 border border-border bg-midnight/60">
            {progressBar}
            <div className="flex items-center gap-2 p-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8rem] text-foreground">{track.title}</span>
                <span className="hud-label block truncate text-[0.5rem]">
                  {formatTime(position)} / {formatTime(track.duration)} · {track.artist}
                </span>
              </span>
              {transport(true)}
            </div>
          </section>
        </div>

        {/* music drawer */}
        <div
          className={`absolute inset-0 z-20 transition-opacity duration-300 ${
            drawer ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden={!drawer}
        >
          <div
            className="absolute inset-0 bg-ink/85 backdrop-blur-xl"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[80svh] flex-col border-t border-crimson/35 bg-ink p-3">
            <div className="flex items-center justify-between">
              <span className="hud-label text-crimson/85">AUDIO / ХӨГЖИМ</span>
              <button
                type="button"
                onClick={() => setDrawer(false)}
                aria-label="Хаах"
                className="grid h-11 w-11 place-items-center border border-border text-foreground clip-notch"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 shrink-0">{toggles}</div>
            <span className="hud-label mt-4 block">QUEUE / ЭЭЛЖ</span>
            <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">{queueList}</div>
          </div>
        </div>
      </main>

      {/* =========================================== DESKTOP: cinematic */}
      <main className="relative hidden lg:block">
        <section className="relative isolate overflow-hidden" aria-labelledby="oniai-title">
          {backdrop}

          <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-[110rem] flex-col px-8 pb-10 pt-28">
            <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
              <div className="min-w-0">
                <span className="hud-label hud-rule block pl-11 text-crimson/85">
                  SECTOR 03 / ONI AI · MUSIC
                </span>
                <h1 id="oniai-title" className="mt-3 text-cinema text-6xl text-foreground">
                  КОМАНД ТАНХИМ
                </h1>
              </div>
              <span className="hud-label shrink-0">BRAIN · PUBLIC DATA</span>
            </header>

            <div className="mt-8 grid flex-1 gap-px bg-border lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,1fr)]">
              {/* AI presence */}
              <div className="relative flex min-h-[26rem] flex-col justify-end overflow-hidden bg-midnight/50 p-6">
                {characterGlow}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 top-6">
                  {character}
                </div>
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ background: "var(--gradient-vignette)" }}
                />
                <div className="relative">
                  <span className="hud-label text-crimson/85">UNIT / ONI BRAIN</span>
                  <p className="mt-2 text-cinema text-3xl text-foreground">ОНИ АЙ</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Кланы хиймэл оюун туслах. Хөгжмийн систем энэ танхимд нэгдсэн байдлаар ажиллана.
                  </p>
                  <div className="mt-3">{stateBadge}</div>
                </div>
              </div>

              {/* chat */}
              <div className="flex min-h-[26rem] flex-col bg-ink/70 p-6">
                <span className="hud-label shrink-0 text-crimson/85">DIALOGUE / ЯРИА</span>
                <div className="mt-4 flex min-h-0 flex-1 flex-col">{messageList}</div>
                <ul className="mt-4 flex shrink-0 gap-2 overflow-x-auto pb-1">
                  {ONI_SUGGESTIONS.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => send(s)}
                        disabled={thinking}
                        className="min-h-[44px] whitespace-nowrap border border-border px-3 text-[0.65rem] text-muted-foreground transition-colors clip-notch hover:border-crimson/60 hover:text-foreground disabled:opacity-50"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 shrink-0">{composer}</div>
              </div>

              {/* music */}
              <div className="flex min-h-[26rem] flex-col bg-midnight/40 p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="hud-label text-crimson/85">AUDIO / ХӨГЖИМ</span>
                  <span className="hud-label">{tracks.length} ТРЭК</span>
                </div>

                <div className="mt-4 border border-border bg-ink/70 p-4 clip-notch">
                  <p className="truncate text-cinema text-2xl text-foreground">{track.title}</p>
                  <p className="hud-label mt-1 truncate">
                    {track.subtitle} · {track.artist}
                  </p>
                  <div className="mt-4">{progressBar}</div>
                  <div className="mt-2 flex justify-between text-[0.6rem] tracking-[0.2em] text-muted-foreground">
                    <span>{formatTime(position)}</span>
                    <span>{formatTime(track.duration)}</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    {transport()}
                    {toggles}
                  </div>
                </div>

                <span className="hud-label mt-5 block">QUEUE / ЭЭЛЖ</span>
                <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">{queueList}</div>
              </div>
            </div>
          </div>
        </section>

        <OniFooter />
      </main>

      <audio
        ref={audioRef}
        src={track.src}
        muted={muted}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onEnded={() => (repeat ? setPosition(0) : next())}
        className="hidden"
      />
    </div>
  );
}
