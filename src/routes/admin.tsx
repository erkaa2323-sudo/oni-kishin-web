import { createFileRoute } from "@tanstack/react-router";

import "@/services/application-workflow";
import { OniAdminPage } from "@/components/oni/OniAdminPage";

const description =
  "ONI HUB Admin V3 — гишүүд, хүсэлт, Meet, эдийн засаг, контент, системийн төлөв болон audit-ийг нэг цэгээс удирдах төв.";

function AdminRoutePage() {
  return <OniAdminPage />;
}

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin V3 — ONI HUB" },
      { name: "description", content: description },
      { property: "og:title", content: "Admin V3 — ONI HUB" },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminRoutePage,
});
