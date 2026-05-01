/* ALIZZ STORE Service Worker - Web Push Notification */
self.addEventListener("install", function (event) {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {
      title: "ALIZZ STORE",
      body: event.data ? event.data.text() : "Ada promo terbaru buat kamu.",
      url: "/produk/"
    };
  }

  const title = String(data.title || "ALIZZ STORE").slice(0, 120);
  const options = {
    body: String(data.body || "Ada info terbaru dari ALIZZ STORE.").slice(0, 240),
    icon: data.icon || "/alizz-pp.jpg",
    badge: data.badge || "/alizz-pp.jpg",
    image: data.image || undefined,
    data: {
      url: data.url || data.target_url || "/produk/"
    },
    vibrate: [80, 40, 80],
    requireInteraction: false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const targetUrl = event.notification && event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : "/produk/";

  event.waitUntil((async function () {
    const allClients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    const absoluteUrl = new URL(targetUrl, self.location.origin).href;

    for (const client of allClients) {
      if (client.url === absoluteUrl && "focus" in client) {
        return client.focus();
      }
    }

    if (self.clients.openWindow) {
      return self.clients.openWindow(absoluteUrl);
    }
  })());
});
