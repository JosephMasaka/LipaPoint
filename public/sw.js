const CACHE_VERSION = "lipapoint-v5";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;

const STATIC_ASSETS = [
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

const API_CACHE_ROUTES = [
  "/api/products",
  "/api/settings",
  "/api/auth/me",
  "/api/orders",
  "/api/orders/tabs",
  "/api/categories",
  "/api/units",
  "/api/locations",
  "/api/expenses",
  "/api/stock",
  "/api/dashboard",
  "/api/analytics",
  "/api/transactions",
  "/api/users",
  "/api/roles",
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
    // For non-GET requests, try network; if it fails, return offline signal
    if (url.pathname.startsWith("/api/")) {
      event.respondWith(
        fetch(request).catch(() =>
          new Response(JSON.stringify({ queued: true, offline: true }), {
            status: 202,
            headers: { "Content-Type": "application/json" },
          })
        )
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

  // RSC (React Server Component) requests — client-side navigation in Next.js
  // These have the same URL as pages but include RSC headers
  const isRSC = request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-State-Tree") !== null;

  if (isRSC) {
    event.respondWith(networkFirstRSC(request));
    return;
  }

  // Navigation requests: network-first, offline fallback
  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Static assets & pages: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch {
    // Try exact cache match first
    const cached = await caches.match(request);
    if (cached) return cached;

    // For dashboard routes, try to find any cached dashboard page
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    // Pattern: /{tenant}/{page} — check if this is a dashboard route
    if (pathParts.length >= 3 && !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/_next/")) {
      const tenantSlug = pathParts[1];
      const cachedDashboard = await findCachedDashboardPage(tenantSlug, url.pathname);
      if (cachedDashboard) return cachedDashboard;
    }

    // Final fallback: offline.html
    const offlinePage = await caches.match("/offline.html");
    if (offlinePage) return offlinePage;
    return new Response(
      '<html><body style="font-family:sans-serif;background:#09090b;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center"><div><h1>Offline</h1><p>Check your connection.</p></div></body></html>',
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  }
}

async function findCachedDashboardPage(tenantSlug, requestedPath) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const keys = await cache.keys();

  // Priority order for offline dashboard pages
  const preferredPages = ["pos", "orders", "tabs", "inventory", "dashboard"];
  const requestedPage = requestedPath.split("/").pop();

  // First try the exact requested page
  for (const key of keys) {
    const keyUrl = new URL(key.url);
    if (keyUrl.pathname === requestedPath) {
      return cache.match(key);
    }
  }

  // Then try other cached dashboard pages for same tenant
  // Sort by preference (pos first since it works best offline)
  const tenantPrefix = `/${tenantSlug}/`;
  const dashboardKeys = keys.filter((k) => {
    const keyUrl = new URL(k.url);
    return keyUrl.pathname.startsWith(tenantPrefix) && !keyUrl.pathname.includes("/_next/");
  });

  // Sort by preference
  dashboardKeys.sort((a, b) => {
    const aPage = new URL(a.url).pathname.split("/").pop();
    const bPage = new URL(b.url).pathname.split("/").pop();
    const aIdx = preferredPages.indexOf(aPage);
    const bIdx = preferredPages.indexOf(bPage);
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });

  if (dashboardKeys.length > 0) {
    return cache.match(dashboardKeys[0]);
  }

  return null;
}

async function networkFirstRSC(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch {
    // Try cached RSC response
    const cached = await caches.match(request);
    if (cached) return cached;

    // Return empty RSC payload that triggers client-side navigation fallback
    return new Response("", {
      status: 503,
      headers: { "Content-Type": "text/x-component" },
    });
  }
}

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

  return new Response("Offline", { status: 503 });
}

// Background Sync: retry failed orders and actions
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-orders") {
    event.waitUntil(
      Promise.all([syncOfflineOrders(), syncOfflineActions()])
    );
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
              const clients = await self.clients.matchAll();
              clients.forEach((client) =>
                client.postMessage({ type: "ORDER_SYNCED", orderId: order.id, orderNo: order.data.orderNo })
              );
            }
          } catch {
            // Will retry on next sync
          }
        }

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
    const request = indexedDB.open("lipapoint-offline", 2);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("offline-orders")) {
        db.createObjectStore("offline-orders", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("cached-products")) {
        db.createObjectStore("cached-products", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("offline-actions")) {
        db.createObjectStore("offline-actions", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function syncOfflineActions() {
  try {
    const db = await openDB();
    const tx = db.transaction("offline-actions", "readonly");
    const store = tx.objectStore("offline-actions");
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = async () => {
        const actions = request.result;
        const synced = [];

        for (const action of actions) {
          try {
            let url = "";
            let method = "POST";
            let body = {};

            switch (action.type) {
              case "stock_add":
                url = "/api/stock";
                body = { action: "addStock", ...action.data };
                break;
              case "stock_initialize":
                url = "/api/stock";
                body = { action: "initialize", ...action.data };
                break;
              case "tab_open":
                url = "/api/orders/tabs";
                body = action.data;
                break;
              case "tab_add":
                url = "/api/orders/tabs";
                method = "PUT";
                body = { action: "add", ...action.data };
                break;
              case "expense_add":
                url = "/api/expenses";
                body = action.data;
                break;
              case "unit_create":
                url = "/api/units";
                body = action.data;
                break;
              case "unit_conversion":
                url = "/api/units";
                method = "PUT";
                body = action.data;
                break;
              case "product_create":
                url = "/api/products";
                body = action.data;
                break;
              case "product_update":
                url = "/api/products/" + action.data._productId;
                method = "PUT";
                body = action.data;
                break;
              case "location_add":
                url = "/api/locations";
                body = action.data;
                break;
              case "location_update":
                url = "/api/locations";
                method = "PUT";
                body = action.data;
                break;
              case "user_create":
                url = "/api/users";
                body = action.data;
                break;
              case "user_toggle":
                url = "/api/users/" + action.data._userId;
                method = "PATCH";
                body = { isActive: action.data.isActive };
                break;
              case "user_delete":
                url = "/api/users/" + action.data._userId;
                method = "DELETE";
                break;
              case "role_create":
                url = "/api/roles";
                body = action.data;
                break;
              case "role_update":
                url = "/api/roles";
                method = "PUT";
                body = action.data;
                break;
              case "settings_update":
                url = "/api/settings";
                method = "PUT";
                body = action.data;
                break;
              default:
                continue;
            }

            const fetchOpts = { method, headers: { "Content-Type": "application/json" } };
            if (method !== "DELETE") fetchOpts.body = JSON.stringify(body);
            const res = await fetch(url, fetchOpts);
            if (res.ok) {
              synced.push(action.id);
            }
          } catch {
            // Will retry on next sync
          }
        }

        if (synced.length > 0) {
          const deleteTx = db.transaction("offline-actions", "readwrite");
          const deleteStore = deleteTx.objectStore("offline-actions");
          synced.forEach((id) => deleteStore.delete(id));
        }

        resolve();
      };
      request.onerror = reject;
    });
  } catch (e) {
    console.error("Action sync failed:", e);
  }
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
  if (event.data?.type === "WARM_CACHE") {
    event.waitUntil(warmCache(event.data.urls || []));
  }
});

async function warmCache(urls) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const apiCache = await caches.open(API_CACHE);

  for (const url of urls) {
    try {
      // Skip if already cached
      const existing = await cache.match(url) || await apiCache.match(url);
      if (existing) continue;

      const response = await fetch(url);
      if (response.ok) {
        if (url.startsWith("/api/")) {
          await apiCache.put(url, response);
        } else {
          await cache.put(url, response);
        }
      }
    } catch {
      // Network failed, skip this URL
    }
  }
}
