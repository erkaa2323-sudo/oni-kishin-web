import { createServerFn } from "@tanstack/react-start";
import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from "node:crypto";
import { z } from "zod";

const FIREBASE_API_KEY = "AIzaSyDt0DjUhafGZ2D-co3ZhZlIde_Qe1K5trw";
const PROJECT_ID = "oni-kishin-f59b4";
const ADMIN_EMAIL = "erkaa130@gmail.com";
const PUSH_CONFIG_DOC = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/pushConfig/vapid`;
const PUSH_SUBSCRIPTIONS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/pushSubscriptions`;

const SendMeetPayload = z.object({
  idToken: z.string().min(100).max(5000),
  meetTitle: z.string().max(120).default("ONI MEET"),
  url: z.string().max(300).default("/meet"),
});

type FirestoreField = { stringValue?: string; booleanValue?: boolean; timestampValue?: string };
type FirestoreDocument = { name?: string; fields?: Record<string, FirestoreField> };
type PushSubscriptionRow = {
  docName: string;
  uid: string;
  nickname: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushConfig = { publicKey: string; privateKey: string };

const b64urlEncode = (value: Buffer | Uint8Array | string) =>
  Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

const b64urlDecode = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Buffer.from(padded, "base64");
};

function hmac(key: Buffer, data: Buffer) {
  return createHmac("sha256", key).update(data).digest();
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number) {
  const blocks: Buffer[] = [];
  let previous = Buffer.alloc(0);
  let counter = 1;
  while (Buffer.concat(blocks).length < length) {
    previous = hmac(prk, Buffer.concat([previous, info, Buffer.from([counter])]));
    blocks.push(previous);
    counter += 1;
  }
  return Buffer.concat(blocks).subarray(0, length);
}

async function verifyAdmin(idToken: string) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) return false;
  const data = await response.json() as { users?: Array<{ email?: string }> };
  return data.users?.[0]?.email?.trim().toLowerCase() === ADMIN_EMAIL;
}

function stringField(doc: FirestoreDocument, key: string) {
  const value = doc.fields?.[key]?.stringValue;
  return typeof value === "string" ? value : "";
}

async function loadPushConfig(idToken: string): Promise<PushConfig | null> {
  const response = await fetch(PUSH_CONFIG_DOC, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!response.ok) return null;
  const doc = await response.json() as FirestoreDocument;
  const publicKey = stringField(doc, "publicKey");
  const privateKey = stringField(doc, "privateKey");
  return publicKey && privateKey ? { publicKey, privateKey } : null;
}

async function listSubscriptions(idToken: string): Promise<PushSubscriptionRow[]> {
  const rows: PushSubscriptionRow[] = [];
  let pageToken = "";
  do {
    const url = new URL(PUSH_SUBSCRIPTIONS);
    url.searchParams.set("pageSize", "500");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
    if (!response.ok) throw new Error(`subscriptions_${response.status}`);
    const data = await response.json() as { documents?: FirestoreDocument[]; nextPageToken?: string };
    for (const doc of data.documents ?? []) {
      if (!doc.name) continue;
      const endpoint = stringField(doc, "endpoint");
      const p256dh = stringField(doc, "p256dh");
      const auth = stringField(doc, "auth");
      if (!endpoint || !p256dh || !auth) continue;
      rows.push({
        docName: doc.name,
        uid: stringField(doc, "uid"),
        nickname: stringField(doc, "nickname"),
        endpoint,
        p256dh,
        auth,
      });
    }
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return rows;
}

function makeVapidJwt(endpoint: string, config: PushConfig) {
  const publicRaw = b64urlDecode(config.publicKey);
  const privateRaw = b64urlDecode(config.privateKey);
  if (publicRaw.length !== 65 || publicRaw[0] !== 4 || privateRaw.length !== 32) throw new Error("invalid_vapid_key");
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: b64urlEncode(publicRaw.subarray(1, 33)),
    y: b64urlEncode(publicRaw.subarray(33, 65)),
    d: b64urlEncode(privateRaw),
  };
  const key = createPrivateKey({ key: jwk, format: "jwk" });
  const header = b64urlEncode(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = b64urlEncode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: "mailto:erkaa2323@gmail.com",
  }));
  const unsigned = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" });
  return `${unsigned}.${b64urlEncode(signature)}`;
}

function encryptPayload(subscription: PushSubscriptionRow, payload: string) {
  const clientPublic = b64urlDecode(subscription.p256dh);
  const authSecret = b64urlDecode(subscription.auth);
  if (clientPublic.length !== 65 || clientPublic[0] !== 4 || authSecret.length === 0) throw new Error("invalid_subscription_key");

  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const serverPublic = ecdh.getPublicKey();
  const sharedSecret = ecdh.computeSecret(clientPublic);
  const prkKey = hmac(authSecret, sharedSecret);
  const info = Buffer.concat([Buffer.from("WebPush: info\0", "utf8"), clientPublic, serverPublic]);
  const ikm = hkdfExpand(prkKey, info, 32);
  const salt = randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hkdfExpand(prk, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
  const nonce = hkdfExpand(prk, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);
  const plain = Buffer.concat([Buffer.from(payload, "utf8"), Buffer.from([2])]);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096, 0);
  const header = Buffer.concat([salt, rs, Buffer.from([serverPublic.length]), serverPublic]);
  return Buffer.concat([header, encrypted]);
}

async function deleteStaleSubscription(idToken: string, docName: string) {
  await fetch(`https://firestore.googleapis.com/v1/${docName}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${idToken}` },
  }).catch(() => undefined);
}

async function sendOne(subscription: PushSubscriptionRow, config: PushConfig, body: string, url: string) {
  const payload = JSON.stringify({
    title: "Shizuki",
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: "oni-meet",
    url,
  });
  const encrypted = encryptPayload(subscription, payload);
  const jwt = makeVapidJwt(subscription.endpoint, config);
  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${config.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body: encrypted,
  });
}

export type NexusMeetPushResult =
  | { ok: true; sent: number; stale: number; failed: number }
  | { ok: false; code: "UNAUTHENTICATED" | "CONFIG_REQUIRED" | "SEND_FAILED"; message: string };

export const sendNexusMeetPush = createServerFn({ method: "POST" })
  .validator((input: unknown) => SendMeetPayload.parse(input))
  .handler(async ({ data }): Promise<NexusMeetPushResult> => {
    if (!(await verifyAdmin(data.idToken))) {
      return { ok: false, code: "UNAUTHENTICATED", message: "Push илгээх админ эрх баталгаажаагүй байна." };
    }
    const config = await loadPushConfig(data.idToken);
    if (!config) {
      return { ok: false, code: "CONFIG_REQUIRED", message: "ONI NEXUS push key хараахан үүсээгүй байна." };
    }
    try {
      const subscriptions = await listSubscriptions(data.idToken);
      let sent = 0;
      let stale = 0;
      let failed = 0;
      for (const subscription of subscriptions) {
        const nickname = subscription.nickname.trim() || "ONI member";
        const body = `${nickname}~ шинэ meet зарлагдлаа ✨`;
        try {
          const response = await sendOne(subscription, config, body, data.url || "/meet");
          if (response.ok) {
            sent += 1;
          } else if (response.status === 404 || response.status === 410) {
            stale += 1;
            await deleteStaleSubscription(data.idToken, subscription.docName);
          } else {
            failed += 1;
            console.error("[oni-nexus] push failed", response.status, await response.text().catch(() => ""));
          }
        } catch (error) {
          failed += 1;
          console.error("[oni-nexus] push exception", error instanceof Error ? error.message : "unknown");
        }
      }
      return { ok: true, sent, stale, failed };
    } catch (error) {
      console.error("[oni-nexus] broadcast failed", error instanceof Error ? error.message : "unknown");
      return { ok: false, code: "SEND_FAILED", message: "Meet push broadcast амжилтгүй боллоо." };
    }
  });
