import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";

import cityBg from "@/assets/oni-city-bg.jpg";
import oniCar from "@/assets/oni-car.png";
import oniCharacter from "@/assets/oni-character.webp";
import { CLAN_NAME } from "@/lib/oni-nav";
import { useParallax } from "./useParallax";

export function OniHero() {
  const { px, py, sp } = useParallax();

  const layer = (depth: number, extraY = 0) => ({
    transform: `translate3d(${px * depth * -18}px, ${py * depth * -10 + sp * depth * 40 + extraY}px, 0)`,
  });

  return (
    <section
      className="relative isolate min-h-[100svh] overflow-hidden bg-ink"
      aria-labelledby="oni-hero-title"
    >
      {/* --- Layer 0: city plate --- */}
      <div
        className="absolute inset-0 will-change-transform"
        style={{ ...layer(0.35), scale: "1.12" }}
      >
        <img
          src={cityBg}
          alt="ОНИ хотын шөнийн гудамж, борооны дараах тусгал"
          width={1920}
          height={1088}
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover object-[60%_center] opacity-90 sm:object-center"
        />
      </div>

      {/* --- Layer 1: atmospheric haze --- */}
      <div
        className="pointer-events-none absolute inset-x-[-15%] bottom-[-10%] top-[20%] animate-haze blur-3xl"
        style={{
          background:
            "radial-gradient(50% 60% at 30% 70%, oklch(0.55 0.215 25.5 / 0.16), transparent 70%), radial-gradient(45% 55% at 75% 60%, oklch(0.62 0.06 265 / 0.18), transparent 70%)",
        }}
      />

      {/* --- Layer 2: the machine --- */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-[13%] flex justify-center will-change-transform sm:bottom-[8%] sm:justify-end sm:pr-[3%] lg:pr-[6%]"
        style={layer(0.9)}
      >
        <div className="relative w-[118%] max-w-none sm:w-[62%] lg:w-[54%] xl:w-[48%]">
          <img
            src={oniCar}
            alt="ОНИ кланы өөрчлөн тохируулсан JDM спорт машин"
            width={1536}
            height={1024}
            loading="lazy"
            decoding="async"
            className="w-full animate-breathe drop-shadow-[0_40px_60px_rgba(0,0,0,0.75)]"
          />
          {/* wet floor reflection */}
          <div
            className="absolute inset-x-[8%] top-[88%] h-[38%] scale-y-[-1] opacity-20 blur-[3px]"
            style={{
              backgroundImage: `url(${oniCar})`,
              backgroundSize: "cover",
              backgroundPosition: "center top",
              maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent 70%)",
              WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent 70%)",
            }}
          />
        </div>
      </div>

      {/* --- Layer 3: the character --- */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-x-[16%] justify-center will-change-transform sm:translate-x-0 sm:justify-start sm:pl-[4%] lg:pl-[8%]"
        style={layer(1.45)}
      >
        <div className="relative h-[74svh] sm:h-[80svh] lg:h-[88svh]">
          {/* crimson key light behind subject */}
          <div
            className="absolute inset-x-[-40%] bottom-[6%] top-[18%] blur-[70px]"
            style={{
              background:
                "radial-gradient(50% 50% at 50% 60%, oklch(0.55 0.215 25.5 / 0.35), transparent 72%)",
            }}
          />
          <img
            src={oniCharacter}
            alt="ОНИ кланы анимэ маягийн дүр — они маск зүүсэн залуу"
            width={1024}
            height={1536}
            fetchPriority="high"
            decoding="async"
            className="relative h-full w-auto animate-breathe object-contain drop-shadow-[0_30px_70px_rgba(0,0,0,0.85)]"
          />
        </div>
      </div>

      {/* --- Grade: floor, vignette, scanlines --- */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--gradient-floor)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--gradient-vignette)" }}
      />
      <div className="pointer-events-none absolute inset-0 scanline-veil opacity-25 mix-blend-overlay" />

      {/* --- HUD content --- */}
      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-[110rem] flex-col justify-end px-5 pb-16 pt-28 sm:px-8 sm:pb-24 lg:justify-center lg:pb-28 lg:pt-32">
        <div className="max-w-2xl sm:ml-auto sm:text-right lg:max-w-3xl">
          <p className="hud-label animate-rise text-crimson/90" style={{ animationDelay: "120ms" }}>
            鬼都 / ONI CITY — SECTOR 00
          </p>

          <h1
            id="oni-hero-title"
            className="mt-4 animate-rise text-cinema text-[3.25rem] leading-[0.88] text-foreground sm:text-7xl lg:text-[7.5rem]"
            style={{ animationDelay: "220ms" }}
          >
            ОНИ
            <span className="block bg-gradient-to-r from-crimson-glow via-crimson to-crimson-deep bg-clip-text text-transparent">
              ХОТ
            </span>
          </h1>

          <p
            className="mt-5 max-w-md animate-rise text-sm leading-relaxed text-muted-foreground sm:ml-auto sm:text-base"
            style={{ animationDelay: "340ms" }}
          >
            Шөнийн гудамж, хөдөлгүүрийн чимээ, нэг тэмдэг. {CLAN_NAME} — Монголын CPM кланы албан
            ёсны төв.
          </p>

          <div
            className="mt-9 flex animate-rise flex-col gap-3 sm:flex-row sm:justify-end"
            style={{ animationDelay: "460ms" }}
          >
            <Link
              to="/join"
              className="group relative overflow-hidden border border-crimson/60 px-7 py-4 text-center text-[0.7rem] font-semibold tracking-[0.28em] text-foreground transition-colors duration-300 clip-notch hover:border-crimson"
              style={{ background: "var(--gradient-crimson)" }}
            >
              <span className="relative z-10">КЛАНД НЭГДЭХ</span>
              <span className="absolute inset-y-0 left-0 z-0 w-1/4 -skew-x-12 bg-bone/10 blur-md animate-sweep" />
            </Link>
            <Link
              to="/crew"
              className="border border-border bg-ink/50 px-7 py-4 text-center text-[0.7rem] font-semibold tracking-[0.28em] text-foreground backdrop-blur-md transition-colors duration-300 clip-notch hover:border-crimson/60 hover:bg-crimson/10"
            >
              БҮРЭЛДЭХҮҮН ҮЗЭХ
            </Link>
          </div>
        </div>
      </div>

      {/* --- Bottom HUD strip --- */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden items-end justify-between px-8 pb-5 lg:flex">
        <div className="glass-panel clip-notch px-4 py-3">
          <span className="hud-label block">СИСТЕМ</span>
          <span className="mt-1 flex items-center gap-2 text-xs text-foreground">
            <span className="h-1.5 w-1.5 bg-crimson animate-pulse-soft" />
            ONI HUB V3 — ОНЛАЙН
          </span>
        </div>
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <span className="hud-label">ДООШ ГҮЙЛГЭХ</span>
          <ChevronDown className="h-4 w-4 animate-pulse-soft" />
        </div>
        <div className="glass-panel clip-notch px-4 py-3 text-right">
          <span className="hud-label block">БАЙРШИЛ</span>
          <span className="mt-1 block text-xs text-foreground">УЛААНБААТАР — НОЧ / 夜</span>
        </div>
      </div>
    </section>
  );
}
