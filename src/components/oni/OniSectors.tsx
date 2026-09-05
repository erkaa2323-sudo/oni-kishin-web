import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import crewScene from "@/assets/crew/crew-hall.jpg";
import garageScene from "@/assets/garage/garage-bay.jpg";
import cityScene from "@/assets/oni-city-2099.webp";
import { ONI_DESTINATIONS } from "@/lib/oni-nav";

const IMAGES = [crewScene, garageScene, cityScene] as const;

export function OniSectors() {
  const sectors = ONI_DESTINATIONS.filter((destination) => destination.to !== "/");

  return (
    <section aria-labelledby="oni-sectors-title" className="oni-world-map">
      <div className="oni-world-map__heading">
        <p className="hud-label text-crimson">SELECT DESTINATION</p>
        <h2 id="oni-sectors-title">ХОТ ЧАМАЙГ ХҮЛЭЭЖ БАЙНА.</h2>
        <p>Дараагийн орчноо сонго. Хэсэг бүр ONI ертөнцийн өөр түүхийг нээнэ.</p>
      </div>

      <div className="oni-world-map__destinations">
        {sectors.map((destination, index) => (
          <Link key={destination.to} to={destination.to} className="oni-destination">
            <img src={IMAGES[index % IMAGES.length]} alt="" aria-hidden="true" loading="lazy" />
            <span className="oni-destination__shade" />
            <span className="oni-destination__number">{destination.index}</span>
            <span className="oni-destination__copy">
              <small>{destination.code}</small>
              <strong>{destination.label}</strong>
              <span>{destination.desc}</span>
            </span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}
