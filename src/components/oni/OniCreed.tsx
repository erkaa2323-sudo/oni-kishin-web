import cityBg from "@/assets/oni-city-2099.webp";
import oniCharacter from "@/assets/oni-character.webp";

const CREED = [
  ["01", "НЭГ ТЭМДЭГ", "Они болон Кишин — нэг тэмдгийн дор нэгдсэн жолооч, бүтээгчид, урлагчид."],
  ["02", "ШӨНИЙН ЗАМ", "Хотын шөнө бол бидний талбар. Хурд биш, хэв маяг, хүндлэл эхэнд."],
  ["03", "БҮТЭЭХ СЭТГЭЛ", "Машин, хөгжим, дүрс — бүх бүтээл нэг ертөнцийн хэлээр ярина."],
] as const;

export function OniCreed() {
  return (
    <section id="oni-creed" aria-labelledby="oni-creed-title" className="oni-creed-scene">
      <img src={cityBg} alt="" aria-hidden="true" loading="lazy" width={2400} height={1350} />
      <div className="oni-creed-scene__character" aria-hidden="true">
        <img src={oniCharacter} alt="" loading="lazy" width={1024} height={1536} />
      </div>
      <div className="oni-creed-scene__content">
        <p className="hud-label text-crimson">ONI / KISHIN MANIFESTO</p>
        <h2 id="oni-creed-title">БИД ЗҮГЭЭР НЭГ КЛАН БИШ.</h2>
        <p className="oni-creed-scene__intro">Бид өөрсдийн хот, өөрсдийн дүр төрх, өөрсдийн домгийг бүтээж байна.</p>
        <div className="oni-creed-scene__principles">
          {CREED.map(([number, title, body]) => (
            <article key={number}>
              <span>{number}</span>
              <div><h3>{title}</h3><p>{body}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
