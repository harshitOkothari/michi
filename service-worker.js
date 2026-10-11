// ============================================================
// SERVICE WORKER — caches the app shell (HTML/CSS/JS) so the
// interface loads instantly and works offline. Data itself
// always comes from Supabase, never the cache — this only
// speeds up / offlines the UI, not your records.
// ============================================================

const CACHE_NAME = "dashboard-shell-v28";
const SHELL_FILES = [
  "./",
  "index.html",
  "terms.html",
  "css/style.css",
  "css/landing2.css",
  "css/idcard.css",
  "js/idcard.js",
  "js/katana3d.js",
  "js/crane3d.js",
  "js/config.js",
  "js/bundle.js",
  "manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache Supabase API calls or the Supabase SDK — always go to network.
  if (url.hostname.includes("supabase.co") || url.hostname.includes("jsdelivr.net") || url.hostname.includes("cdnjs.cloudflare.com")) {
    return;
  }

  // App-shell files: network-first, so a new deploy shows up immediately.
  // Falls back to the cached copy only if the network is unreachable (offline).
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
