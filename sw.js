// Coolvarko PWA Service Worker
// Verzió: 1.0.0 — frissítéskor növeld a CACHE_NAME-t!
const CACHE_NAME = "coolvarko-v1";
const OFFLINE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600&display=swap",
];

// Telepítés — statikus fájlok gyorsítótárazása
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Aktiválás — régi cache törlése
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — cache-first stratégia statikus fájlokra, network-first Firebase-re
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Firebase hívásokat ne gyorsítótárazzuk
  if (
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseapp.com") ||
    url.hostname.includes("gstatic.com")
  ) {
    return; // pass-through
  }

  // Statikus fájlok: cache-first
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((response) => {
          // Sikeres response-t cachelünk
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback — az index.html-t visszaadjuk
          if (e.request.destination === "document") {
            return caches.match("/index.html");
          }
        });
    })
  );
});
