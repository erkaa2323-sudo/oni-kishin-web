import { createServerFn } from "@tanstack/react-start";
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
const CLOUDFLARE_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";

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

function outputSize(preset: z.infer<typeof Payload>["preset"]) {
  if (preset === "profile") return { width: 768, height: 768 };
  if (preset === "garage" || preset === "crew") return { width: 1024, height: 576 };
  return { width: 768, height: 960 };
}

function decodeImageDataUrl(sourceDataUrl: string) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\r\n]+)$/i.exec(sourceDataUrl);
  if (!match?.[1] || !match[2]) return null;

  try {
    const base64 = match[2].replace(/\s/g, "");
    const data = Buffer.from(base64, "base64");
    if (data.byteLength === 0) return null;
    return { mediaType: match[1], data };
  } catch {
    return null;
  }
}

function cloudflareConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !apiToken) return null;
  return { accountId, apiToken };
}

function isCloudflareConfigError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /cloudflare.*(?:401|403)|unauthorized|forbidden|invalid.*token|authentication|credential/i.test(
    message,
  );
}

async function generateWithCloudflare(
  sourceImage: { mediaType: string; data: Buffer },
  preset: z.infer<typeof Payload>["preset"],
  prompt: string,
) {
  const config = cloudflareConfig();
  if (!config) throw new Error("Cloudflare Workers AI credentials are not configured");

  const { width, height } = outputSize(preset);
  const form = new FormData();
  const imageBytes = Uint8Array.from(sourceImage.data);
  form.append("prompt", prompt);
  form.append(
    "input_image_0",
    new Blob([imageBytes], { type: sourceImage.mediaType }),
    "car.jpg",
  );
  form.append("width", String(width));
  form.append("height", String(height));
  form.append("guidance", "3.5");

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/ai/run/${CLOUDFLARE_MODEL}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiToken}` },
      body: form,
    },
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1000);
    throw new Error(`Cloudflare Workers AI ${response.status}: ${detail}`);
  }

  const contentType = response.headers.get("content-type") || "application/json";
  if (contentType.includes("application/json")) {
    const json = (await response.json()) as {
      result?: { image?: string; base64?: string } | string;
      image?: string;
    };
    const encoded =
      typeof json.result === "string"
        ? json.result
        : json.result?.image || json.result?.base64 || json.image || "";
    if (!encoded) throw new Error("Cloudflare Workers AI returned no image payload");
    return encoded.startsWith("data:") ? encoded : `data:image/png;base64,${encoded}`;
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error("Cloudflare Workers AI returned an empty image");
  const imageType = contentType.startsWith("image/") ? contentType.split(";")[0] : "image/png";
  return `data:${imageType};base64,${bytes.toString("base64")}`;
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

    if (!cloudflareConfig())
      return {
        ok: false,
        code: "CONFIG_REQUIRED",
        message: "Creator AI холболтын Cloudflare тохиргоо дутуу байна.",
      };

    const prompt = `Use image 0 as the strict vehicle reference. Create a high-quality image edit of the uploaded CPM car screenshot into a finished ONI And Kishin social asset. Output aspect ratio ${aspect(data.preset)}. Asset type: ${data.preset}. Member nickname: ${data.nickname || "ONI MEMBER"}${data.cpmId ? `, CPM ID ${data.cpmId}` : ""}. The car in image 0 must remain unmistakably the same exact vehicle: preserve its silhouette, body proportions, body kit, paint colors, decals, wheel design, stance and camera perspective. Do not redesign the vehicle, replace wheels, change paint, remove decals, add fake sponsor logos, duplicate the car or turn it into an illustration. Improve the environment, lighting, atmosphere, reflections, sharpness and premium presentation around the original vehicle. ONI visual system: midnight-black cinematic environment, restrained crimson rim light, realistic glossy reflections, premium Japanese motorsport editorial composition, clean negative space for typography, high contrast, photorealistic finish. ${data.note || "Keep image 0 as the hero reference and make the final result look official, cinematic and premium."}`;

    try {
      const imageUrl = await generateWithCloudflare(sourceImage, data.preset, prompt);
      return {
        ok: true,
        imageUrl,
        text: "FLUX.2 image edit бэлэн боллоо.",
      };
    } catch (error) {
      console.error(
        "[oni-creator] Cloudflare generation error",
        error instanceof Error ? error.message : "unknown",
      );

      if (isCloudflareConfigError(error))
        return {
          ok: false,
          code: "CONFIG_REQUIRED",
          message: "Cloudflare Workers AI эрх эсвэл token тохиргоог шалгана уу.",
        };

      return {
        ok: false,
        code: "GENERATION_FAILED",
        message: "Creator зураг засаж чадсангүй. Дахин оролдоно уу.",
      };
    }
  });
