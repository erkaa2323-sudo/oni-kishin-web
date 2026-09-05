import { createFileRoute } from "@tanstack/react-router";

import { OniHudNav } from "@/components/oni/OniHudNav";
import { OniHero } from "@/components/oni/OniHero";
import { OniCreed } from "@/components/oni/OniCreed";
import { OniSectors } from "@/components/oni/OniSectors";
import { OniFooter } from "@/components/oni/OniFooter";

const TITLE = "ONI HUB — Oni And Kishin кланы төв";
const DESCRIPTION =
  "ОНИ ХОТ — Монголын CPM клан Oni And Kishin-ийн албан ёсны дижитал төв. Бүрэлдэхүүн, гараж, хөгжим, уулзалт нэг дор.";

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
        <OniHero />
        <OniCreed />
        <OniSectors />
      </main>
      <OniFooter />
    </div>
  );
}
