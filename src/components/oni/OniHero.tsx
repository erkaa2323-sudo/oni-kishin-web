import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUpRight, ShieldCheck } from "lucide-react";

import cityBg from "@/assets/oni-city-2099.webp";
import oniCar from "@/assets/garage/car-01.webp";
import oniCharacter from "@/assets/oni-character.webp";
import { useParallax } from "./useParallax";

export function OniHero() {
  const { px, py, sp } = useParallax();
  const layer = (depth: number, extraY = 0) => ({
    transform: `translate3d(${px * depth * -16}px, ${py * depth * -9 + sp * depth * 34 + extraY}px, 0)`,
  });

  return (
    <section className="oni-command" aria-labelledby="oni-hero-title">
      <div className="oni-command__city" style={{ ...layer(0.28), scale: "1.08" }}>
        <img src={cityBg} alt="2099 оны ОНИ хотын шөнийн сектор" width={1920} height={1088} fetchPriority="high" />
      </div>
      <div className="oni-command__flare" aria-hidden="true" />
      <div className="oni-command__rain" aria-hidden="true" />
      <div className="oni-command__fog oni-command__fog--one" aria-hidden="true" />
      <div className="oni-command__fog oni-command__fog--two" aria-hidden="true" />
      <div className="oni-command__title" aria-hidden="true"><span>ONI</span><span>CITY</span></div>

      <div className="oni-command__car" style={layer(0.72)}>
        <img src={oniCar} alt="ОНИ секторын JDM машин" width={1536} height={1024} decoding="async" />
      </div>
      <div className="oni-command__subject" style={layer(1.15)}>
        <img src={oniCharacter} alt="ОНИ хотын гол дүр" width={1024} height={1536} fetchPriority="high" />
      </div>

      <div className="oni-command__ui">
        <div className="oni-command__eyebrow"><span className="oni-live-dot" /><span>ONI NETWORK / 2099</span><span className="hidden sm:inline">鬼神都市</span></div>
        <div className="oni-command__copy">
          <p className="hud-label text-crimson">SECTOR 00 · ULAANBAATAR</p>
          <h1 id="oni-hero-title"><span>БИД ХОТЫГ</span><strong>СЭРЭЭНЭ.</strong></h1>
          <p className="oni-command__lede">Машин, анимэ, хөгжим, нөхөрлөл — нэг ертөнцөд. ONI AND KISHIN бол Монголын шөнийн шинэ дижитал домог.</p>
          <div className="oni-command__actions">
            <Link to="/join" className="oni-primary-action">СИСТЕМД НЭГДЭХ <ArrowUpRight className="h-4 w-4" /></Link>
            <Link to="/crew" className="oni-secondary-action">ДҮРҮҮДИЙГ НЭЭХ</Link>
          </div>
        </div>
        <aside className="oni-command__chapter" aria-label="ОНИ хотын бүлэг">
          <span>CHAPTER</span><strong>00</strong><small>THE CITY<br />AWAKENS</small>
        </aside>
        <div className="oni-command__bottom">
          <div><ShieldCheck className="h-4 w-4 text-crimson" /><span>NETWORK SECURE</span></div>
          <a href="#oni-creed" aria-label="Доош гүйлгэх"><ArrowDown className="h-4 w-4" /><span>ENTER CITY</span></a>
          <span>43°N / 106°E</span>
        </div>
      </div>
    </section>
  );
}
