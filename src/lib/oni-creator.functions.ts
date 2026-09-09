import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

const Payload = z.object({
  idToken: z.string().min(100).max(5000),
  sourceDataUrl: z.string().min(100).max(3_500_000),
  preset: z.enum(["profile", "garage", "instagram", "meet", "crew"]),
  nickname: z.string().max(40).default(""),
  cpmId: z.string().max(40).default(""),
  note: z.string().max(500).default(""),
});

export type CreatorGenerateResult =
  | { ok: true; imageUrl: string; text: string }
  | {
      ok: false;
      code: "UNAUTHENTICATED" | "NOT_APPROVED" | "CONFIG_REQUIRED" | "GENERATION_FAILED";
      message: string;
    };

const FIREBASE_API_KEY = "AIzaSyDt0DjUhafGZ2D-co3ZhZlIde_Qe1K5trw";
const PROJECT_ID = "oni-kishin-f59b4";
const MODEL = "google/gemini-3.1-flash-image-preview";

function stringField(
  doc: { fields?: Record<string, { stringValue?: unknown }> } | null,
  key: string,
) {
  const value = doc?.fields?.[key]?.stringValue;
  return typeof value === "string" ? value : "";
}

async function approvedMember(idToken: string) {
  const authRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!authRes.ok) return { ok: false as const, code: "UNAUTHENTICATED" as const };
  const authJson = (await authRes.json()) as { users?: Array<{ localId?: string }> };
  const uid = authJson.users?.[0]?.localId;
  if (!uid) return { ok: false as const, code: "UNAUTHENTICATED" as const };
  const memberRes = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/memberAccounts/${encodeURIComponent(uid)}`,
    {
      headers: { Authorization: `Bearer ${idToken}` },
    },
  );
  if (!memberRes.ok) return { ok: false as const, code: "NOT_APPROVED" as const };
  const member = await memberRes.json();
  const status = stringField(member, "status");
  return status === "approved"
    ? { ok: true as const, uid }
    : { ok: false as const, code: "NOT_APPROVED" as const };
}

function aspect(preset: z.infer<typeof Payload>["preset"]) {
  return preset === "profile" ? "1:1" : preset === "garage" || preset === "crew" ? "16:9" : "4:5";
}

function decodeImageDataUrl(sourceDataUrl: string) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\r\n]+)$/i.exec(sourceDataUrl);
  if (!match?.[1] || !match[2]) return null;

  try {
    const data = Buffer.from(match[2].replace(/\s/g, ""), "base64");
    if (data.byteLength === 0) return null;
    return { mediaType: match[1], data };
  } catch {
    return null;
  }
}

function isGatewayConfigError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /AI_GATEWAY_API_KEY|VERCEL_OIDC_TOKEN|OIDC|authentication|credential|unauthorized|\b401\b/i.test(
    message,
  );
}

export const oniCreatorGenerate = createServerFn({ method: "POST" })
  .validator((input: unknown) => Payload.parse(input))
  .handler(async ({ data }): Promise<CreatorGenerateResult> => {
    const member = await approvedMember(data.idToken);
    if (!member.ok)
      return member.code === "UNAUTHENTICATED"
        ? {
            ok: false,
            code: "UNAUTHENTICATED",
            message: "Creator ашиглахын тулд эхлээд нэвтэрнэ үү.",
          }
        : {
            ok: false,
            code: "NOT_APPROVED",
            message: "Creator нь зөвшөөрөгдсөн ONI member-д нээлттэй.",
          };

    const sourceImage = decodeImageDataUrl(data.sourceDataUrl);
    if (!sourceImage)
      return {
        ok: false,
        code: "GENERATION_FAILED",
        message: "Оруулсан зураг уншигдсангүй. PNG эсвэл JPG зургаар дахин оролдоно уу.",
      };

    const prompt = `Edit the uploaded CPM car screenshot into a finished ONI And Kishin social asset. Return the edited image as image output, not description only. Output aspect ratio ${aspect(data.preset)}. Asset type: ${data.preset}. Member nickname: ${data.nickname || "ONI MEMBER"}${data.cpmId ? `, CPM ID ${data.cpmId}` : ""}. Preserve the exact car identity, body proportions, paint colors, decals and wheel design from the source image. Do not invent sponsor logos. ONI visual system: midnight-black cinematic environment, restrained crimson rim light, premium Japanese motorsport editorial composition, clean negative space for typography, high contrast, mobile-first social design. ${data.note || "Keep the car as the hero and make the result feel official, cinematic and premium."}`;

    try {
      // Plain-string model IDs let the AI SDK use Vercel AI Gateway's runtime OIDC
      // authentication in production. A local AI_GATEWAY_API_KEY still works as a fallback.
      const result = await generateText({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "file",
                data: sourceImage.data,
                mediaType: sourceImage.mediaType,
              },
            ],
          },
        ],
      });

      const image = result.files.find((file) => file.mediaType?.startsWith("image/"));
      if (!image)
        return {
          ok: false,
          code: "GENERATION_FAILED",
          message: "AI зураг буцаасангүй. Дахин оролдоно уу.",
        };

      const imageUrl = `data:${image.mediaType || "image/png"};base64,${Buffer.from(
        image.uint8Array,
      ).toString("base64")}`;

      return {
        ok: true,
        imageUrl,
        text: result.text.slice(0, 1200),
      };
    } catch (error) {
      console.error(
        "[oni-creator] generation error",
        error instanceof Error ? error.message : "unknown",
      );

      if (isGatewayConfigError(error))
        return {
          ok: false,
          code: "CONFIG_REQUIRED",
          message: "AI Gateway холболт идэвхгүй байна. Production OIDC/Gateway тохиргоог шалгана уу.",
        };

      return {
        ok: false,
        code: "GENERATION_FAILED",
        message: "Creator түр алдаа гаргалаа. Дахин оролдоно уу.",
      };
    }
  });
