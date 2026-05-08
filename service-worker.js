/* ALIZZ STORE Service Worker - Web Push Notification */
self.addEventListener("install", function (event) {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

function normalizeUrl(url) {
  try {
    return new URL(url || "/produk/", self.location.origin).href;
  } catch (error) {
    return new URL("/produk/", self.location.origin).href;
  }
}

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
  const targetUrl = normalizeUrl(data.url || data.target_url || "/produk/");
  const iconUrl = normalizeUrl(data.icon || "/alizz-pp.jpg");
  const badgeUrl = normalizeUrl(data.badge || "/alizz-pp.jpg");
  const imageUrl = data.image ? normalizeUrl(data.image) : undefined;

  const options = {
    body: String(data.body || "Ada info terbaru dari ALIZZ STORE.").slice(0, 240),
    icon: iconUrl,
    badge: badgeUrl,
    image: imageUrl,
    tag: String(data.tag || "alizz-store-promo").slice(0, 60),
    renotify: true,
    silent: false,
    requireInteraction: false,
    vibrate: [120, 60, 120],
    data: {
      url: targetUrl,
      createdAt: Date.now()
    },
    actions: [
      { action: "open", title: "Buka" }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const targetUrl = event.notification && event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : normalizeUrl("/produk/");

  event.waitUntil((async function () {
    const allClients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    const absoluteUrl = normalizeUrl(targetUrl);

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
