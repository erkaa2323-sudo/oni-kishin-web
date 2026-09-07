import { createFileRoute } from "@tanstack/react-router";

import { OniAiChamber } from "@/components/oni/OniAiChamber";
import { OniRigBridge } from "@/components/oni/OniRigBridge";
import "@/components/oni/OniCharacterAlive.css";

const description = "Oni Shizuki туслах ба кланы хөгжмийн систем нэгдсэн команд танхим.";

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
      { title: "Они АЙ + Хөгжим — ONI HUB" },
      { name: "description", content: description },
      { property: "og:title", content: "Они АЙ + Хөгжим — ONI HUB" },
      { property: "og:description", content: description },
    ],
  }),
  component: OniAiRoute,
});