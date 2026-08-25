// force cache refresh 1786902620210\n/* Service worker de l'application TousLesMatchs.
 *
 * Deux stratégies distinctes, volontairement :
 *  - la coquille de l'app (HTML, icônes) est servie depuis le cache en priorité :
 *    l'app s'ouvre instantanément, et même sans réseau ;
 *  - les données (pick du jour, matchs en direct, performances) vont TOUJOURS au
 *    réseau d'abord. Une analyse sportive périmée n'a aucune valeur : on ne sert le
 *    cache que si le réseau échoue, et l'app affiche alors clairement l'âge de la donnée.
 *
 * Rien de ce fichier ne modifie le site existant : il ne s'active que pour les
 * visiteurs qui installent l'application.
 */

const VERSION = "tlm-app-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;

const SHELL_ASSETS = [
  "/app",
  "/app.html",
  "/manifest.webmanifest",
  "/logo192.png",
  "/logo512.png",
];

// Endpoints de données : réseau d'abord, cache en secours.
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
      // addAll échoue en bloc si une seule URL manque : on ajoute donc une par une.
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // On ne touche jamais aux requêtes vers un autre domaine (Stripe, Telegram…).
  if (url.origin !== self.location.origin) return;

  const isData = DATA_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(p + "?"));

  if (isData) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(DATA_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || Response.json(
          { ok: false, offline: true, error: "Hors ligne — aucune donnée en cache." },
          { status: 503, headers: { "X-From-Cache": "miss" } }
        )))
    );
    return;
  }

  // Coquille : cache d'abord, réseau ensuite, avec repli sur l'écran de l'app.
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req)
      .then((res) => {
        if (res && res.ok && (req.destination === "document" || req.destination === "image")) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => req.destination === "document" ? caches.match("/app.html") : Response.error()))
  );
});
