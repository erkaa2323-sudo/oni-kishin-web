const VERSION = "oni-hub-v2-shell-10";
const BASE = "/oni-kishin-web/v2/";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const MAX_RUNTIME_ENTRIES = 120;

const APP_SHELL = [
  BASE,
  BASE + "index.html",
  BASE + "manifest.webmanifest",
  BASE + "sw.js",
  BASE + "css/tokens.css",
  BASE + "css/components.css",
  BASE + "css/app.css",
  BASE + "js/app.js",
  BASE + "js/router.js",
  BASE + "js/firebase.js",
  BASE + "js/auth.js",
  BASE + "js/admin.js",
  BASE + "js/members.js",
  BASE + "js/garage.js",
  BASE + "js/music.js",
  BASE + "js/meet.js",
  BASE + "js/join.js",
  BASE + "js/market.js",
  BASE + "js/oni-ai.js",
  BASE + "admin/index.html",
  BASE + "assets/oni-ai-character.webp",
  BASE + "worker/index.js",
  "/oni-kishin-web/offline.html",
  "/oni-kishin-web/icons/icon-192.png",
  "/oni-kishin-web/icons/icon-512.png",
  "/oni-kishin-web/icons/icon-maskable-512.png",
  "/oni-kishin-web/icons/apple-touch-icon.png",
  "/oni-kishin-web/oni-kishin-logo.jpg"
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
    if ("navigationPreload" in self.registration) {
      await self.registration.navigationPreload.enable().catch(() => {});
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
  if (!url.pathname.startsWith("/oni-kishin-web/v2/")) return;
  if (url.pathname.startsWith("/oni-kishin-web/v2/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        if (preload) return preload;
        return await fetch(request, { cache: "no-store" });
      } catch {
        return (await caches.match(BASE + "index.html"))
          || (await caches.match("/oni-kishin-web/offline.html"));
      }
    })());
    return;
  }

  const staticAsset = /\.(?:css|js|png|jpg|jpeg|svg|webmanifest|html)$/i.test(url.pathname);
  if (!staticAsset) return;

  event.respondWith((async () => {
    const runtimeCache = await caches.open(RUNTIME_CACHE);
    const staticCache = await caches.open(STATIC_CACHE);
    const cachedRuntime = await runtimeCache.match(request);
    const cachedStatic = await staticCache.match(request);
    const isFastChanging = request.destination === "script"
      || request.destination === "style"
      || url.pathname.endsWith(".html")
      || url.pathname.endsWith(".webmanifest");

    if (isFastChanging) {
      try {
        const fresh = await fetch(request, { cache: "no-store" });
        if (fresh.ok) {
          staticCache.put(request, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch {
        return cachedStatic || cachedRuntime || Response.error();
      }
    }

    const networkPromise = fetch(request).then(response => {
      if (response.ok) {
        runtimeCache.put(request, response.clone()).catch(() => {});
        trimCache(runtimeCache).catch(() => {});
      }
      return response;
    }).catch(() => null);

    return cachedRuntime || cachedStatic || await networkPromise || Response.error();
  })());
});

async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_RUNTIME_ENTRIES) return;
  const stale = keys.slice(0, keys.length - MAX_RUNTIME_ENTRIES);
  await Promise.all(stale.map(key => cache.delete(key)));
}
