import { OniAuthProvider } from "@/hooks/useOniAuth";
import { OniAdminCopilot } from "./OniAdminCopilot";
import { OniAdminGate } from "./OniAdminGate";
import { OniCreatorReviewDock } from "./OniCreatorReviewDock";

export function OniAdminPage() {
  return (
    <div className="relative">
      <OniAdminGate />
      <OniAuthProvider>
        <OniAdminCopilot />
      </OniAuthProvider>
      <OniCreatorReviewDock />
    </div>
  );
}
