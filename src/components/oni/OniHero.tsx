import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUpRight, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";

import cityBg from "@/assets/oni-city-2099.webp";

const HERO_VIDEO = "/ScreenRecording_09-11-2026%2011-36-49_1.mov";

export function OniHero() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const tryPlay = () => {
      void video.play().catch(() => undefined);
    };

    tryPlay();
    video.addEventListener("canplay", tryPlay);
    document.addEventListener("visibilitychange", tryPlay);
    window.addEventListener("pageshow", tryPlay);

    return () => {
      video.removeEventListener("canplay", tryPlay);
      document.removeEventListener("visibilitychange", tryPlay);
      window.removeEventListener("pageshow", tryPlay);
    };
  }, []);

  return (
    <section className="oni-command" aria-labelledby="oni-hero-title">
      <div className="oni-command__city oni-command__cinematic" aria-hidden="true">
        <div className="oni-command__cinematic-fill" />
        <video
          ref={videoRef}
          className="oni-command__cinematic-video"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={cityBg}
          disablePictureInPicture
          tabIndex={-1}
        >
          <source src={HERO_VIDEO} type="video/quicktime" />
        </video>
      </div>
      <div className="oni-command__cinematic-shade" aria-hidden="true" />
      <div className="oni-command__flare" aria-hidden="true" />
      <div className="oni-command__rain" aria-hidden="true" />
      <div className="oni-command__fog oni-command__fog--one" aria-hidden="true" />
      <div className="oni-command__fog oni-command__fog--two" aria-hidden="true" />

      <div className="oni-command__ui">
        <div className="oni-command__eyebrow">
          <span className="oni-live-dot" />
          <span>ONI NETWORK / 2099</span>
          <span className="hidden sm:inline">鬼神都市</span>
        </div>
        <div className="oni-command__copy">
          <p className="hud-label text-crimson">SECTOR 00 · ULAANBAATAR</p>
          <h1 id="oni-hero-title">
            <span>БИД ХОТЫГ</span>
            <strong>СЭРЭЭНЭ.</strong>
          </h1>
          <p className="oni-command__lede">
            Машин, анимэ, хөгжим, нөхөрлөл — нэг ертөнцөд. ONI AND KISHIN бол Монголын шөнийн шинэ
            дижитал домог.
          </p>
          <div className="oni-command__actions">
            <Link to="/join" className="oni-primary-action">
              СИСТЕМД НЭГДЭХ <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link to="/crew" className="oni-secondary-action">
              ДҮРҮҮДИЙГ НЭЭХ
            </Link>
          </div>
        </div>
        <aside className="oni-command__chapter" aria-label="ОНИ хотын бүлэг">
          <span>CHAPTER</span>
          <strong>00</strong>
          <small>
            THE CITY
            <br />
            AWAKENS
          </small>
        </aside>
        <div className="oni-command__bottom">
          <div>
            <ShieldCheck className="h-4 w-4 text-crimson" />
            <span>NETWORK SECURE</span>
          </div>
          <a href="#oni-creed" aria-label="Доош гүйлгэх">
            <ArrowDown className="h-4 w-4" />
            <span>ENTER CITY</span>
          </a>
          <span>43°N / 106°E</span>
        </div>
      </div>
    </section>
  );
}
