import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FIRESTORE_ROOT =
  "https://firestore.googleapis.com/v1/projects/oni-kishin-f59b4/databases/(default)/documents";
const MEET_DURATION_MS = 20 * 60_000;

const VoiceRequest = z.object({ idToken: z.string().min(100).max(5000) });

type FirestoreDocument = {
  fields?: {
    startAt?: { timestampValue?: string };
    endsAt?: { timestampValue?: string };
  };
};

type VoiceResult =
  | { code: "READY"; url: string; token: string; expiresAt: string }
  | { code: "DENIED" | "CONFIG_REQUIRED" | "UNAVAILABLE" };

function liveKitConfig(): { url: string; apiKey: string; apiSecret: string } | null {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret || !/^wss:\/\//i.test(url)) return null;
  return { url, apiKey, apiSecret };
}

function decodeFirebaseUid(idToken: string): string | null {
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded)) as { sub?: unknown };
    return typeof parsed.sub === "string" && parsed.sub.length >= 6 ? parsed.sub : null;
  } catch {
    return null;
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function jsonToBase64Url(value: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signLiveKitToken(input: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  room: string;
  expiresAtSeconds: number;
}): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = jsonToBase64Url({ alg: "HS256", typ: "JWT" });
  const payload = jsonToBase64Url({
    iss: input.apiKey,
    sub: input.identity,
    nbf: nowSeconds - 5,
    iat: nowSeconds,
    exp: input.expiresAtSeconds,
    video: {
      roomJoin: true,
      room: input.room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
      canPublishSources: ["microphone"],
    },
  });
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(input.apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function authorizeCurrentMeet(
  idToken: string,
): Promise<
  | { code: "AUTHORIZED"; startAtMs: number; expiresAtMs: number }
  | { code: "DENIED" | "UNAVAILABLE" }
> {
  try {
    const headers = { Authorization: `Bearer ${idToken}` };
    const meetResponse = await fetch(`${FIRESTORE_ROOT}/meets/current`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (meetResponse.status === 401 || meetResponse.status === 403) return { code: "DENIED" };
    if (!meetResponse.ok) return { code: "UNAVAILABLE" };

    const meet = (await meetResponse.json()) as FirestoreDocument;
    const startAtRaw = meet.fields?.startAt?.timestampValue;
    if (!startAtRaw) return { code: "UNAVAILABLE" };
    const startAtMs = Date.parse(startAtRaw);
    if (!Number.isFinite(startAtMs)) return { code: "UNAVAILABLE" };
    const explicitEnd = Date.parse(meet.fields?.endsAt?.timestampValue ?? "");
    const expiresAtMs = Number.isFinite(explicitEnd)
      ? Math.min(startAtMs + MEET_DURATION_MS, explicitEnd)
      : startAtMs + MEET_DURATION_MS;

    const authorization = await fetch(`${FIRESTORE_ROOT}/meetVoiceAuthorization/current`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (authorization.status === 401 || authorization.status === 403) return { code: "DENIED" };
    if (authorization.status !== 404) return { code: "UNAVAILABLE" };
    const body = (await authorization.json()) as { error?: { status?: string } };
    if (body.error?.status !== "NOT_FOUND") return { code: "UNAVAILABLE" };

    const now = Date.now();
    if (now < startAtMs || now >= expiresAtMs) return { code: "DENIED" };
    return { code: "AUTHORIZED", startAtMs, expiresAtMs };
  } catch {
    return { code: "UNAVAILABLE" };
  }
}

/**
 * Issues an audio-only LiveKit join token only after Firestore proves the signed-in
 * rider is an approved registration for the active 20-minute Meet. Provider secrets
 * remain server-only. New token issuance is denied after the Meet ends.
 */
export const getMeetVoiceToken = createServerFn({ method: "POST" })
  .validator((input: unknown) => VoiceRequest.parse(input))
  .handler(async ({ data }): Promise<VoiceResult> => {
    const config = liveKitConfig();
    if (!config) return { code: "CONFIG_REQUIRED" };

    const uid = decodeFirebaseUid(data.idToken);
    if (!uid) return { code: "DENIED" };
    const authorization = await authorizeCurrentMeet(data.idToken);
    if (authorization.code !== "AUTHORIZED") return authorization;

    try {
      const identityHash = await sha256Hex(`${uid}:${authorization.startAtMs}`);
      const room = `oni-meet-${authorization.startAtMs}`;
      const token = await signLiveKitToken({
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        identity: `oni-${identityHash.slice(0, 24)}`,
        room,
        expiresAtSeconds: Math.floor(authorization.expiresAtMs / 1000),
      });
      return {
        code: "READY",
        url: config.url,
        token,
        expiresAt: new Date(authorization.expiresAtMs).toISOString(),
      };
    } catch {
      return { code: "UNAVAILABLE" };
    }
  });
