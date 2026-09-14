import { createFileRoute } from "@tanstack/react-router";

import { OniHudNav } from "@/components/oni/OniHudNav";
import { OniCinematicHome2 } from "@/components/oni/OniCinematicHome2";
import { OniCreed } from "@/components/oni/OniCreed";
import { OniSectors } from "@/components/oni/OniSectors";
import { OniFooter } from "@/components/oni/OniFooter";

const TITLE = "ONI HUB — Cinematic Home 2.0";
const DESCRIPTION =
  "ОНИ ХОТ — Oni And Kishin-ийн cinematic digital world. ONI ID, Garage DNA, ONI WORLD, Meet болон кланы бүх систем нэг ертөнцөд.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="bg-ink">
      <OniHudNav />
      <main>
        <OniCinematicHome2 />
        <OniCreed />
        <OniSectors />
      </main>
      <OniFooter />
    </div>
  );
}
