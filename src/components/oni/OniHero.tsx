import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUpRight, Crosshair, Radio, ShieldCheck } from "lucide-react";

import cityBg from "@/assets/oni-city-bg.jpg";
import oniCar from "@/assets/garage/car-01.webp";
import oniCharacter from "@/assets/oni-character.webp";
import { useParallax } from "./useParallax";

const telemetry = [["NODE", "UB-00"], ["SYNC", "99.7%"], ["STATUS", "ACTIVE"]] as const;

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
      <div className="oni-command__grid" aria-hidden="true" />
      <div className="oni-command__flare" aria-hidden="true" />
      <div className="oni-command__title" aria-hidden="true"><span>ONI</span><span>CITY</span></div>

      <div className="oni-command__car" style={layer(0.72)}>
        <img src={oniCar} alt="ОНИ секторын JDM машин" width={1536} height={1024} decoding="async" />
      </div>
      <div className="oni-command__subject" style={layer(1.15)}>
        <div className="oni-command__halo" aria-hidden="true"><span /><span /><span /></div>
        <img src={oniCharacter} alt="ОНИ хотын гол дүр" width={1024} height={1536} fetchPriority="high" />
        <div className="oni-command__target" aria-hidden="true"><Crosshair /></div>
      </div>
      <div className="oni-command__frame" aria-hidden="true" />
      <div className="oni-command__noise" aria-hidden="true" />

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
        <aside className="oni-command__telemetry" aria-label="Системийн мэдээлэл">
          <div className="flex items-center justify-between border-b border-white/10 pb-3"><span className="hud-label">LIVE TELEMETRY</span><Radio className="h-3.5 w-3.5 text-crimson" /></div>
          {telemetry.map(([key, value]) => <div key={key} className="oni-telemetry-row"><span>{key}</span><b>{value}</b></div>)}
          <div className="oni-command__signal"><i /><i /><i /><i /><i /><i /></div>
        </aside>
        <div className="oni-command__rail"><span>PROTOCOL / KISHIN</span><span>•</span><span>IDENTITY / ONI</span><span>•</span><span>未来都市</span></div>
        <div className="oni-command__bottom">
          <div><ShieldCheck className="h-4 w-4 text-crimson" /><span>NETWORK SECURE</span></div>
          <a href="#oni-creed" aria-label="Доош гүйлгэх"><ArrowDown className="h-4 w-4" /><span>EXPLORE</span></a>
          <span>43°N / 106°E</span>
        </div>
      </div>
    </section>
  );
}
