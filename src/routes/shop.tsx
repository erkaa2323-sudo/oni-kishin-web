import { createFileRoute } from "@tanstack/react-router";
import { OniProgressionStage } from "@/components/oni/OniProgressionStage";
import { OniVaultPreviewDock } from "@/components/oni/OniVaultPreviewDock";

function ShopRoute() {
  return (
    <>
      <OniProgressionStage />
      <OniVaultPreviewDock />
    </>
  );
}

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "ONI Shop — ONI HUB" },
      {
        name: "description",
        content: "ONI Coin-оор cosmetic effect unlock хийж, equip хийх ONI Shop.",
      },
    ],
  }),
  component: ShopRoute,
});
