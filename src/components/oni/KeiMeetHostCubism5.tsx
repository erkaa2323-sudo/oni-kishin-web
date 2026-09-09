import { useEffect, useRef, useState } from "react";

import type { MeetLifecycle } from "@/data/meet";

type RegistrationState = "idle" | "sending" | "denied" | "registered";
type CountdownPhase = "none" | "ten" | "five" | "one" | "final10" | "go";
type HostState =
  | "idle"
  | "scheduled"
  | "starting"
  | "open"
  | "live"
  | "loading"
  | "registered"
  | "access"
  | "denied"
  | "full"
  | "closed";

type Props = {
  life: MeetLifecycle;
  registrationState: RegistrationState;
  accessReady?: boolean;
  notice?: string;
  nickname?: string;
  participants: number;
  capacity: number | null;
  countdownPhase?: CountdownPhase;
  countdownSeconds?: number;
};

type RuntimeState = "loading" | "ready" | "failed";
type KeiMessage = { source?: string; type?: string; detail?: unknown };

function resolveHostState(
  life: MeetLifecycle,
  registrationState: RegistrationState,
  accessReady: boolean,
): HostState {
  if (registrationState === "registered" && accessReady) return "access";
  if (registrationState === "registered") return "registered";
  if (registrationState === "sending") return "loading";
  if (registrationState === "denied") return "denied";
  if (life === "active") return "live";
  if (life === "starting_soon") return "starting";
  if (life === "open") return "open";
  if (life === "scheduled") return "scheduled";
  if (life === "full") return "full";
  if (life === "closed" || life === "ended") return "closed";
  return "idle";
}

function copyFor(state: HostState, nickname?: string, notice?: string) {
  const rider = nickname?.trim() || "Rider";
  if (state === "access")
    return `${rider}, ROOM ID ба PASSWORD бэлэн боллоо. Meet access хэсгээс аваарай.`;
  if (state === "registered")
    return `${rider}, бүртгэл баталгаажлаа. Room access бэлэн болмогц Kei мэдэгдэнэ.`;
  if (state === "denied")
    return notice?.trim() || "Бүртгэл баталгаажаагүй. Мэдээллээ шалгаад дахин оролдоорой.";
  if (state === "loading") return "Crew мэдээлэл болон Meet slot-ийг шалгаж байна…";
  if (state === "live") return "ONI MEET эхэллээ. Бүртгүүлсэн Rider бол room access-аа шалгаарай.";
  if (state === "starting") return "ONI MEET удахгүй эхэлнэ. Бүртгэлээ одоо баталгаажуулаарай.";
  if (state === "open") return "Бүртгэл нээлттэй. Crew аккаунтаа баталгаажуулаад нэгдээрэй.";
  if (state === "scheduled") return "Дараагийн ONI MEET товлогдсон. Countdown-аа шалгаарай.";
  if (state === "full") return "Meet дүүрсэн байна. Дараагийн мэдээллийг эндээс хүлээнэ үү.";
  if (state === "closed") return "Энэ Meet-ийн бүртгэл хаагдсан байна.";
  return "Kei дараагийн ONI MEET-ийг хүлээж байна.";
}

function modeFor(state: HostState) {
  if (state === "access") return "ACCESS READY";
  if (state === "registered") return "RIDER VERIFIED";
  if (state === "denied") return "VERIFY FAILED";
  if (state === "loading") return "VERIFYING";
  if (state === "live") return "MEET LIVE";
  if (state === "starting") return "STARTING SOON";
  if (state === "open") return "REGISTRATION OPEN";
  if (state === "scheduled") return "MEET SCHEDULED";
  if (state === "full") return "CAPACITY FULL";
  if (state === "closed") return "REGISTRATION CLOSED";
  return "STANDBY";
}

function signalFor(state: HostState) {
  if (state === "access") return "SECURE CHANNEL UNLOCKED";
  if (state === "registered") return "IDENTITY VERIFIED";
  if (state === "live") return "LIVE CHANNEL ACTIVE";
  if (state === "starting") return "COUNTDOWN ACTIVE";
  if (state === "open") return "JOIN WINDOW ACTIVE";
  if (state === "loading") return "AUTHENTICATING RIDER";
  if (state === "denied") return "AUTHENTICATION REJECTED";
  if (state === "full") return "CAPACITY LIMIT REACHED";
  if (state === "closed") return "CHANNEL CLOSED";
  if (state === "scheduled") return "CHANNEL RESERVED";
  return "HOST LINK STANDBY";
}

function countdownCopy(phase: CountdownPhase, seconds: number) {
  if (phase === "ten")
    return "ONI MEET эхлэхэд 10 минут хүрэхгүй үлдлээ. Rider-ууд бэлэн байгаарай.";
  if (phase === "five") return "5 минут. Crew check дуусгаж, Meet-д ороход бэлэн байгаарай.";
  if (phase === "one") return "1 минут. ONI MEET launch sequence эхэллээ.";
  if (phase === "final10") return `${Math.max(1, seconds)}… ONI MEET эхлэх гэж байна.`;
  if (phase === "go") return "GO LIVE — ONI MEET эхэллээ. Room access-аа шалгаарай.";
  return "";
}

export function KeiMeetHostCubism5({
  life,
  registrationState,
  accessReady = false,
  notice,
  nickname,
  participants,
  capacity,
  countdownPhase = "none",
  countdownSeconds = 0,
}: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [runtime, setRuntime] = useState<RuntimeState>("loading");
  const [retryKey, setRetryKey] = useState(0);
  const retryCount = useRef(0);

  const state = resolveHostState(life, registrationState, accessReady);
  const countdownActive =
    countdownPhase !== "none" && state !== "access" && state !== "loading" && state !== "denied";
  const reactionState = countdownActive ? `countdown-${countdownPhase}` : state;
  const hot = countdownActive || state === "access" || state === "live" || state === "starting";
  const positive = state === "access" || state === "registered";
  const copy = countdownActive
    ? countdownCopy(countdownPhase, countdownSeconds)
    : copyFor(state, nickname, notice);
  const mode = countdownActive
    ? countdownPhase === "ten"
      ? "T-10 MIN"
      : countdownPhase === "five"
        ? "T-5 MIN"
        : countdownPhase === "one"
          ? "T-1 MIN"
          : countdownPhase === "final10"
            ? `T-${String(Math.max(1, countdownSeconds)).padStart(2, "0")}`
            : "GO LIVE"
    : modeFor(state);
  const signal = countdownActive ? "FINAL COUNTDOWN" : signalFor(state);
  const runtimeLabel = runtime === "ready" ? "ONLINE" : runtime === "failed" ? "OFFLINE" : "SYNC";
  const runtimeClass =
    runtime === "ready"
      ? "text-emerald-300/80"
      : runtime === "failed"
        ? "text-crimson"
        : "text-white/40";
  const railColorClass = positive ? "bg-emerald-300/45" : hot ? "bg-crimson/55" : "bg-white/15";
  const signalTextClass = positive
    ? "text-emerald-300/75"
    : hot
      ? "text-crimson/80"
      : "text-white/35";

  useEffect(() => {
    const onMessage = (event: MessageEvent<KeiMessage>) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.source !== "oni-kei-meet") return;
      if (event.data.type === "ready") {
        retryCount.current = 0;
        setRuntime("ready");
      } else if (event.data.type === "failed") {
        setRuntime("failed");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (runtime !== "ready") return;
    frameRef.current?.contentWindow?.postMessage(
      { source: "oni-kei-meet-parent", type: "state", state: reactionState },
      "*",
    );
  }, [reactionState, runtime]);

  useEffect(() => {
    if (runtime !== "failed" || retryCount.current >= 2) return;
    const timer = window.setTimeout(() => {
      retryCount.current += 1;
      setRuntime("loading");
      setRetryKey((value) => value + 1);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [runtime]);

  const interact = () => {
    if (runtime !== "ready") return;
    frameRef.current?.contentWindow?.postMessage(
      { source: "oni-kei-meet-parent", type: "interact" },
      "*",
    );
  };

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border bg-black/20 shadow-2xl transition-colors duration-700 ${
        positive
          ? "border-emerald-300/35 shadow-emerald-400/10"
          : hot
            ? "border-crimson/40 shadow-crimson/15"
            : "border-white/10 shadow-crimson/10"
      }`}
      onPointerDown={interact}
    >
      <div
        className={`pointer-events-none absolute inset-0 ${
          positive
            ? "bg-[radial-gradient(circle_at_50%_58%,rgba(110,255,190,0.19),transparent_54%)]"
            : hot
              ? "bg-[radial-gradient(circle_at_50%_58%,rgba(255,55,85,0.18),transparent_54%)]"
              : "bg-[radial-gradient(circle_at_50%_58%,rgba(255,68,110,0.18),transparent_52%)]"
        }`}
      />

      <div className="pointer-events-none absolute inset-x-5 top-4 z-20 flex items-center justify-between text-[0.58rem] font-semibold tracking-[0.2em] text-white/55">
        <span>KEI / LIVE2D</span>
        <span className={runtimeClass}>{runtimeLabel}</span>
      </div>

      <iframe
        key={retryKey}
        ref={frameRef}
        title="Kei Cubism 5 Meet host"
        src="/kei-live2d-host.html"
        className="relative z-[1] block h-[360px] w-full border-0 bg-transparent sm:h-[430px] lg:h-[500px]"
        onLoad={() => setRuntime("loading")}
      />

      {runtime === "loading" ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-[0.46rem] tracking-[0.22em] text-white/25">
          RENDERING KEI…
        </div>
      ) : null}
      {runtime === "failed" ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-[0.46rem] tracking-[0.22em] text-crimson/80">
          KEI RENDER ERROR
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-3 top-[54%] z-20 w-[23%] -translate-y-1/2 sm:left-5 sm:w-[22%]">
        <span className={`mb-2 block h-px w-8 ${railColorClass}`} />
        <div
          className={`text-[0.38rem] font-semibold tracking-[0.16em] sm:text-[0.44rem] ${signalTextClass}`}
        >
          {signal}
        </div>
        <div className="mt-1 text-[0.44rem] font-semibold tracking-[0.13em] text-white/72 sm:text-[0.5rem]">
          {mode}
        </div>
        <p className="mt-2 line-clamp-4 text-[0.42rem] leading-relaxed text-white/48 sm:text-[0.48rem]">
          {copy}
        </p>
      </div>

      <div className="pointer-events-none absolute right-3 top-[54%] z-20 w-[19%] -translate-y-1/2 text-right sm:right-5 sm:w-[18%]">
        <span className="mb-2 ml-auto block h-px w-8 bg-white/15" />
        <div className="font-mono text-[0.92rem] font-semibold tracking-[0.04em] text-white/90 sm:text-[1.02rem]">
          {participants}/{capacity ?? "∞"}
        </div>
        <div className="mt-1 text-[0.34rem] tracking-[0.18em] text-white/35">RIDERS</div>
      </div>
    </div>
  );
}
