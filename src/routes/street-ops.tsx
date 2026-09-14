import { createFileRoute } from "@tanstack/react-router";

import { OniStreetOpsStage } from "@/components/oni/OniStreetOpsStage";

const description =
  "ONI Street Ops: live Meet operation, registered crew, Garage DNA machines болон event win activity-г нэг command board дээр харуулна.";

export const Route = createFileRoute("/street-ops")({
  head: () => ({
    meta: [
      { title: "Street Ops — ONI HUB" },
      { name: "description", content: description },
      { property: "og:title", content: "Street Ops — ONI HUB" },
      { property: "og:description", content: description },
    ],
  }),
  component: OniStreetOpsStage,
});
