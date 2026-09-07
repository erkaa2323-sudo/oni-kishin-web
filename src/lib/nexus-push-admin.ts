import { firebaseAuth } from "@/integrations/firebase/client";
import { sendNexusMeetPush, type NexusMeetPushResult } from "@/lib/nexus-push.functions";

export async function announceNexusMeet(meetTitle: string): Promise<NexusMeetPushResult> {
  const user = firebaseAuth.currentUser;
  if (!user) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Push илгээх админ нэвтрэлт олдсонгүй." };
  }
  const idToken = await user.getIdToken();
  return sendNexusMeetPush({
    data: {
      idToken,
      meetTitle: meetTitle.trim() || "ONI MEET",
      url: "/meet",
    },
  });
}
