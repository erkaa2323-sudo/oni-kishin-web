const VERSION = "oni-hub-v2-shell-1";
const BASE = "/oni-kishin-web/";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const APP_SHELL = [
  BASE,
  BASE + "index.html",
  BASE + "offline.html",
  BASE + "manifest.webmanifest",
  BASE + "oni-kishin-logo.jpg",
  BASE + "css/tokens.css",
  BASE + "css/components.css",
  BASE + "css/app.css",
  BASE + "js/app.js",
  BASE + "js/router.js",
  BASE + "js/firebase.js",
  BASE + "js/auth.js",
  BASE + "js/members.js",
  BASE + "js/garage.js",
  BASE + "js/music.js",
  BASE + "js/meet.js",
  BASE + "js/market.js",
  BASE + "js/oni-ai.js",
  BASE + "admin/index.html",
  BASE + "worker/index.js",
  BASE + "legacy/index-v1.html",
  BASE + "icons/icon-192.png",
  BASE + "icons/icon-512.png",
  BASE + "icons/icon-maskable-512.png",
  BASE + "icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.all(APP_SHELL.map(async asset => {
      try {
        await cache.add(new Request(asset, { cache: "reload" }));
      } catch {
        // Keep install resilient to partial static failures.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const allowed = new Set([STATIC_CACHE, RUNTIME_CACHE]);
    for (const key of await caches.keys()) {
      if (!allowed.has(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone()).catch(() => {});
        return response;
      } catch {
        return (await caches.match(request))
          || (await caches.match(BASE + "index.html"))
          || (await caches.match(BASE + "offline.html"));
      }
    })());
    return;
  }

  const staticAsset = /\.(?:css|js|png|jpg|jpeg|svg|webmanifest|html)$/i.test(url.pathname);
  if (!staticAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await caches.match(request);
    const network = fetch(request).then(response => {
      if (response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    }).catch(() => null);

    return cached || await network || Response.error();
  })());
});
