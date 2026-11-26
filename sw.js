// Coolvarko Napló service worker — új kiadásnál a verziót emeld!
const CACHE = "coolvarko-v2.9.3";
const SHELL = ["./", "./index.html", "./logo.png", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./badge-96.png", "./manifest.json"];
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

// ── Push értesítés: akkor is megjelenik, ha az app nincs megnyitva ──
self.addEventListener("push", e => {
  let d = {};
  try { const j = e.data ? e.data.json() : {}; d = { ...(j.notification || {}), ...(j.data || {}) }; }
  catch (x) { d = { body: e.data ? e.data.text() : "" }; }
  const title = d.title || "Coolvarko Napló";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "Rögzítsd a mai napot!",
    icon: "icon-192.png", badge: "badge-96.png",
    tag: d.tag || "emlekezteto", renotify: true,
    data: { url: d.url || "./" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const cel = new URL(e.notification.data?.url || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    for (const w of ws) if (w.url.startsWith(self.registration.scope) && "focus" in w) return w.focus();
    return self.clients.openWindow(cel);
  }));
});
