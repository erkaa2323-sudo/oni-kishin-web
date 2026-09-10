import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FIRESTORE_ROOT =
  "https://firestore.googleapis.com/v1/projects/oni-kishin-f59b4/databases/(default)/documents";

/**
 * Fail-closed integration boundary. The Firestore virtual document enforces the
 * same current registration, slot and request.time policy as room credentials.
 * No voice room/token is issued until a real media server and expiry admission
 * policy are configured and verified. Never substitute a public conference URL.
 */
export const getMeetVoiceAvailability = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ idToken: z.string().min(100).max(5000) }).parse(input))
  .handler(async ({ data }): Promise<{ code: "DENIED" | "CONFIG_REQUIRED" | "UNAVAILABLE" }> => {
    try {
      const response = await fetch(`${FIRESTORE_ROOT}/meetVoiceAuthorization/current`, {
        headers: { Authorization: `Bearer ${data.idToken}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 401 || response.status === 403) return { code: "DENIED" };
      // This path is deliberately never written. Missing + authorized is 404;
      // a denied read of a missing document is 403, tested in the Rules emulator.
      if (response.status !== 404) return { code: "UNAVAILABLE" };
      const body = (await response.json()) as { error?: { status?: string } };
      return body.error?.status === "NOT_FOUND"
        ? { code: "CONFIG_REQUIRED" }
        : { code: "UNAVAILABLE" };
    } catch {
      return { code: "UNAVAILABLE" };
    }
  });
