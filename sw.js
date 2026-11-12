// Offline cache. Strona i skrypty aplikacji: najpierw sieć (aktualizacje od razu), offline z pamięci.
// Pliki danych do ćwiczeń nie są zapisywane z góry – trafiają do pamięci dopiero po pobraniu.
const CACHE = "pc-v3";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "config.js", "answers.js", "datafiles.js",
  "content-xl.js", "content-pq.js", "content-bi.js", "content-sap.js", "content-extra.js",
  "vendor/supabase.js", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"
];
const CACHED_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  if (!same && !CACHED_HOSTS.includes(url.hostname)) return;   // Supabase API idzie prosto do sieci
  if (same && url.pathname.includes("/data/")) return;           // duże pliki danych – bez cache
  const networkFirst = same && (req.mode === "navigate" || url.pathname.endsWith(".js") || url.pathname.endsWith(".webmanifest") || url.pathname.endsWith("/index.html"));
  if (networkFirst) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req, { cache: "no-store" });
        if (res && res.ok) cache.put(req.mode === "navigate" ? "index.html" : req, res.clone());
        return res;
      } catch (err) {
        return (await cache.match(req, { ignoreSearch: true })) || (await cache.match("index.html"));
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => { if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); return res; }).catch(() => cached);
    if (cached) { e.waitUntil(network); return cached; }
    return network;
  })());
});
