import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "@/integrations/firebase/client";
import { fetchMemberAccount } from "@/data/member-auth";

export type NexusPushState =
  | "unsupported"
  | "install_required"
  | "signed_out"
  | "approval_required"
  | "config_required"
  | "prompt"
  | "enabled"
  | "denied";

export type NexusPushResult =
  | { ok: true; state: "enabled"; message: string }
  | { ok: false; state: Exclude<NexusPushState, "enabled">; message: string };

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function isNexusStandalone() {
  if (typeof window === "undefined") return false;
  const nav = navigator as NavigatorWithStandalone;
  return window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true;
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function supportsPush() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function decodeApplicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

async function publicKey() {
  const snapshot = await getDoc(doc(firebaseDb, "site", "nexusPush"));
  if (!snapshot.exists()) return "";
  const row = snapshot.data();
  return row["enabled"] === false ? "" : String(row["publicKey"] ?? "").trim();
}

async function subscriptionId(uid: string, endpoint: string) {
  const data = new TextEncoder().encode(endpoint);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${uid}__${hex}`;
}

export async function getNexusPushState(): Promise<NexusPushState> {
  if (!supportsPush()) return "unsupported";
  if (isIosDevice() && !isNexusStandalone()) return "install_required";
  const user = firebaseAuth.currentUser;
  if (!user) return "signed_out";
  const account = await fetchMemberAccount(user.uid).catch(() => null);
  if (!account || account.status !== "approved") return "approval_required";
  if (Notification.permission === "denied") return "denied";
  const key = await publicKey().catch(() => "");
  if (!key) return "config_required";
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? "enabled" : "prompt";
}

export async function enableNexusPush(): Promise<NexusPushResult> {
  if (!supportsPush())
    return { ok: false, state: "unsupported", message: "Энэ төхөөрөмж Web Push дэмжихгүй байна." };
  if (isIosDevice() && !isNexusStandalone()) {
    return {
      ok: false,
      state: "install_required",
      message: "iPhone дээр эхлээд ONI NEXUS-ийг Home Screen-д app болгон нэмнэ үү.",
    };
  }

  const user = firebaseAuth.currentUser;
  if (!user)
    return {
      ok: false,
      state: "signed_out",
      message: "Push идэвхжүүлэхийн тулд ONI member account-аар нэвтэрнэ үү.",
    };
  const account = await fetchMemberAccount(user.uid).catch(() => null);
  if (!account || account.status !== "approved") {
    return {
      ok: false,
      state: "approval_required",
      message: "Push нь зөвхөн баталгаажсан ONI member-д нээлттэй.",
    };
  }

  const key = await publicKey().catch(() => "");
  if (!key)
    return {
      ok: false,
      state: "config_required",
      message: "ONI NEXUS push backend тохиргоо хараахан идэвхжээгүй байна.",
    };

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted")
    return {
      ok: false,
      state: "denied",
      message: "Notification permission зөвшөөрөгдөөгүй байна.",
    };

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeApplicationServerKey(key),
    });
  }

  const json = subscription.toJSON();
  const endpoint = subscription.endpoint;
  const p256dh = json.keys?.["p256dh"] ?? "";
  const auth = json.keys?.["auth"] ?? "";
  if (!endpoint || !p256dh || !auth) {
    return { ok: false, state: "unsupported", message: "Push subscription key үүсэж чадсангүй." };
  }

  const id = await subscriptionId(user.uid, endpoint);
  await setDoc(
    doc(firebaseDb, "pushSubscriptions", id),
    {
      uid: user.uid,
      nickname: account.nickname,
      cpmId: account.cpmId,
      endpoint,
      p256dh,
      auth,
      platform: isIosDevice() ? "ios" : "web",
      enabled: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const nav = navigator as NavigatorWithStandalone;
  await nav.clearAppBadge?.().catch(() => undefined);
  return { ok: true, state: "enabled", message: "Shizuki push идэвхжлээ ✨" };
}

export async function disableNexusPush() {
  if (!supportsPush()) return;
  const user = firebaseAuth.currentUser;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  if (user) {
    const id = await subscriptionId(user.uid, subscription.endpoint);
    await deleteDoc(doc(firebaseDb, "pushSubscriptions", id)).catch(() => undefined);
  }
  await subscription.unsubscribe().catch(() => undefined);
}
