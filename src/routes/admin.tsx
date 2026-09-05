import { createFileRoute } from "@tanstack/react-router";

import { OniAdminGate } from "@/components/oni/OniAdminGate";

const description =
  "ONI CONTROL CENTER — гишүүд, гараж, анкет, уулзалт, систем ба ONI AI командын самбар. Нэвтрэлт хараахан холбогдоогүй.";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Удирдлага — ONI HUB" },
      { name: "description", content: description },
      { property: "og:title", content: "Удирдлага — ONI HUB" },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OniAdminGate,
});
