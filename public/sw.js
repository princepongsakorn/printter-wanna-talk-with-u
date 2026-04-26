// Service worker for the chat PWA.
//
// Responsibilities:
//   1. Make the app installable.
//   2. Handle notification clicks — focus an existing client and navigate
//      it to the relevant pair URL, falling back to openWindow.
//   3. Cache the app shell + Vite-hashed assets so cold loads are fast and
//      the app keeps rendering on flaky/offline networks. Firestore is
//      still the source of truth — we never cache its responses.
//
// Cache versioning: bump CACHE_VERSION on any structural change here. The
// activate handler deletes everything that doesn't match, so users always
// converge on the current bundle within one reload.

const CACHE_VERSION = "chat-shell-v1";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {
        // First install on a brand-new origin can fail if any of the URLs
        // 404 (e.g. dev server). Don't block install.
      }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// Cache strategy:
//   - HTML navigation requests: network-first, fall back to cached shell.
//     Keeps the user on the latest deploy when online; lets them open the
//     app instantly (and offline) when not.
//   - /assets/* (Vite-hashed JS/CSS): cache-first. Hash = immutable.
//   - Other same-origin GETs (manifest, favicon, sw): stale-while-revalidate.
//   - Cross-origin (Firestore, googleapis, fonts): pass through untouched.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // HTML / SPA navigations.
  const accept = req.headers.get("accept") || "";
  if (req.mode === "navigate" || accept.includes("text/html")) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const copy = fresh.clone();
          caches.open(CACHE_VERSION).then((c) => c.put("/", copy)).catch(() => {});
          return fresh;
        } catch {
          const cached = await caches.match("/");
          return (
            cached ||
            new Response("Offline", { status: 503, statusText: "Offline" })
          );
        }
      })(),
    );
    return;
  }

  // Vite-hashed static assets — content-addressable, safe to cache forever.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const fresh = await fetch(req);
        if (fresh.ok) {
          const copy = fresh.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return fresh;
      })(),
    );
    return;
  }

  // Everything else same-origin: stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientsList) {
        // Prefer the same-origin window — postMessage so the SPA can
        // react-router-navigate instead of hard-reloading.
        try {
          client.postMessage({ type: "navigate", url: targetUrl });
          return await client.focus();
        } catch {
          // fall through
        }
      }
      return self.clients.openWindow(targetUrl);
    })(),
  );
});
