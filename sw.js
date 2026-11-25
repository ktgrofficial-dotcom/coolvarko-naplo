// Coolvarko Napló service worker — új kiadásnál a verziót emeld!
const CACHE = "coolvarko-v2.5";
const SHELL = ["./", "./index.html", "./logo.png", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./manifest.json"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))));
  self.clients.claim();
});
// Csak a saját fájlokat kezeljük (hálózat először, offline a gyorsítótárból).
// A Firebase forgalmát nem érintjük — azt a Firestore saját offline tárolója kezeli.
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});
