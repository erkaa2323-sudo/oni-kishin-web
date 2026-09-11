import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, PhoneOff } from "lucide-react";
import { firebaseAuth } from "@/integrations/firebase/client";
import { getMeetVoiceToken } from "@/lib/meet-voice.functions";

const LIVEKIT_SDK_URL =
  "https://cdn.jsdelivr.net/npm/livekit-client@2.22.3/dist/livekit-client.umd.min.js";
const LIVEKIT_SCRIPT_ID = "oni-livekit-client";

type VoicePhase = "idle" | "connecting" | "connected" | "reconnecting" | "error";

type LiveKitRemoteTrack = {
  kind: string;
  attach: () => HTMLMediaElement;
  detach: () => HTMLMediaElement[];
};

type LiveKitRoom = {
  connect: (url: string, token: string, options?: { autoSubscribe?: boolean }) => Promise<void>;
  disconnect: (stopTracks?: boolean) => Promise<void>;
  on: (event: string, listener: (...args: unknown[]) => void) => LiveKitRoom;
  startAudio: () => Promise<void>;
  canPlaybackAudio: boolean;
  localParticipant: {
    setMicrophoneEnabled: (enabled: boolean) => Promise<unknown>;
  };
};

type LiveKitSdk = {
  Room: new (options?: { adaptiveStream?: boolean; dynacast?: boolean }) => LiveKitRoom;
  RoomEvent: {
    Disconnected: string;
    Reconnecting: string;
    Reconnected: string;
    TrackSubscribed: string;
    TrackUnsubscribed: string;
    AudioPlaybackStatusChanged: string;
  };
  isBrowserSupported?: () => boolean;
};

declare global {
  interface Window {
    LivekitClient?: LiveKitSdk;
  }
}

let sdkPromise: Promise<LiveKitSdk> | null = null;

function loadLiveKitSdk(): Promise<LiveKitSdk> {
  if (window.LivekitClient) return Promise.resolve(window.LivekitClient);
  if (sdkPromise) return sdkPromise;

  const loading = new Promise<LiveKitSdk>((resolve, reject) => {
    const finish = () => {
      if (window.LivekitClient) resolve(window.LivekitClient);
      else reject(new Error("LiveKit SDK loaded without global export"));
    };
    const existing = document.getElementById(LIVEKIT_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("LiveKit SDK load failed")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.id = LIVEKIT_SCRIPT_ID;
    script.src = LIVEKIT_SDK_URL;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.referrerPolicy = "no-referrer";
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("LiveKit SDK load failed")), {
      once: true,
    });
    document.head.appendChild(script);
  });
  sdkPromise = loading;
  void loading.catch(() => {
    if (sdkPromise === loading) sdkPromise = null;
  });
  return loading;
}

function voiceErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError") {
    return "Микрофоны зөвшөөрөл хаалттай байна. Safari/Browser settings-ээс Microphone-ийг Allow болгоно уу.";
  }
  return "Voice холболт амжилтгүй боллоо. Сүлжээгээ шалгаад дахин оролдоно уу.";
}

export function MeetVoice({ authorized }: { authorized: boolean }) {
  const roomRef = useRef<LiveKitRoom | null>(null);
  const audioHostRef = useRef<HTMLDivElement | null>(null);
  const authorizedRef = useRef(authorized);
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [muted, setMuted] = useState(false);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const [message, setMessage] = useState("");

  const leave = useCallback(async (reason = "") => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      try {
        await room.disconnect(true);
      } catch {
        // Local tracks are still dropped by disconnect(true) when the transport is gone.
      }
    }
    setMuted(false);
    setNeedsAudioUnlock(false);
    setPhase("idle");
    setMessage(reason);
  }, []);

  useEffect(() => {
    authorizedRef.current = authorized;
    if (!authorized) {
      void leave("");
      return;
    }
    void loadLiveKitSdk().catch(() => {
      // Join surfaces a retryable error if the pinned SDK cannot load.
    });
  }, [authorized, leave]);

  useEffect(
    () => () => {
      const room = roomRef.current;
      roomRef.current = null;
      if (room) void room.disconnect(true);
    },
    [],
  );

  const join = useCallback(async () => {
    if (!authorizedRef.current || phase === "connecting" || roomRef.current) return;
    const user = firebaseAuth.currentUser;
    if (!user) {
      setPhase("error");
      setMessage("Voice-д орохын өмнө Crew аккаунтаар нэвтэрнэ үү.");
      return;
    }

    setPhase("connecting");
    setMessage("Voice эрх болон LiveKit холболтыг шалгаж байна…");
    try {
      const idToken = await user.getIdToken();
      const grant = await getMeetVoiceToken({ data: { idToken } });
      if (!authorizedRef.current) {
        setPhase("idle");
        setMessage("");
        return;
      }
      if (grant.code !== "READY") {
        setPhase("error");
        setMessage(
          grant.code === "CONFIG_REQUIRED"
            ? "Voice серверийн тохиргоо дутуу байна."
            : grant.code === "DENIED"
              ? "Voice хандалт хаалттай. Meet бүртгэл болон хугацаагаа шалгана уу."
              : "Voice үйлчилгээг шалгах боломжгүй байна.",
        );
        return;
      }

      const sdk = await loadLiveKitSdk();
      if (sdk.isBrowserSupported && !sdk.isBrowserSupported()) {
        throw new Error("Browser does not support LiveKit");
      }
      const room = new sdk.Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      room.on(sdk.RoomEvent.Reconnecting, () => {
        if (roomRef.current === room) {
          setPhase("reconnecting");
          setMessage("Voice холболтыг сэргээж байна…");
        }
      });
      room.on(sdk.RoomEvent.Reconnected, () => {
        if (roomRef.current === room) {
          setPhase("connected");
          setMessage("Voice холболт сэргэлээ.");
        }
      });
      room.on(sdk.RoomEvent.Disconnected, () => {
        if (roomRef.current === room) {
          roomRef.current = null;
          setMuted(false);
          setNeedsAudioUnlock(false);
          setPhase("idle");
          setMessage("Voice холболт саллаа.");
        }
      });
      room.on(sdk.RoomEvent.TrackSubscribed, (...args) => {
        const track = args[0] as LiveKitRemoteTrack | undefined;
        if (!track || track.kind !== "audio") return;
        const element = track.attach();
        element.autoplay = true;
        element.setAttribute("playsinline", "");
        audioHostRef.current?.appendChild(element);
      });
      room.on(sdk.RoomEvent.TrackUnsubscribed, (...args) => {
        const track = args[0] as LiveKitRemoteTrack | undefined;
        if (!track) return;
        for (const element of track.detach()) element.remove();
      });
      room.on(sdk.RoomEvent.AudioPlaybackStatusChanged, () => {
        if (roomRef.current === room) setNeedsAudioUnlock(!room.canPlaybackAudio);
      });

      await room.connect(grant.url, grant.token, { autoSubscribe: true });
      if (!authorizedRef.current) {
        await leave("");
        return;
      }
      await room.localParticipant.setMicrophoneEnabled(true);
      setMuted(false);
      setNeedsAudioUnlock(!room.canPlaybackAudio);
      setPhase("connected");
      setMessage("Voice-д холбогдлоо. Микрофон нээлттэй байна.");
    } catch (error) {
      await leave(voiceErrorMessage(error));
      setPhase("error");
    }
  }, [leave, phase]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room || (phase !== "connected" && phase !== "reconnecting")) return;
    const nextMuted = !muted;
    try {
      await room.localParticipant.setMicrophoneEnabled(!nextMuted);
      setMuted(nextMuted);
      setMessage(nextMuted ? "Микрофон хаалттай." : "Микрофон нээлттэй.");
    } catch (error) {
      setMessage(voiceErrorMessage(error));
    }
  }, [muted, phase]);

  const unlockAudio = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      setNeedsAudioUnlock(false);
      setMessage("Дуу нээгдлээ.");
    } catch {
      setMessage("Дуу нээх боломжгүй байна. Дахин нэг удаа товшино уу.");
    }
  }, []);

  if (!authorized) return null;

  const connected = phase === "connected" || phase === "reconnecting";
  return (
    <div className="mt-4 border border-border bg-ink/55 p-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="hud-label text-foreground/80">PRIVATE VOICE / LIVEKIT</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Зөвхөн энэ Meet-д бүртгэлтэй, баталгаажсан гишүүд орно.
          </p>
        </div>
        <span
          className={`text-[0.6rem] tracking-[0.16em] ${connected ? "text-emerald-300" : "text-muted-foreground"}`}
        >
          {phase === "connecting"
            ? "CONNECTING"
            : phase === "reconnecting"
              ? "RECONNECTING"
              : phase === "connected"
                ? muted
                  ? "MUTED"
                  : "LIVE"
                : "READY"}
        </span>
      </div>

      {!connected ? (
        <button
          type="button"
          onClick={() => void join()}
          disabled={phase === "connecting"}
          className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center gap-2 border border-emerald-400/45 bg-emerald-500/10 px-4 text-xs tracking-[0.18em] text-foreground disabled:opacity-55"
        >
          {phase === "connecting" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Mic className="h-4 w-4" aria-hidden="true" />
          )}
          {phase === "connecting" ? "ХОЛБОЖ БАЙНА" : "VOICE-Д ОРОХ"}
        </button>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void toggleMute()}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 border border-border bg-white/5 px-3 text-xs text-foreground"
          >
            {muted ? (
              <Mic className="h-4 w-4" aria-hidden="true" />
            ) : (
              <MicOff className="h-4 w-4" aria-hidden="true" />
            )}
            {muted ? "MIC НЭЭХ" : "MUTE"}
          </button>
          <button
            type="button"
            onClick={() => void leave("Voice-оос гарлаа.")}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 border border-crimson/55 bg-crimson/10 px-3 text-xs text-foreground"
          >
            <PhoneOff className="h-4 w-4" aria-hidden="true" />
            ГАРАХ
          </button>
        </div>
      )}

      {needsAudioUnlock && connected ? (
        <button
          type="button"
          onClick={() => void unlockAudio()}
          className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 border border-amber-300/45 bg-amber-300/10 px-3 text-xs text-foreground"
        >
          ДУУ НЭЭХ
        </button>
      ) : null}

      {message ? (
        <p role="status" className="mt-3 break-words text-xs leading-relaxed text-muted-foreground">
          {message}
        </p>
      ) : null}
      <div ref={audioHostRef} className="hidden" aria-hidden="true" />
    </div>
  );
}
