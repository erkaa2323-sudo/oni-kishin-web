import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FIRESTORE_ROOT =
  "https://firestore.googleapis.com/v1/projects/oni-kishin-f59b4/databases/(default)/documents";
const FIREBASE_API_KEY = "AIzaSyDt0DjUhafGZ2D-co3ZhZlIde_Qe1K5trw";
const MEET_DURATION_MS = 20 * 60_000;

const VoiceRequest = z.object({ idToken: z.string().min(100).max(5000) });

type FirestoreValue = {
  stringValue?: string;
  timestampValue?: string;
  booleanValue?: boolean;
};

type FirestoreDocument = {
  fields?: Record<string, FirestoreValue>;
};

type VoiceResult =
  | { code: "READY"; url: string; token: string; expiresAt: string }
  | { code: "DENIED" | "CONFIG_REQUIRED" | "UNAVAILABLE" };

type AuthorizedMeet = {
  code: "AUTHORIZED";
  uid: string;
  startAtMs: number;
  expiresAtMs: number;
};

function liveKitConfig(): { url: string; apiKey: string; apiSecret: string } | null {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret || !/^wss:\/\//i.test(url)) return null;
  return { url, apiKey, apiSecret };
}

function fieldString(document: FirestoreDocument, key: string): string | null {
  return document.fields?.[key]?.stringValue ?? null;
}

function fieldTimestamp(document: FirestoreDocument, key: string): string | null {
  return document.fields?.[key]?.timestampValue ?? null;
}

function fieldBoolean(document: FirestoreDocument, key: string): boolean | null {
  const value = document.fields?.[key]?.booleanValue;
  return typeof value === "boolean" ? value : null;
}

async function verifyFirebaseUser(idToken: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { users?: Array<{ localId?: unknown }> };
    const uid = body.users?.[0]?.localId;
    return typeof uid === "string" && uid.length >= 6 ? uid : null;
  } catch {
    return null;
  }
}

async function fetchFirestoreDocument(
  path: string,
  idToken: string,
): Promise<
  { code: "OK"; document: FirestoreDocument } | { code: "DENIED" | "UNAVAILABLE" }
> {
  try {
    const response = await fetch(`${FIRESTORE_ROOT}/${path}`, {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401 || response.status === 403) return { code: "DENIED" };
    if (!response.ok) return { code: "UNAVAILABLE" };
    return { code: "OK", document: (await response.json()) as FirestoreDocument };
  } catch {
    return { code: "UNAVAILABLE" };
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
): Promise<AuthorizedMeet | { code: "DENIED" | "UNAVAILABLE" }> {
  const uid = await verifyFirebaseUser(idToken);
  if (!uid) return { code: "DENIED" };

  const [meetResult, accountResult, participantResult] = await Promise.all([
    fetchFirestoreDocument("meets/current", idToken),
    fetchFirestoreDocument(`memberAccounts/${encodeURIComponent(uid)}`, idToken),
    fetchFirestoreDocument(`meetParticipants/${encodeURIComponent(uid)}`, idToken),
  ]);

  if (meetResult.code !== "OK") return meetResult;
  if (accountResult.code !== "OK") return accountResult;
  if (participantResult.code !== "OK") return participantResult;

  const meet = meetResult.document;
  const account = accountResult.document;
  const participant = participantResult.document;
  const slotId = fieldString(participant, "slotId");
  if (!slotId) return { code: "DENIED" };

  const slotResult = await fetchFirestoreDocument(
    `meetSlots/${encodeURIComponent(slotId)}`,
    idToken,
  );
  if (slotResult.code !== "OK") return slotResult;
  const slot = slotResult.document;

  const startAtRaw = fieldTimestamp(meet, "startAt");
  if (!startAtRaw) return { code: "UNAVAILABLE" };
  const startAtMs = Date.parse(startAtRaw);
  if (!Number.isFinite(startAtMs)) return { code: "UNAVAILABLE" };

  const explicitEndRaw = fieldTimestamp(meet, "endsAt");
  const explicitEndMs = explicitEndRaw ? Date.parse(explicitEndRaw) : Number.NaN;
  const expiresAtMs = Number.isFinite(explicitEndMs)
    ? Math.min(startAtMs + MEET_DURATION_MS, explicitEndMs)
    : startAtMs + MEET_DURATION_MS;

  const participantStartAt = Date.parse(fieldTimestamp(participant, "meetStartAt") ?? "");
  const slotStartAt = Date.parse(fieldTimestamp(slot, "meetStartAt") ?? "");
  const accountMemberId = fieldString(account, "memberId");
  const participantMemberId = fieldString(participant, "memberId");
  const status = fieldString(meet, "status") ?? "scheduled";
  const now = Date.now();

  const authorized =
    fieldBoolean(meet, "enabled") === true &&
    status !== "ended" &&
    status !== "closed" &&
    now >= startAtMs &&
    now < expiresAtMs &&
    fieldString(account, "status") === "approved" &&
    fieldString(participant, "meetId") === "current" &&
    Number.isFinite(participantStartAt) &&
    participantStartAt === startAtMs &&
    accountMemberId !== null &&
    participantMemberId === accountMemberId &&
    fieldString(slot, "participantId") === uid &&
    Number.isFinite(slotStartAt) &&
    slotStartAt === startAtMs;

  if (!authorized) return { code: "DENIED" };
  return { code: "AUTHORIZED", uid, startAtMs, expiresAtMs };
}

/**
 * Issues an audio-only LiveKit join token only after the signed-in Firebase user is
 * re-verified server-side and Firestore proves the account, participant and slot all
 * belong to the same active 20-minute Meet. Provider secrets remain server-only.
 */
export const getMeetVoiceToken = createServerFn({ method: "POST" })
  .validator((input: unknown) => VoiceRequest.parse(input))
  .handler(async ({ data }): Promise<VoiceResult> => {
    const config = liveKitConfig();
    if (!config) return { code: "CONFIG_REQUIRED" };

    const authorization = await authorizeCurrentMeet(data.idToken);
    if (authorization.code !== "AUTHORIZED") return authorization;

    try {
      const identityHash = await sha256Hex(`${authorization.uid}:${authorization.startAtMs}`);
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
