// Minimal SW so the PWA installs and the share target works.
// We don't aggressively cache the app shell because nginx already handles
// caching, and offline-first isn't a goal — this is a single-user app
// that's always reaching for the latest bookmark list.

const CACHE = "crbox-links-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass everything through.
});
