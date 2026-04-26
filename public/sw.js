// Minimal service worker for the chat PWA.
//
// Responsibilities today:
//   1. Make the app installable (Chrome requires a registered SW).
//   2. Handle notification clicks — focus an existing client and navigate
//      it to the relevant pair URL, falling back to openWindow.
//
// Deliberately no fetch caching: Firestore is the source of truth and the
// app always hits network for auth/data. Adding cache here without a plan
// for versioning would only cause stale-bundle bugs.
//
// When FCM push is added later, import firebase-messaging-sw here.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
