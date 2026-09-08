import { readFileSync, writeFileSync } from "node:fs";

const gatePath = "src/components/oni/OniAdminGate.tsx";
const pagePath = "src/components/oni/OniAdminPage.tsx";
const routePath = "src/routes/admin.tsx";

let gate = readFileSync(gatePath, "utf8");

const gateBodyBefore = "function GateBody() {";
const gateBodyAfter = "function GateBody({ children }: { children?: React.ReactNode }) {";
if (!gate.includes(gateBodyBefore) && !gate.includes(gateBodyAfter)) {
  throw new Error("OniAdminGate GateBody signature changed unexpectedly");
}
gate = gate.replace(gateBodyBefore, gateBodyAfter);

const authorizedBefore = `  return (\n    <>\n      <OniControlCenter />\n      <OniEventRewardDock />\n    </>\n  );`;
const authorizedAfter = `  return (\n    <>\n      <OniControlCenter />\n      <OniEventRewardDock />\n      {children}\n    </>\n  );`;
if (!gate.includes(authorizedBefore) && !gate.includes(authorizedAfter)) {
  throw new Error("OniAdminGate authorized render changed unexpectedly");
}
gate = gate.replace(authorizedBefore, authorizedAfter);

const exportBefore = `export function OniAdminGate() {\n  return (\n    <OniAuthProvider>\n      <GateBody />\n    </OniAuthProvider>\n  );\n}`;
const exportAfter = `export function OniAdminGate({ children }: { children?: React.ReactNode }) {\n  return (\n    <OniAuthProvider>\n      <GateBody>{children}</GateBody>\n    </OniAuthProvider>\n  );\n}`;
if (!gate.includes(exportBefore) && !gate.includes(exportAfter)) {
  throw new Error("OniAdminGate export changed unexpectedly");
}
gate = gate.replace(exportBefore, exportAfter);
writeFileSync(gatePath, gate);

const page = `import { OniAdminCopilot } from "./OniAdminCopilot";\nimport { OniAdminGate } from "./OniAdminGate";\nimport { OniCreatorReviewDock } from "./OniCreatorReviewDock";\nimport { OniEconomyAdminDock } from "./OniEconomyAdminDock";\n\nexport function OniAdminPage() {\n  return (\n    <div className="relative">\n      <OniAdminGate>\n        <OniAdminCopilot />\n        <OniCreatorReviewDock />\n        <OniEconomyAdminDock />\n      </OniAdminGate>\n    </div>\n  );\n}\n`;
writeFileSync(pagePath, page);

const route = `import { createFileRoute } from "@tanstack/react-router";\n\nimport "@/services/application-workflow";\nimport { OniAdminPage } from "@/components/oni/OniAdminPage";\n\nconst description =\n  "ONI CONTROL CENTER — Firebase нэвтрэлттэй гишүүд, гараж, анкет, уулзалт, economy, progression reward ба Live2D ONI AI админ copilot.";\n\nfunction AdminRoutePage() {\n  return <OniAdminPage />;\n}\n\nexport const Route = createFileRoute("/admin")({\n  head: () => ({\n    meta: [\n      { title: "Удирдлага — ONI HUB" },\n      { name: "description", content: description },\n      { property: "og:title", content: "Удирдлага — ONI HUB" },\n      { property: "og:description", content: description },\n      { name: "robots", content: "noindex" },\n    ],\n  }),\n  component: AdminRoutePage,\n});\n`;
writeFileSync(routePath, route);

console.log("FINAL_ADMIN_AUTH_GATE_OK");
