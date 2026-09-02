const VERSION = "oni-hub-app-v1.0.0";
const BASE = "/oni-kishin-web/";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const APP_SHELL = [
  BASE,
  BASE + "index.html",
  BASE + "offline.html",
  BASE + "manifest.webmanifest",
  BASE + "app/app.css",
  BASE + "app/app.js",
  BASE + "icons/icon-192.png",
  BASE + "icons/icon-512.png",
  BASE + "icons/icon-maskable-512.png",
  BASE + "icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC_CACHE, RUNTIME_CACHE]);
    for (const key of await caches.keys()) {
      if (!keep.has(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        return (await caches.match(req))
          || (await caches.match(BASE + "index.html"))
          || (await caches.match(BASE + "offline.html"));
      }
    })());
    return;
  }

  const isCoreAsset =
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".webmanifest");

  if (isCoreAsset) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      const network = fetch(req).then(async response => {
        if (response.ok) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, response.clone()).catch(() => {});
        }
        return response;
      }).catch(() => null);
      return cached || await network || Response.error();
    })());
  }
});
