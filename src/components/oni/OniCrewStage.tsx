import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Crown, Radio } from "lucide-react";

import crewHall from "@/assets/crew/crew-hall.jpg";
import { CREW_ROLES, CREW_STATUS_LABEL, fetchCrew, type CrewMember, type CrewRoleId } from "@/data/crew";
import { OniHudNav } from "./OniHudNav";
import { OniFooter } from "./OniFooter";

type Filter = CrewRoleId | "all";

export function OniCrewStage() {
  const [roster, setRoster] = useState<CrewMember[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    let alive = true;
    void fetchCrew().then((result) => {
      if (!alive) return;
      if (result.status === "error") {
        setLoadState("error");
        setLoadError(result.reason);
        return;
      }
      setRoster(result.rows);
      setActiveId(result.rows[0]?.id ?? "");
      setLoadState("ready");
    });
    return () => { alive = false; };
  }, []);

  const visible = useMemo(() => filter === "all" ? roster : roster.filter((member) => member.roleId === filter), [roster, filter]);
  const active = roster.find((member) => member.id === activeId) ?? visible[0] ?? roster[0];
  const activeIndex = visible.findIndex((member) => member.id === active?.id);

  const selectFilter = (nextFilter: Filter) => {
    setFilter(nextFilter);
    const next = nextFilter === "all" ? roster : roster.filter((member) => member.roleId === nextFilter);
    if (next.length && !next.some((member) => member.id === activeId)) setActiveId(next[0]!.id);
  };

  const step = (direction: -1 | 1) => {
    if (!visible.length) return;
    const nextIndex = (Math.max(0, activeIndex) + direction + visible.length) % visible.length;
    setActiveId(visible[nextIndex]!.id);
  };

  return (
    <div className="min-h-screen bg-ink">
      <OniHudNav />
      <main>
        <section className="crew-select" aria-labelledby="crew-title">
          <img className="crew-select__hall" src={crewHall} alt="" aria-hidden="true" width={1920} height={1088} fetchPriority="high" />
          {active?.portrait ? <img key={`echo-${active.id}`} className="crew-select__echo" src={active.portrait} alt="" aria-hidden="true" /> : null}
          <div className="crew-select__atmosphere" aria-hidden="true" />

          <header className="crew-select__heading">
            <div>
              <p>ONI ARCHIVE · БҮРЭЛДЭХҮҮН</p>
              <h1 id="crew-title">ДҮРЭЭ СОНГО.</h1>
            </div>
            <span>{loadState === "ready" ? `${String(visible.length).padStart(2, "0")} / ${String(roster.length).padStart(2, "0")}` : "— / —"}</span>
          </header>

          <nav className="crew-select__roles" aria-label="Үүргээр шүүх">
            {[{ id: "all" as const, label: "БҮГД" }, ...CREW_ROLES].map((role) => (
              <button key={role.id} type="button" aria-pressed={filter === role.id} onClick={() => selectFilter(role.id as Filter)}>{role.label}</button>
            ))}
          </nav>

          {loadState !== "ready" || !roster.length ? (
            <div className="crew-select__state">
              <strong>{loadState === "loading" ? "БҮРЭЛДЭХҮҮН АЧААЛЖ БАЙНА" : loadState === "error" ? "ХОЛБОЛТЫН АЛДАА" : "БҮРТГЭЛ ХООСОН"}</strong>
              <p>{loadState === "loading" ? "ONI архивтай холбогдож байна…" : loadState === "error" ? loadError : "Идэвхтэй гишүүн бүртгэгдээгүй байна."}</p>
            </div>
          ) : active ? (
            <div className="crew-select__stage">
              <article key={`info-${active.id}`} className="crew-select__identity">
                <div className="crew-select__status"><Radio />{CREW_STATUS_LABEL[active.status]}</div>
                <p className="crew-select__role">{CREW_ROLES.find((role) => role.id === active.roleId)?.label ?? active.roleId}</p>
                <h2>{active.callsign}</h2>
                {active.kana ? <span className="crew-select__kana">{active.kana}</span> : null}
                <h3>{active.title}</h3>
                <p className="crew-select__bio">{active.bio}</p>
                <dl>
                  {active.traits.map((trait) => <div key={trait.label}><dt>{trait.label}</dt><dd>{trait.value}</dd></div>)}
                </dl>
              </article>

              <div key={`portrait-${active.id}`} className="crew-select__portrait">
                {active.portrait ? <img src={active.portrait} alt={`${active.callsign} — ${active.title}`} width={1024} height={1536} decoding="async" /> : <span>ЗУРАГ БАЙХГҮЙ</span>}
              </div>

              <aside className="crew-select__chapter" aria-label="Сонгосон гишүүний дугаар">
                <Crown /><span>SELECTED</span><strong>{String(activeIndex + 1).padStart(2, "0")}</strong><small>{active.roleId.toUpperCase()}</small>
              </aside>
            </div>
          ) : null}

          {loadState === "ready" && roster.length ? (
            <div className="crew-select__roster">
              <button type="button" onClick={() => step(-1)} aria-label="Өмнөх гишүүн"><ChevronLeft /></button>
              <div className="crew-select__faces">
                {visible.map((member, index) => (
                  <button key={member.id} type="button" aria-pressed={member.id === active?.id} onClick={() => setActiveId(member.id)}>
                    {member.portrait ? <img src={member.portrait} alt="" aria-hidden="true" loading="lazy" /> : <span>?</span>}
                    <small>{String(index + 1).padStart(2, "0")}</small>
                    <strong>{member.callsign}</strong>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => step(1)} aria-label="Дараагийн гишүүн"><ChevronRight /></button>
            </div>
          ) : null}
        </section>
      </main>
      <OniFooter />
    </div>
  );
}
