import { useEffect, useState } from "react";
import { firebaseAuth } from "@/integrations/firebase/client";
import { getMeetVoiceAvailability } from "@/lib/meet-voice.functions";

/** No pretend join control: a media provider has not been configured yet. */
export function MeetVoice({ authorized }: { authorized: boolean }) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    setMessage("");
    if (!authorized) return;
    const user = firebaseAuth.currentUser;
    if (!user) return;
    void user
      .getIdToken()
      .then(async (idToken) => {
        const result = await getMeetVoiceAvailability({ data: { idToken } });
        if (cancelled) return;
        setMessage(
          result.code === "CONFIG_REQUIRED"
            ? "Хувийн Voice үйлчилгээ хараахан холбогдоогүй байна."
            : result.code === "DENIED"
              ? "Voice хандалт хаалттай. Meet бүртгэл болон хугацаагаа шалгана уу."
              : "Voice үйлчилгээг шалгах боломжгүй байна.",
        );
      })
      .catch(() => {
        if (!cancelled) setMessage("Voice үйлчилгээг шалгах боломжгүй байна.");
      });
    return () => {
      cancelled = true;
    };
  }, [authorized]);
  if (!authorized || !message) return null;
  return (
    <p role="status" className="mt-4 break-words text-sm text-muted-foreground">
      {message}
    </p>
  );
}
