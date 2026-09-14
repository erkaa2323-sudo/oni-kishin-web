import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUpRight,
  Fingerprint,
  Gauge,
  Radio,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import cityBg from "@/assets/oni-city-2099.webp";

import "./OniCinematicHome2.css";

const HERO_VIDEO = "/ScreenRecording_09-11-2026%2011-36-49_1.mov";

const systems = [
  { label: "ONI ID", value: "CREW PASSPORT", to: "/profile" as const, Icon: Fingerprint },
  { label: "GARAGE DNA", value: "MACHINE LINK", to: "/garage" as const, Icon: Gauge },
  { label: "STREET OPS", value: "LIVE COMMAND", to: "/street-ops" as const, Icon: Radio },
  { label: "MEET", value: "CREW CHANNEL", to: "/meet" as const, Icon: ShieldCheck },
];

export function OniCinematicHome2() {
  const sceneRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [needsTap, setNeedsTap] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const attempt = async () => {
      if (document.hidden) return;
      try {
        await video.play();
        setNeedsTap(false);
      } catch {
        setNeedsTap(true);
      }
    };

    void attempt();
    window.addEventListener("pageshow", attempt);
    document.addEventListener("visibilitychange", attempt);
    return () => {
      window.removeEventListener("pageshow", attempt);
      document.removeEventListener("visibilitychange", attempt);
    };
  }, []);

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const node = sceneRef.current;
    if (!node || event.pointerType === "touch") return;
    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    node.style.setProperty("--home2-x", x.toFixed(3));
    node.style.setProperty("--home2-y", y.toFixed(3));
  };

  const resumeVideo = async () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    try {
      await video.play();
      setNeedsTap(false);
    } catch {
      setNeedsTap(true);
    }
  };

  return (
    <section
      ref={sceneRef}
      className="oni-home2"
      aria-labelledby="oni-home2-title"
      onPointerMove={handlePointerMove}
    >
      <div className="oni-home2__media" aria-hidden="true">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster={cityBg}
          disablePictureInPicture
          tabIndex={-1}
        >
          <source src={HERO_VIDEO} type="video/quicktime" />
        </video>
      </div>
      <div className="oni-home2__depth" aria-hidden="true" />
      <div className="oni-home2__beam" aria-hidden="true" />
      <div className="oni-home2__rain" aria-hidden="true" />
      <div className="oni-home2__noise" aria-hidden="true" />

      {needsTap ? (
        <button type="button" className="oni-home2__play" onClick={resumeVideo}>
          ▶ CINEMATIC PLAY
        </button>
      ) : null}

      <div className="oni-home2__frame" aria-hidden="true">
        <span className="oni-home2__corner oni-home2__corner--tl" />
        <span className="oni-home2__corner oni-home2__corner--tr" />
        <span className="oni-home2__corner oni-home2__corner--bl" />
        <span className="oni-home2__corner oni-home2__corner--br" />
      </div>

      <div className="oni-home2__shell">
        <div className="oni-home2__statusbar">
          <span><i /> ONI // KISHIN NETWORK</span>
          <span>HOME 2.0 / 2099</span>
          <span className="hidden sm:inline">ULAANBAATAR · MN</span>
        </div>

        <div className="oni-home2__layout">
          <div className="oni-home2__copy">
            <p className="hud-label text-crimson">WORLD SYSTEM / ONLINE</p>
            <h1 id="oni-home2-title">
              <span>ОНИ ХОТ</span>
              <strong>СЭРЭВ.</strong>
            </h1>
            <p className="oni-home2__lede">
              Клан биш — амьд дижитал ертөнц. ONI ID, Garage DNA, Street Ops болон Meet системүүд
              нэг cinematic command layer дээр холбогдлоо.
            </p>
            <div className="oni-home2__actions">
              <Link to="/street-ops" className="oni-home2__primary">
                STREET OPS НЭЭХ <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link to="/profile" className="oni-home2__secondary">
                ONI ID ҮЗЭХ
              </Link>
            </div>
            <div className="oni-home2__mobile-status" aria-label="Системийн төлөв">
              <span>ONI ID <b>LIVE</b></span>
              <span>GARAGE DNA <b>LIVE</b></span>
              <span>STREET OPS <b>LIVE</b></span>
            </div>
          </div>

          <aside className="oni-home2__systems" aria-label="ONI World системүүд">
            <div className="oni-home2__systems-head">
              <div>
                <span className="hud-label">WORLD CORE</span>
                <strong>SYSTEM MATRIX</strong>
              </div>
              <Sparkles className="h-4 w-4 text-crimson" />
            </div>
            <div className="oni-home2__systems-grid">
              {systems.map(({ label, value, to, Icon }, index) => (
                <Link key={label} to={to} className="oni-home2__system">
                  <span className="oni-home2__system-index">0{index + 1}</span>
                  <Icon className="h-4 w-4" />
                  <small>{label}</small>
                  <strong>{value}</strong>
                  <ArrowUpRight className="oni-home2__system-arrow h-4 w-4" />
                </Link>
              ))}
            </div>
            <div className="oni-home2__integrity">
              <ShieldCheck className="h-4 w-4 text-crimson" />
              <span>WORLD INTEGRITY</span>
              <strong>100%</strong>
            </div>
          </aside>
        </div>

        <div className="oni-home2__footerline">
          <span>CHAPTER 08 · CINEMATIC HOME</span>
          <a href="#oni-creed" aria-label="Доош гүйлгэх">
            <ArrowDown className="h-4 w-4" /> ENTER WORLD
          </a>
          <span>43°N / 106°E</span>
        </div>
      </div>
    </section>
  );
}
