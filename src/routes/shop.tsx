import { createFileRoute } from "@tanstack/react-router";
import { OniShopV2Stage } from "@/components/oni/OniShopV2Stage";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "ONI Shop V2 — ONI HUB" },
      {
        name: "description",
        content: "ONI Coin-оор Car Parking Multiplayer үйлчилгээ худалдан авах ONI Shop V2.",
      },
    ],
  }),
  component: OniShopV2Stage,
});