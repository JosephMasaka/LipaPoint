const CACHE_VERSION = "lipapoint-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;

const STATIC_ASSETS = [
  "/",
  "/login",
  "/offline",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

const API_CACHE_ROUTES = [
  "/api/products",
  "/api/settings",
  "/api/auth/me",
];

// Install: cache shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("lipapoint-") && !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    // For POST/PUT requests, try network and queue if offline
    if (url.pathname.startsWith("/api/orders") && !navigator.onLine) {
      event.respondWith(
        new Response(JSON.stringify({ queued: true, offline: true }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        })
      );
    }
    return;
  }

  // API routes: network-first with cache fallback
  if (url.pathname.startsWith("/api/")) {
    const shouldCache = API_CACHE_ROUTES.some((r) => url.pathname.startsWith(r));
    if (shouldCache) {
      event.respondWith(networkFirstWithCache(request, API_CACHE));
    } else {
      event.respondWith(
        fetch(request).catch(() =>
          new Response(JSON.stringify({ error: "Offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
        )
      );
    }
    return;
  }

  // Static assets & pages: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "Offline", cached: false }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok && response.type !== "opaque") {
        const cache_name = request.url.includes("/_next/static") ? STATIC_CACHE : DYNAMIC_CACHE;
        caches.open(cache_name).then((cache) => cache.put(request, response.clone()));
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    fetchPromise; // fire-and-forget background update
    return cached;
  }

  const networkResponse = await fetchPromise;
  if (networkResponse) return networkResponse;

  // Offline fallback for navigation requests
  if (request.mode === "navigate") {
    const offlinePage = await caches.match("/offline");
    if (offlinePage) return offlinePage;
  }

  return new Response("Offline", { status: 503 });
}

// Background Sync: retry failed orders
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-orders") {
    event.waitUntil(syncOfflineOrders());
  }
});

async function syncOfflineOrders() {
  try {
    const db = await openDB();
    const tx = db.transaction("offline-orders", "readonly");
    const store = tx.objectStore("offline-orders");
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = async () => {
        const orders = request.result;
        const synced = [];

        for (const order of orders) {
          try {
            const res = await fetch("/api/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(order.data),
            });
            if (res.ok) {
              synced.push(order.id);
              // Notify the client
              const clients = await self.clients.matchAll();
              clients.forEach((client) =>
                client.postMessage({ type: "ORDER_SYNCED", orderId: order.id, orderNo: order.data.orderNo })
              );
            }
          } catch {
            // Will retry on next sync
          }
        }

        // Remove synced orders
        if (synced.length > 0) {
          const deleteTx = db.transaction("offline-orders", "readwrite");
          const deleteStore = deleteTx.objectStore("offline-orders");
          synced.forEach((id) => deleteStore.delete(id));

          self.registration.showNotification("LipaPoint", {
            body: `${synced.length} offline order(s) synced successfully`,
            icon: "/icons/icon-192.svg",
            badge: "/icons/icon-192.svg",
            tag: "sync-complete",
          });
        }

        resolve();
      };
      request.onerror = reject;
    });
  } catch (e) {
    console.error("Sync failed:", e);
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("lipapoint-offline", 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("offline-orders")) {
        db.createObjectStore("offline-orders", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("cached-products")) {
        db.createObjectStore("cached-products", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Push Notifications
self.addEventListener("push", (event) => {
  let data = { title: "LipaPoint", body: "You have a new notification" };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/icons/icon-192.svg",
    badge: "/icons/icon-192.svg",
    tag: data.tag || "general",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/" },
    actions: data.actions || [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => new URL(c.url).pathname === url);
      if (existing) {
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

// Periodic sync for notifications check
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "check-notifications") {
    event.waitUntil(
      fetch("/api/notifications/check")
        .then((r) => r.json())
        .then((data) => {
          if (data.notifications?.length > 0) {
            data.notifications.forEach((n) => {
              self.registration.showNotification(n.title, {
                body: n.body,
                icon: "/icons/icon-192.svg",
                badge: "/icons/icon-192.svg",
                tag: n.tag,
                data: { url: n.url },
              });
            });
          }
        })
        .catch(() => {})
    );
  }
});

// Listen for messages from the client
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "CACHE_URLS") {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then((cache) =>
        cache.addAll(event.data.urls.filter((url) => url.startsWith("/")))
      )
    );
  }
});
