// Service worker: gör appen installerbar och användbar utan internet.
// Höj VERSION när data eller kod ändras så att alla får den nya versionen.
const VERSION = "ghf-v3";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/style.css",
  "js/data.js", "js/i18n.js", "js/search.js", "js/scenarios.js", "js/app.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Visa sparad version direkt och hämta en ny i bakgrunden (stale-while-revalidate).
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const fonts = url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com";
  if (url.origin !== location.origin && !fonts) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: req.mode === "navigate" })
      || (req.mode === "navigate" ? await cache.match("index.html") : undefined);
    const fresh = fetch(req).then(res => {
      if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    if (cached) { e.waitUntil(fresh); return cached; }
    return fresh;
  }));
});
