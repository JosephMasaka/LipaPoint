const DB_NAME = "lipapoint-offline";
const DB_VERSION = 2;

interface OfflineOrder {
  id?: number;
  data: Record<string, unknown>;
  createdAt: string;
  synced: boolean;
}

interface OfflineAction {
  id?: number;
  type:
    | "stock_add"
    | "stock_initialize"
    | "tab_open"
    | "tab_add"
    | "expense_add"
    | "unit_create"
    | "unit_conversion"
    | "product_create"
    | "product_update"
    | "location_add"
    | "location_update"
    | "user_create"
    | "user_toggle"
    | "user_delete"
    | "role_create"
    | "role_update"
    | "settings_update";
  data: Record<string, unknown>;
  createdAt: string;
  synced: boolean;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("offline-orders")) {
        db.createObjectStore("offline-orders", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("cached-products")) {
        db.createObjectStore("cached-products", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("cached-settings")) {
        db.createObjectStore("cached-settings", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("offline-actions")) {
        db.createObjectStore("offline-actions", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineOrder(orderData: Record<string, unknown>): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline-orders", "readwrite");
    const store = tx.objectStore("offline-orders");
    const order: OfflineOrder = {
      data: orderData,
      createdAt: new Date().toISOString(),
      synced: false,
    };
    const request = store.add(order);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineOrders(): Promise<OfflineOrder[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline-orders", "readonly");
    const store = tx.objectStore("offline-orders");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removeOfflineOrder(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline-orders", "readwrite");
    const store = tx.objectStore("offline-orders");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function cacheProducts(products: Record<string, unknown>[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("cached-products", "readwrite");
  const store = tx.objectStore("cached-products");
  store.clear();
  products.forEach((p) => store.put(p));
}

export async function getCachedProducts(): Promise<Record<string, unknown>[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached-products", "readonly");
    const store = tx.objectStore("cached-products");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheSetting(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("cached-settings", "readwrite");
  const store = tx.objectStore("cached-settings");
  store.put({ key, value });
}

export async function getCachedSetting(key: string): Promise<unknown | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached-settings", "readonly");
    const store = tx.objectStore("cached-settings");
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(request.error);
  });
}

// Offline actions (inventory, tabs)
export async function saveOfflineAction(type: OfflineAction["type"], data: Record<string, unknown>): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline-actions", "readwrite");
    const store = tx.objectStore("offline-actions");
    const action: OfflineAction = { type, data, createdAt: new Date().toISOString(), synced: false };
    const request = store.add(action);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineActions(): Promise<OfflineAction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline-actions", "readonly");
    const store = tx.objectStore("offline-actions");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removeOfflineAction(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline-actions", "readwrite");
    const store = tx.objectStore("offline-actions");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function syncOfflineOrders(): Promise<{ synced: number; failed: number }> {
  const orders = await getOfflineOrders();
  let synced = 0;
  let failed = 0;

  for (const order of orders) {
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order.data),
      });
      if (res.ok) {
        await removeOfflineOrder(order.id!);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

export async function syncOfflineActions(): Promise<{ synced: number; failed: number }> {
  const actions = await getOfflineActions();
  let synced = 0;
  let failed = 0;

  for (const action of actions) {
    try {
      let url = "";
      let method = "POST";
      let body: Record<string, unknown> = {};

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
          url = `/api/products/${action.data._productId}`;
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
          url = `/api/users/${action.data._userId}`;
          method = "PATCH";
          body = { isActive: action.data.isActive };
          break;
        case "user_delete":
          url = `/api/users/${action.data._userId}`;
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
      }

      const fetchOpts: RequestInit = {
        method,
        headers: { "Content-Type": "application/json" },
      };
      if (method !== "DELETE") {
        fetchOpts.body = JSON.stringify(body);
      }
      const res = await fetch(url, fetchOpts);

      if (res.ok) {
        await removeOfflineAction(action.id!);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

export async function requestBackgroundSync(): Promise<void> {
  if ("serviceWorker" in navigator && "sync" in (await navigator.serviceWorker.ready)) {
    const reg = await navigator.serviceWorker.ready;
    await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register("sync-orders");
  } else {
    await syncOfflineOrders();
    await syncOfflineActions();
  }
}

export async function getPendingCount(): Promise<number> {
  const orders = await getOfflineOrders();
  const actions = await getOfflineActions();
  return orders.length + actions.length;
}
