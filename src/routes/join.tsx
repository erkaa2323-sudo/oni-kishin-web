import { createFileRoute } from "@tanstack/react-router";

import { OniJoinRequestV2 } from "@/components/oni/OniJoinRequestV2";

const description =
  "Oni And Kishin кланд нэгдэх хүсэлтээ 4 ойлгомжтой алхмаар бөглөж, илгээсний дараа хүсэлтийн төлөвөө шалгаарай.";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Нэгдэх хүсэлт | ONI HUB" },
      { name: "description", content: description },
      { property: "og:title", content: "Нэгдэх хүсэлт | ONI HUB" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OniJoinRequestV2,
});
