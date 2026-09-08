import { createFileRoute } from "@tanstack/react-router";

import { OniProfileStage } from "@/components/oni/OniProfileStage";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — ONI HUB" },
      {
        name: "description",
        content: "Crew account, XP, ONI Coin, Meet болон achievement мэдээллийн Profile хэсэг.",
      },
    ],
  }),
  component: OniProfileStage,
});
