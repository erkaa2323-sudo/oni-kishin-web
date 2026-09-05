import { createFileRoute } from "@tanstack/react-router";

import { OniMeetAccess } from "@/components/oni/OniMeetAccess";

const description =
  "ONI MEET — баталгаажсан гишүүдэд зориулсан хаалттай уулзалтын хандалт. CPM нэр болон CPM ID-гаар баталгаажуулна.";

export const Route = createFileRoute("/meet")({
  head: () => ({
    meta: [
      { title: "Уулзалт — ONI MEET хандалт | ONI HUB" },
      { name: "description", content: description },
      { property: "og:title", content: "Уулзалт — ONI MEET хандалт | ONI HUB" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OniMeetAccess,
});
