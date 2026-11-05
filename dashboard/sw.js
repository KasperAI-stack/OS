/* HeyOtto OS — service worker. Kun til notifikationer (Web Push).
   Den gemmer intet og cacher intet, så appen altid er den nyeste version.
   Beskederne sendes af netlify/lib/alerts.mts som { title, body, url, tag }. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(d.title || "HeyOtto OS", {
    body: d.body || "",
    icon: "/otto/app-192.png",
    badge: "/otto/app-192.png",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || "/" }
  }));
});

// Et klik åbner HeyOtto OS — et vindue, der allerede er åbent, bruges igen
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (new URL(c.url).origin === self.location.origin) return c.focus().then((w) => (w && w.navigate ? w.navigate(url) : w));
    }
    return self.clients.openWindow(url);
  }));
});
