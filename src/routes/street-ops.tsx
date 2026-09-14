import { createFileRoute } from "@tanstack/react-router";

import { OniStreetOpsStage } from "@/components/oni/OniStreetOpsStage";

const description =
  "ONI WORLD 2099: 360° хөдөлдөг 3D megacity дотор Crew, Garage, Meet, Event болон ONI AI district-үүдийг нэг амьд world experience болгон холбосон кланы үндсэн ертөнц.";

export const Route = createFileRoute("/street-ops")({
  head: () => ({
    meta: [
      { title: "ONI WORLD 2099 — 3D MEGACITY" },
      { name: "description", content: description },
      { property: "og:title", content: "ONI WORLD 2099 — 3D MEGACITY" },
      { property: "og:description", content: description },
    ],
  }),
  component: OniStreetOpsStage,
});
