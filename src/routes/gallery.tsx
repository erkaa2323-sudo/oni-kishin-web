import { createFileRoute } from "@tanstack/react-router";

import { OniGalleryStage } from "@/components/oni/OniGalleryStage";

const description =
  "Oni And Kishin кланы уулзалт, машин болон шөнийн дурсамжийн албан ёсны галерей.";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Галерей — ONI HUB" },
      { name: "description", content: description },
      { property: "og:title", content: "Галерей — ONI HUB" },
      { property: "og:description", content: description },
    ],
  }),
  component: OniGalleryStage,
});
