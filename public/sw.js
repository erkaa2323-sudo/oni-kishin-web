const CACHE_VERSION = "oni-pwa-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = ["/", OFFLINE_URL, "/manifest.webmanifest", "/favicon.png", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("oni-") && key !== STATIC_CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

function isCacheableAsset(url) {
  return url.origin === self.location.origin && (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/") || /\.(?:css|js|mjs|png|jpg|jpeg|webp|svg|woff2?)$/i.test(url.pathname));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()));
    return;
  }
  if (!isCacheableAsset(url)) return;
  event.respondWith(caches.match(request).then((cached) => {
    const network = fetch(request).then((response) => {
      if (response.ok && response.type === "basic") {
        const copy = response.clone();
        void caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(() => cached || Response.error());
    return cached || network;
  }));
});
