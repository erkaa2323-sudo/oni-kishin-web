import { createFileRoute } from "@tanstack/react-router";

import "@/services/application-workflow";
import { OniAdminPage } from "@/components/oni/OniAdminPage";

const description =
  "ONI HUB удирдлагын төв — гишүүд, элсэлтийн анкет, гишүүний нэвтрэх хүсэлт, гараж, уулзалт, эдийн засаг, шагнал, контент, системийн бүртгэл болон ONI админ туслах.";

function AdminRoutePage() {
  return <OniAdminPage />;
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
