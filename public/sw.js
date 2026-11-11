/**
 * LipaPoint service worker.
 *
 * Two jobs: keep the till shell usable with no network, and drain the offline
 * write queue in the background. Offline Mode is free for every tenant and
 * plan, so nothing here is gated.
 *
 * The queue contract (record fields, retry timing, request mapping) is shared
 * with src/lib/offline-sync.ts. A service worker can't import that module, so
 * the few pure helpers are mirrored below — keep them in step (pinned by
 * offline-mode.check.ts on the TS side).
 */

const CACHE_VERSION = "lipapoint-v8";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

const DB_NAME = "lipapoint-offline";
const DB_VERSION = 2;
const CLAIM_TTL_MS = 2 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20_000;

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
  "/api/features",
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

  // The connectivity probe must always hit the network: answering it from a
  // cache would tell the till it's online while nothing can reach the server.
  if (url.pathname === "/api/health") {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ ok: false, offline: true }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
      )
    );
    return;
  }

  // Mutations are never answered by this worker. Synthesising a success here
  // (the old 202) made a page believe a write had landed when it had not —
  // and the offline queue's own replay POST is intercepted by this same
  // handler, so a fabricated 202 deleted queued sales instead of retrying
  // them. Letting the browser perform the request means a dead network is a
  // real fetch failure, which is exactly the signal callers queue on.
  if (request.method !== "GET") return;

  // API routes: network-first with cache fallback
  if (url.pathname.startsWith("/api/")) {
    const shouldCache = API_CACHE_ROUTES.some((r) => url.pathname.startsWith(r));
    if (shouldCache) {
      event.respondWith(networkFirstAPI(request));
    } else {
      event.respondWith(
        fetch(request).catch(
          () =>
            new Response(JSON.stringify({ error: "Offline" }), {
              status: 503,
              headers: { "Content-Type": "application/json" },
            })
        )
      );
    }
    return;
  }

  // RSC requests — client-side navigation in Next.js App Router
  const isRSC =
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-State-Tree") !== null;

  if (isRSC) {
    event.respondWith(handleRSC(request));
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

// Full-page navigation handler
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      caches.open(PAGE_CACHE).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch {
    // Try exact cache match in PAGE_CACHE
    const cached = await caches.match(request, { cacheName: PAGE_CACHE });
    if (cached) return cached;

    // For dashboard routes, try to find any cached HTML page for this tenant
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    if (pathParts.length >= 3 && !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/_next/")) {
      const tenantSlug = pathParts[1];
      const cachedPage = await findCachedHTMLPage(tenantSlug);
      if (cachedPage) return cachedPage;
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

// Only return responses that are actually HTML pages
async function findCachedHTMLPage(tenantSlug) {
  const cache = await caches.open(PAGE_CACHE);
  const keys = await cache.keys();
  const tenantPrefix = `/${tenantSlug}/`;

  const dashboardKeys = keys.filter((k) => {
    const keyUrl = new URL(k.url);
    return keyUrl.pathname.startsWith(tenantPrefix) &&
      !keyUrl.pathname.includes("/_next/") &&
      !keyUrl.pathname.startsWith(`${tenantPrefix}api/`);
  });

  for (const key of dashboardKeys) {
    const response = await cache.match(key);
    if (response) {
      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("text/html")) {
        return response;
      }
    }
  }

  return null;
}

// RSC handler — cache by pathname only (strip varying headers)
async function handleRSC(request) {
  const url = new URL(request.url);
  const cacheKey = new Request(url.pathname + url.search, {
    headers: { "X-RSC-Cache": "1" },
  });

  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      caches.open(DYNAMIC_CACHE).then((cache) => cache.put(cacheKey, clone));
    }
    return response;
  } catch {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    // Fallback: redirect browser to do a full page navigation, which
    // handleNavigation can answer from the page cache.
    return Response.redirect(url.href, 302);
  }
}

// API handler — cache by URL (ignoring Vary headers)
async function networkFirstAPI(request) {
  const url = new URL(request.url);
  const cacheKey = new Request(url.pathname + url.search);

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(cacheKey, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(API_CACHE);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const baseKey = new Request(url.pathname);
    const baseCached = await cache.match(baseKey);
    if (baseCached) return baseCached;

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
        const cacheName = request.url.includes("/_next/static") ? STATIC_CACHE : DYNAMIC_CACHE;
        caches.open(cacheName).then((cache) => cache.put(request, response.clone()));
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    fetchPromise;
    return cached;
  }

  const networkResponse = await fetchPromise;
  if (networkResponse) return networkResponse;

  return new Response("Offline", { status: 503 });
}

/* ------------------------------------------------------------------ *
 * Offline write queue (mirrors src/lib/offline-sync.ts)
 * ------------------------------------------------------------------ */

function retryDelayMs(attempts) {
  return Math.min(10_000 * 2 ** Math.max(0, attempts - 1), 2 * 60 * 1000);
}

function classifyFailure(status) {
  if (status === 408 || status === 425 || status === 429) return "retry";
  if (status >= 400 && status < 500) return "reject";
  return "retry";
}

function isDue(record, now) {
  if (record.rejectedAt) return false;
  if (record.syncingAt && now - Date.parse(record.syncingAt) < CLAIM_TTL_MS) return false;
  const next = record.nextAttemptAt ? Date.parse(record.nextAttemptAt) : 0;
  return !Number.isFinite(next) || next <= now;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("offline-orders")) {
        db.createObjectStore("offline-orders", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("offline-actions")) {
        db.createObjectStore("offline-actions", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("cached-products")) {
        db.createObjectStore("cached-products", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("cached-settings")) {
        db.createObjectStore("cached-settings", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function buildOrderRequest(data) {
  return { url: "/api/orders", method: "POST", body: data };
}

function buildActionRequest(type, data) {
  switch (type) {
    case "stock_add":
      return { url: "/api/stock", method: "POST", body: { action: "addStock", ...data } };
    case "stock_initialize":
      return { url: "/api/stock", method: "POST", body: { action: "initialize", ...data } };
    case "tab_open":
      return { url: "/api/orders/tabs", method: "POST", body: data };
    case "tab_add":
      return { url: "/api/orders/tabs", method: "PUT", body: { action: "add", ...data } };
    case "expense_add":
      return { url: "/api/expenses", method: "POST", body: data };
    case "unit_create":
      return { url: "/api/units", method: "POST", body: data };
    case "unit_conversion":
      return { url: "/api/units", method: "PUT", body: data };
    case "product_create":
      return { url: "/api/products", method: "POST", body: data };
    case "product_update":
      return { url: "/api/products/" + data._productId, method: "PUT", body: data };
    case "location_add":
      return { url: "/api/locations", method: "POST", body: data };
    case "location_update":
      return { url: "/api/locations", method: "PUT", body: data };
    case "user_create":
      return { url: "/api/users", method: "POST", body: data };
    case "user_toggle":
      return { url: "/api/users/" + data._userId, method: "PATCH", body: { isActive: data.isActive } };
    case "user_delete":
      return { url: "/api/users/" + data._userId, method: "DELETE" };
    case "role_create":
      return { url: "/api/roles", method: "POST", body: data };
    case "role_update":
      return { url: "/api/roles", method: "PUT", body: data };
    case "settings_update":
      return { url: "/api/settings", method: "PUT", body: data };
    default:
      return null;
  }
}

/** Claims the records this worker may replay, atomically. */
function claimDue(db, storeName, now) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    let claimed = [];
    request.onsuccess = () => {
      claimed = request.result.filter((record) => isDue(record, now));
      const stamp = new Date(now).toISOString();
      claimed.forEach((record) => store.put({ ...record, syncingAt: stamp }));
    };
    tx.oncomplete = () => resolve(claimed);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function deleteRecord(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function putRecord(db, storeName, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function notifyClients(message) {
  try {
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach((client) => client.postMessage(message));
  } catch {
    /* no clients */
  }
}

/**
 * A queued write the server refused (price floor, stock, validation…). The
 * record STAYS in the queue — a sale is never dropped silently — and the
 * reason is raised as a notification exactly once.
 */
async function reportRejection(db, storeName, record, reason) {
  if (record.rejectedAt) return;
  await putRecord(db, storeName, {
    ...record,
    syncingAt: null,
    attempts: (record.attempts || 0) + 1,
    lastAttemptAt: new Date().toISOString(),
    rejectedAt: new Date().toISOString(),
    rejectReason: reason,
    lastError: reason,
  });

  try {
    await self.registration.showNotification("Offline change not accepted", {
      body: `${record.data && record.data.orderNo ? record.data.orderNo : record.type || "Offline change"}: ${reason}`,
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
      tag: `rejected-${storeName}-${record.id}`,
    });
  } catch {
    /* notifications can be blocked */
  }
}

async function replayOne(db, storeName, record, request) {
  if (!request) {
    await reportRejection(db, storeName, record, "Unknown change type");
    return "rejected";
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;

  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        "x-idempotency-key": record.clientRef || `legacy-${storeName}-${record.id}`,
      },
      body: request.method === "DELETE" ? undefined : JSON.stringify(request.body || {}),
      signal: controller ? controller.signal : undefined,
    });

    if (response.ok) {
      await deleteRecord(db, storeName, record.id);
      return "synced";
    }

    let reason = `The server refused it (HTTP ${response.status})`;
    try {
      const body = await response.clone().json();
      if (body && body.error) reason = body.error;
    } catch {
      /* non-JSON error body */
    }

    if (classifyFailure(response.status) === "reject") {
      await reportRejection(db, storeName, record, reason);
      return "rejected";
    }

    const attempts = (record.attempts || 0) + 1;
    const now = Date.now();
    await putRecord(db, storeName, {
      ...record,
      syncingAt: null,
      attempts,
      lastAttemptAt: new Date(now).toISOString(),
      nextAttemptAt: new Date(now + retryDelayMs(attempts)).toISOString(),
      lastError: reason,
    });
    return "retried";
  } catch {
    const attempts = (record.attempts || 0) + 1;
    const now = Date.now();
    await putRecord(db, storeName, {
      ...record,
      syncingAt: null,
      attempts,
      lastAttemptAt: new Date(now).toISOString(),
      nextAttemptAt: new Date(now + retryDelayMs(attempts)).toISOString(),
      lastError: "No connection to the server",
    });
    return "retried";
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runSync() {
  let synced = 0;
  try {
    const db = await openDB();
    const now = Date.now();

    // Sales first: money before bookkeeping.
    for (const order of await claimDue(db, "offline-orders", now)) {
      const outcome = await replayOne(db, "offline-orders", order, buildOrderRequest(order.data));
      if (outcome === "synced") {
        synced++;
        await notifyClients({
          type: "ORDER_SYNCED",
          orderId: order.id,
          orderNo: order.data && order.data.orderNo,
        });
      }
    }

    for (const action of await claimDue(db, "offline-actions", now)) {
      const outcome = await replayOne(
        db,
        "offline-actions",
        action,
        buildActionRequest(action.type, action.data)
      );
      if (outcome === "synced") synced++;
    }

    if (synced > 0) {
      try {
        await self.registration.showNotification("LipaPoint", {
          body: `${synced} offline change(s) synced successfully`,
          icon: "/icons/icon-192.svg",
          badge: "/icons/icon-192.svg",
          tag: "sync-complete",
        });
      } catch {
        /* notifications can be blocked */
      }
    }
  } catch (error) {
    console.error("Offline sync failed:", error);
  } finally {
    await notifyClients({ type: "QUEUE_CHANGED" });
  }
}

// Background Sync: replay whatever is due
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-orders") {
    event.waitUntil(runSync());
  }
});

/* ------------------------------------------------------------------ *
 * Push notifications
 * ------------------------------------------------------------------ */

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
  if (event.data?.type === "SYNC_QUEUE") {
    event.waitUntil(runSync());
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
  const pageCache = await caches.open(PAGE_CACHE);
  const apiCache = await caches.open(API_CACHE);

  for (const url of urls) {
    try {
      if (url === "/api/health") continue;
      if (url.startsWith("/api/")) {
        const cacheKey = new Request(url);
        const existing = await apiCache.match(cacheKey);
        if (existing) continue;
        const response = await fetch(url);
        if (response.ok) {
          await apiCache.put(cacheKey, response);
        }
      } else {
        const existing = await pageCache.match(url);
        if (existing) continue;
        const response = await fetch(url);
        if (response.ok) {
          await pageCache.put(url, response);
        }
      }
    } catch {
      // Network failed, skip
    }
  }
}
