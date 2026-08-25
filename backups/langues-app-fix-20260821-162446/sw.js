const VERSION = "tlm-app-v18-votes-1787328959793";
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;

const SHELL_ASSETS = [
  "/app",
  "/app.html",
  "/manifest.webmanifest",
  "/logo192.png",
  "/logo512.png"
];

const DATA_PATHS = [
  "/current-pick",
  "/live-matches",
  "/api/live-matches",
  "/tier-stats",
  "/analysis-history",
  "/signal-fort-stats",
  "/premium-teaser",
  "/api/goal05/latest",
  "/api/goal05/history"
];

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "X-From-Cache": "miss" }
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
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
  if (url.origin !== self.location.origin) return;

  const isData = DATA_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(p + "?"));

  if (isData) {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(DATA_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || jsonResponse(
          { ok: false, offline: true, error: "Hors ligne - aucune donnee en cache." },
          503
        )))
    );
    return;
  }

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

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}

  const title = data.title || "TousLesMatchs";
  const options = {
    body: data.body || "Nouveau signal +0,5 disponible.",
    icon: "/logo192.png",
    badge: "/logo192.png",
    data: { url: data.url || "/app.html?tab=pick" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || "/app.html?tab=pick";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
