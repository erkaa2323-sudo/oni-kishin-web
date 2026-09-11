import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUpRight, ShieldCheck } from "lucide-react";

import cityBg from "@/assets/oni-city-2099.webp";

const HERO_VIDEO = "/ScreenRecording_09-11-2026%2011-36-49_1.mov";

export function OniHero() {
  return (
    <section className="oni-command" aria-labelledby="oni-hero-title">
      <div className="oni-command__city" aria-hidden="true" style={{ inset: 0 }}>
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster={cityBg}
          disablePictureInPicture
          tabIndex={-1}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        >
          <source src={HERO_VIDEO} type="video/quicktime" />
        </video>
      </div>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          zIndex: 1,
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(90deg, rgba(4,4,10,.9) 0%, rgba(4,4,10,.58) 30%, rgba(4,4,10,.08) 63%, rgba(4,4,10,.2) 100%), linear-gradient(0deg, rgba(4,4,10,.92) 0%, transparent 44%)",
        }}
      />
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
