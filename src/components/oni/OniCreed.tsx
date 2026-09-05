import cityBg from "@/assets/oni-city-bg.jpg";
import { CLAN_NAME } from "@/lib/oni-nav";

const CREED = [
  {
    kicker: "一 / НЭГ",
    title: "НЭГ ТЭМДЭГ",
    body: "Они болон Кишин — нэг тэмдгийн дор нэгдсэн жолооч, бүтээгчид, урлагчид.",
  },
  {
    kicker: "二 / ХОЁР",
    title: "ШӨНИЙН ЗАМ",
    body: "Хотын шөнө бол бидний талбар. Хурд биш, хэв маяг, хүндлэл эхэнд.",
  },
  {
    kicker: "三 / ГУРАВ",
    title: "БҮТЭЭХ СЭТГЭЛ",
    body: "Машин, хөгжим, дүрс — бүх бүтээл нэг л ертөнцийн хэлээр ярина.",
  },
];

/** Editorial creed band — establishes the clan's tone between hero and directory. */
export function OniCreed() {
  return (
    <section
      aria-labelledby="oni-creed-title"
      className="relative overflow-hidden border-t border-border bg-ink py-20 sm:py-28"
    >
      <img
        src={cityBg}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        width={1920}
        height={1088}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--gradient-vignette)" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-ink/55" />

      <div className="relative mx-auto max-w-[110rem] px-5 sm:px-8">
        <span className="hud-label hud-rule block pl-11 text-crimson/85">CREED / ЗАРЧИМ</span>
        <h2
          id="oni-creed-title"
          className="mt-4 max-w-3xl text-cinema text-4xl text-foreground sm:text-6xl"
        >
          {CLAN_NAME.toUpperCase()} — ХОТЫН ДОР
        </h2>

        <div className="mt-14 grid gap-px bg-border sm:grid-cols-3">
          {CREED.map((c) => (
            <article key={c.title} className="bg-ink/70 p-6 backdrop-blur-sm sm:p-8">
              <span className="hud-label text-crimson/80">{c.kicker}</span>
              <h3 className="mt-4 text-cinema text-2xl text-foreground sm:text-3xl">{c.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
