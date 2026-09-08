const CACHE_VERSION = "oni-nexus-v4";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const MAX_RUNTIME_ENTRIES = 96;
let cacheWrites = Promise.resolve();

// Serialize writes so concurrent asset requests cannot race the bound. Keep the
// offline shell pinned; evicted assets are fetched again on the next request.
function cacheAsset(request, response) {
  cacheWrites = cacheWrites
    .catch(() => undefined)
    .then(async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response);
      const runtime = (await cache.keys()).filter(
        (key) => !PRECACHE.includes(new URL(key.url).pathname),
      );
      await Promise.all(
        runtime
          .slice(0, Math.max(0, runtime.length - MAX_RUNTIME_ENTRIES))
          .map((key) => cache.delete(key)),
      );
    });
  return cacheWrites;
}

const OFFLINE_URL = "/offline.html";
const PRECACHE = [
  "/",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/apple-touch-icon-v2.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("oni-") && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/assets/") ||
      url.pathname.startsWith("/icons/") ||
      /\.(?:css|js|mjs|png|jpg|jpeg|webp|svg|woff2?)$/i.test(url.pathname))
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
    );
    return;
  }
  if (!isCacheableAsset(url)) return;
  const response = caches.match(request).then((cached) => {
    const network = fetch(request)
      .then(async (response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          await cacheAsset(request, copy);
        }
        return response;
      })
      .catch(() => cached || Response.error());
    event.waitUntil(network.then(() => undefined));
    return cached || network;
  });
  event.respondWith(response);
  event.waitUntil(response.then(() => cacheWrites));
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json?.() ?? {};
  } catch {
    payload = { body: event.data?.text?.() ?? "ONI NEXUS шинэ мэдэгдэлтэй." };
  }
  const title = typeof payload.title === "string" && payload.title ? payload.title : "Shizuki";
  const body =
    typeof payload.body === "string" && payload.body
      ? payload.body
      : "ONI NEXUS шинэ мэдэгдэлтэй ✨";
  const url = typeof payload.url === "string" && payload.url.startsWith("/") ? payload.url : "/";
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body,
        icon: typeof payload.icon === "string" ? payload.icon : "/icons/icon-192.png",
        badge: typeof payload.badge === "string" ? payload.badge : "/icons/icon-192.png",
        tag: typeof payload.tag === "string" ? payload.tag : "oni-nexus",
        renotify: true,
        data: { url },
      });
      if (self.registration.navigationPreload) {
        // No-op: keeps notification handling user-visible and independent of page execution.
      }
      if (self.navigator && typeof self.navigator.setAppBadge === "function") {
        await self.navigator.setAppBadge(1).catch(() => undefined);
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          if ("navigate" in client) await client.navigate(target).catch(() => undefined);
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
