/* Service worker TousLesMatchs.
 * Les pages HTML et les donnees sportives utilisent le reseau en priorite.
 * Le cache reste uniquement un secours hors ligne.
 */

const VERSION = "tlm-app-v2-20260825";
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;

const SHELL_ASSETS = [
  "/app",
  "/app.html",
  "/manifest.webmanifest",
  "/logo192.png",
  "/logo512.png",
];

const DATA_PATHS = [
  "/current-pick",
  "/live-matches",
  "/tier-stats",
  "/analysis-history",
  "/signal-fort-stats",
  "/premium-teaser",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request, cacheName, fallback) {
  return fetch(request)
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(cacheName).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() => caches.match(request).then((hit) => hit || fallback()));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const dataPath = url.pathname.startsWith("/api/") ? url.pathname.slice(4) : url.pathname;
  const isData = DATA_PATHS.some((path) => dataPath === path);

  if (isData) {
    event.respondWith(networkFirst(request, DATA_CACHE, () => Response.json(
      { ok: false, offline: true, error: "Hors ligne — aucune donnée en cache." },
      { status: 503, headers: { "X-From-Cache": "miss" } }
    )));
    return;
  }

  // Une navigation ne doit jamais rester bloquee sur une ancienne page.
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(networkFirst(request, SHELL_CACHE, () => {
      const appRoute = url.pathname === "/app" || url.pathname === "/app.html";
      return caches.match(appRoute ? "/app.html" : "/index.html")
        .then((hit) => hit || Response.error());
    }));
    return;
  }

  // Images et ressources statiques : cache d'abord, réseau en secours.
  event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((response) => {
    if (response && response.ok && request.destination === "image") {
      const copy = response.clone();
      caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  })));
});
