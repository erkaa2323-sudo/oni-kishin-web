import { createFileRoute } from "@tanstack/react-router";

import { OniCrewStage } from "@/components/oni/OniCrewStage";

const description =
  "Oni And Kishin кланы гишүүдийн бүртгэл, зэрэглэл, үүрэг. Гишүүдийн профайл энд нэгтгэгдэнэ.";

export const Route = createFileRoute("/crew")({
  head: () => ({
    meta: [
      { title: "Бүрэлдэхүүн — ONI HUB" },
      { name: "description", content: description },
      { property: "og:title", content: "Бүрэлдэхүүн — ONI HUB" },
      { property: "og:description", content: description },
    ],
  }),
  component: OniCrewStage,
});
