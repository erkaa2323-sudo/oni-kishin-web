import { createFileRoute } from "@tanstack/react-router";

import { OniGarageStage } from "@/components/oni/OniGarageStage";

const description =
  "Кланы автомашины цуглуулга: засвар, тохируулга, зураг. Гараж хэсэг тусдаа модуль болж нээгдэнэ.";

export const Route = createFileRoute("/garage")({
  head: () => ({
    meta: [
      { title: "Гараж — ONI HUB" },
      { name: "description", content: description },
      { property: "og:title", content: "Гараж — ONI HUB" },
      { property: "og:description", content: description },
    ],
  }),
  component: OniGarageStage,
});
