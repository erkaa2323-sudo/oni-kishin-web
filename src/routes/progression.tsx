import { createFileRoute } from "@tanstack/react-router";
import { OniProgressionStage } from "@/components/oni/OniProgressionStage";

export const Route = createFileRoute("/progression")({
  head: () => ({ meta: [
    { title: "ONI Progression — ONI NEXUS" },
    { name: "description", content: "ONI XP, ONI Coin, Rank, Vault cosmetics, Collection болон Season Reputation." },
  ] }),
  component: OniProgressionStage,
});
