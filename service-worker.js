/* ALIZZ STORE Service Worker intentionally disabled.
   Push notification system was removed; keep this file as a safe no-op
   so old browser caches do not receive push handlers anymore. */
self.addEventListener("install", function (event) {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});
