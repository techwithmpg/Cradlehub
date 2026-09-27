/*
 * Staff PWA installability worker.
 *
 * This worker deliberately has no fetch handler and no cache storage. Its
 * only responsibility is to give the /staff/ app boundary a stable,
 * same-origin service-worker controller for installed PWA launch behavior.
 * Push notifications remain owned by /cradlehub-push-sw.js.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
