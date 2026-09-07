import { OniAuthProvider } from "@/hooks/useOniAuth";
import { OniAdminCopilot } from "./OniAdminCopilot";
import { OniAdminGate } from "./OniAdminGate";

export function OniAdminPage() {
  return (
    <div className="relative">
      <OniAdminGate />
      <OniAuthProvider>
        <OniAdminCopilot />
      </OniAuthProvider>
    </div>
  );
}
