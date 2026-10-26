// MaçRadar service worker: sayfayı çevrimdışı açar, canlı API'yi asla önbelleğe almaz.
const C = "macradar-v9";
const CORE = ["macradar.html", "manifest.json", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(C).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {})))));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("api-sports.io") && !url.hostname.startsWith("media")) return; // canlı veri: her zaman ağdan

  const cacheFirst = url.hostname.includes("fonts.g") || url.hostname.startsWith("media.api-sports.io");
  if (cacheFirst) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(C).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Sayfa ve kendi dosyalarımız: önce ağ (güncel kalsın), ağ yoksa önbellek
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(C).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match("macradar.html")))
  );
});

// Arka plan bildirimleri: sunucudan gelen mesajı telefon bildirimi olarak göster
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { t: "MaçRadar", b: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.t || "MaçRadar", {
    body: d.b || "", tag: d.tag || undefined, renotify: true, icon: "icon-192.png", badge: "icon-192.png",
    vibrate: [300, 100, 300], data: { url: d.url || "./macradar.html" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./macradar.html", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.indexOf("macradar") > -1 && "focus" in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
