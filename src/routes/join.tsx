import { createFileRoute } from "@tanstack/react-router";

import { OniJoinProtocol } from "@/components/oni/OniJoinProtocol";

const description =
  "Oni And Kishin кланд элсэх хүсэлт. CPM мэдээлэл, туршлага, холбоо барих сувгаа бөглөж элсэлтийн протоколд нэгдээрэй.";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Нэгдэх — Элсэлтийн протокол | ONI HUB" },
      { name: "description", content: description },
      { property: "og:title", content: "Нэгдэх — Элсэлтийн протокол | ONI HUB" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OniJoinProtocol,
});
