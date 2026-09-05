import { createFileRoute } from "@tanstack/react-router";

import { OniAiChamber } from "@/components/oni/OniAiChamber";

const description = "ONI Brain туслах ба кланы хөгжмийн систем нэгдсэн команд танхим.";

export const Route = createFileRoute("/oni-ai")({
  head: () => ({
    meta: [
      { title: "Они АЙ + Хөгжим — ONI HUB" },
      { name: "description", content: description },
      { property: "og:title", content: "Они АЙ + Хөгжим — ONI HUB" },
      { property: "og:description", content: description },
    ],
  }),
  component: OniAiChamber,
});
