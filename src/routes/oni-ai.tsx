import { createFileRoute } from "@tanstack/react-router";

import { OniAiChamber } from "@/components/oni/OniAiChamber";
import { OniRigBridge } from "@/components/oni/OniRigBridge";
import "@/components/oni/OniCharacterAlive.css";

const description =
  "Oni Shizuki — кланы AI туслах, хөгжим болон AI Creator Studio нэгтгэсэн команд танхим.";

function OniAiRoute() {
  return (
    <>
      <OniAiChamber />
      <OniRigBridge />
    </>
  );
}

export const Route = createFileRoute("/oni-ai")({
  head: () => ({
    meta: [
      { title: "Oni Shizuki · Chat + Create — ONI HUB" },
      { name: "description", content: description },
      { property: "og:title", content: "Oni Shizuki · Chat + Create — ONI HUB" },
      { property: "og:description", content: description },
    ],
  }),
  component: OniAiRoute,
});
