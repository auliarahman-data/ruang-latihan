/* Service worker Ruang Latihan: halaman dan paket tetap bisa dibuka saat internet putus. */
var CACHE = "rl-v1";
var CORE = ["./", "index.html", "config.js", "manifest.webmanifest", "icon-180.png", "icon-512.png", "paket/daftar.json"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function networkFirst(req) {
  return fetch(req).then(function (r) {
    if (r.ok) { var c = r.clone(); caches.open(CACHE).then(function (ca) { ca.put(req, c); }); }
    return r;
  }).catch(function () { return caches.match(req, { ignoreSearch: true }); });
}
function cacheFirst(req) {
  return caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (r) {
      if (r.ok || r.type === "opaque") { var c = r.clone(); caches.open(CACHE).then(function (ca) { ca.put(req, c); }); }
      return r;
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var u = new URL(req.url);
  if (u.origin === location.origin) {
    // paket berversi (?v=hash) aman disimpan lama; sisanya selalu coba versi terbaru dulu
    if (u.pathname.indexOf("/paket/") >= 0 && u.searchParams.get("v")) e.respondWith(cacheFirst(req));
    else e.respondWith(networkFirst(req));
  } else if (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") {
    e.respondWith(cacheFirst(req));
  }
  // permintaan ke Google Apps Script tidak disentuh
});
