import { createFileRoute } from "@tanstack/react-router";

import { OniStreetOpsStage } from "@/components/oni/OniStreetOpsStage";

const description =
  "ONI WORLD: Crew, Garage DNA, Meet, Event болон ONI AI-г нэг digital city experience дотор холбосон кланы үндсэн ертөнц.";

export const Route = createFileRoute("/street-ops")({
  head: () => ({
    meta: [
      { title: "ONI WORLD — ONI HUB" },
      { name: "description", content: description },
      { property: "og:title", content: "ONI WORLD — ONI HUB" },
      { property: "og:description", content: description },
    ],
  }),
  component: OniStreetOpsStage,
});
