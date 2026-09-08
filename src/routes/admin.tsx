import { createFileRoute } from "@tanstack/react-router";

import "@/services/application-workflow";
import { OniAdminPage } from "@/components/oni/OniAdminPage";
import { OniEventRewardDock } from "@/components/oni/OniEventRewardDock";
import { OniEconomyAdminDock } from "@/components/oni/OniEconomyAdminDock";

const description =
  "ONI CONTROL CENTER — Firebase нэвтрэлттэй гишүүд, гараж, анкет, уулзалт, economy, progression reward ба Live2D ONI AI админ copilot.";

function AdminRoutePage() {
  return <><OniAdminPage /><OniEconomyAdminDock /><OniEventRewardDock /></>;
}

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
  component: AdminRoutePage,
});
