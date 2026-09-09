import { createFileRoute } from "@tanstack/react-router";
import { OniProgressionStage } from "@/components/oni/OniProgressionStage";

export const Route = createFileRoute("/progression")({
  head: () => ({
    meta: [
      { title: "ONI Progression — ONI NEXUS" },
      {
        name: "description",
        content: "ONI XP, ONI Coin, Rank, achievements болон Season Reputation.",
      },
    ],
  }),
  component: OniProgressionStage,
});
