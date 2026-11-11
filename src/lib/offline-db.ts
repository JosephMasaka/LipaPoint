/**
 * Offline Mode — storage and sync loop (client side).
 *
 * Offline Mode is free for every tenant on every plan
 * (`FEATURE_REGISTRY["offline-mode"].free`), so nothing here consults an
 * entitlement: a till whose internet drops can always queue a sale and the
 * queue owns replaying it.
 *
 * Design notes (each one exists because its absence loses or duplicates a
 * sale):
 *
 *  - **Claims.** A record is stamped `syncingAt` inside the same IndexedDB
 *    readwrite transaction that selects it, so a page and the service worker
 *    (or two tabs) can never replay the same write simultaneously. A claim
 *    older than CLAIM_TTL_MS is reclaimable, so a crashed worker can't park a
 *    sale forever.
 *  - **Idempotency.** Every replay carries `x-idempotency-key: <clientRef>`;
 *    the API records the response for that key (src/lib/idempotency.ts), so a
 *    request that landed but whose reply was lost returns the original result
 *    instead of creating a second sale.
 *  - **Backoff.** Network errors, 5xx, 408/425/429 are retried with
 *    exponential backoff; any other 4xx is a permanent refusal (price floor,
 *    stock, validation) and stays in the queue marked "needs attention" until
 *    a cashier retries or discards it by hand.
 *  - **Nothing is dropped silently.** A refused record is never deleted just
 *    because the server said no.
 */

import {
  buildActionRequest,
  buildOrderRequest,
  classifyFailure,
  describeRecord,
  isDue,
  newClientRef,
  normalizeRecord,
  retryDelayMs,
  type OfflineActionType,
  type OfflineRecord,
  type QueueItem,
  type QueueSummary,
  type SyncRequest,
} from "./offline-sync";

const DB_NAME = "lipapoint-offline";
const DB_VERSION = 2;

type StoreName = "offline-orders" | "offline-actions";

const ORDERS: StoreName = "offline-orders";
const ACTIONS: StoreName = "offline-actions";

/** Fired on `window` and over BroadcastChannel after any queue mutation, so
 *  every open tab's indicator updates without polling. */
export const OFFLINE_QUEUE_EVENT = "lipapoint:offline-queue-changed";
const CHANNEL_NAME = "lipapoint-offline";

const LAST_SYNC_KEY = "lipapoint-offline-last-sync";

/** A hung request must not hold its claim for the full claim TTL. */
const REQUEST_TIMEOUT_MS = 20_000;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(ORDERS)) {
        db.createObjectStore(ORDERS, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("cached-products")) {
        db.createObjectStore("cached-products", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("cached-settings")) {
        db.createObjectStore("cached-settings", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(ACTIONS)) {
        db.createObjectStore(ACTIONS, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

let channel: BroadcastChannel | null = null;

/** Tells every surface (this tab, other tabs, the indicator) that the queue
 *  changed. Best-effort: no queue mutation depends on it succeeding. */
function announce(): void {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
    }
  } catch {
    /* non-browser context */
  }
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel ??= new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({ type: OFFLINE_QUEUE_EVENT });
    }
  } catch {
    /* BroadcastChannel unsupported — this tab still updates */
  }
}

function isBrowserOnline(): boolean {
  try {
    return typeof navigator === "undefined" || navigator.onLine !== false;
  } catch {
    return true;
  }
}

export function getLastSyncAt(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

function setLastSyncAt(iso: string): void {
  try {
    localStorage.setItem(LAST_SYNC_KEY, iso);
  } catch {
    /* storage full/blocked — the timestamp is cosmetic */
  }
}

/* ------------------------------------------------------------------ *
 * Enqueue
 * ------------------------------------------------------------------ */

interface NewRecord {
  data: Record<string, unknown>;
  createdAt: string;
  clientRef: string;
  attempts: number;
  type?: OfflineActionType;
}

function addRecord(store: StoreName, record: NewRecord): Promise<number> {
  return openDB().then(
    (db) =>
      new Promise<number>((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        const objectStore = tx.objectStore(store);
        const request = objectStore.add(record);
        request.onsuccess = () => resolve(request.result as number);
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => announce();
      })
  );
}

/**
 * Queues a sale. Rejects only on a storage failure (quota, private mode) —
 * never because of plan, tier or connectivity. Callers treat a rejection as
 * "this sale was not saved" and say so on screen.
 *
 * `clientRef` lets the caller reuse the idempotency key of a sale whose live
 * POST may already have landed (the reply was lost): replaying the queued copy
 * then returns the original order instead of ringing up a second one.
 */
export async function saveOfflineOrder(
  orderData: Record<string, unknown>,
  clientRef?: string
): Promise<number> {
  return addRecord(ORDERS, {
    data: orderData,
    createdAt: new Date().toISOString(),
    clientRef: clientRef ?? newClientRef(),
    attempts: 0,
  });
}

/** Queues any non-sale mutation (stock, tabs, products, settings, staff…). */
export async function saveOfflineAction(
  type: OfflineActionType,
  data: Record<string, unknown>
): Promise<number> {
  return addRecord(ACTIONS, {
    type,
    data,
    createdAt: new Date().toISOString(),
    clientRef: newClientRef(),
    attempts: 0,
  });
}

/* ------------------------------------------------------------------ *
 * Reading the queue
 * ------------------------------------------------------------------ */

function readAll<T>(store: StoreName): Promise<T[]> {
  return openDB().then(
    (db) =>
      new Promise<T[]>((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const request = tx.objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
      })
  );
}

export async function getOfflineOrders(): Promise<OfflineRecord[]> {
  return readAll<OfflineRecord>(ORDERS);
}

export async function getOfflineActions(): Promise<OfflineRecord[]> {
  return readAll<OfflineRecord>(ACTIONS);
}

export async function getPendingCount(): Promise<number> {
  try {
    const [orders, actions] = await Promise.all([
      getOfflineOrders(),
      getOfflineActions(),
    ]);
    return orders.length + actions.length;
  } catch {
    return 0;
  }
}

/** Pending writes for the queue inspector, oldest first. */
export async function getQueue(): Promise<QueueItem[]> {
  try {
    const [orders, actions] = await Promise.all([
      getOfflineOrders(),
      getOfflineActions(),
    ]);
    return [
      ...orders.map((record) => describeRecord(ORDERS, normalizeRecord(record))),
      ...actions.map((record) => describeRecord(ACTIONS, normalizeRecord(record))),
    ]
      .filter((item): item is QueueItem => item !== null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * Manual queue controls
 * ------------------------------------------------------------------ */

async function mutateRecord(
  store: StoreName,
  id: number,
  mutate: (record: OfflineRecord) => OfflineRecord
): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const objectStore = tx.objectStore(store);
    const request = objectStore.get(id);
    request.onsuccess = () => {
      const record = request.result as OfflineRecord | undefined;
      if (record) objectStore.put(mutate(record));
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  announce();
}

/** Applies a mutation to every record in a store in one transaction. */
async function mapStore(
  store: StoreName,
  mutate: (record: OfflineRecord) => OfflineRecord | null
): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const objectStore = tx.objectStore(store);
    const request = objectStore.getAll();
    request.onsuccess = () => {
      for (const record of request.result as OfflineRecord[]) {
        const next = mutate(record);
        if (next) objectStore.put(next);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  announce();
}

async function deleteRecord(store: StoreName, id: number): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  announce();
}

/** Kept for callers that already have an id (and for the check script). */
export async function removeOfflineOrder(id: number): Promise<void> {
  await deleteRecord(ORDERS, id);
}

export async function removeOfflineAction(id: number): Promise<void> {
  await deleteRecord(ACTIONS, id);
}

/** Puts one record back at the front of the line — ignores backoff, clears a
 *  permanent refusal, and lets the next sync try again (e.g. after the owner
 *  raised the till's price floor). */
export async function retryQueueRecord(item: Pick<QueueItem, "id" | "store">): Promise<void> {
  await mutateRecord(item.store, item.id, (record) => ({
    ...record,
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
    rejectedAt: null,
    rejectReason: null,
    syncingAt: null,
  }));
}

/** Gives up on a queued write. Only a human does this — the sync loop never
 *  drops a record it couldn't apply. */
export async function discardQueueRecord(item: Pick<QueueItem, "id" | "store">): Promise<void> {
  await deleteRecord(item.store, item.id);
}

const resetForRetry = (record: OfflineRecord): OfflineRecord => ({
  ...record,
  attempts: 0,
  nextAttemptAt: null,
  lastError: null,
  rejectedAt: null,
  rejectReason: null,
  syncingAt: null,
});

/** Retries everything that is waiting or needs attention. */
export async function retryAllQueueRecords(): Promise<void> {
  await Promise.all([mapStore(ORDERS, resetForRetry), mapStore(ACTIONS, resetForRetry)]);
}

/** Clears backoff after the connection is confirmed back, so a long outage
 *  doesn't make sales wait up to the backoff ceiling. */
export async function releaseQueueBackoff(): Promise<void> {
  const clear = (record: OfflineRecord): OfflineRecord | null =>
    !record.rejectedAt && record.nextAttemptAt
      ? { ...record, nextAttemptAt: null }
      : null;
  await Promise.all([mapStore(ORDERS, clear), mapStore(ACTIONS, clear)]);
}

/* ------------------------------------------------------------------ *
 * Replay
 * ------------------------------------------------------------------ */

async function claimDue(store: StoreName, now: number): Promise<OfflineRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const objectStore = tx.objectStore(store);
    const request = objectStore.getAll();
    let claimed: OfflineRecord[] = [];

    request.onsuccess = () => {
      const all = (request.result as OfflineRecord[]).map(normalizeRecord);
      claimed = all.filter((record) => isDue(record, now));
      const stamp = new Date(now).toISOString();
      // Claim inside the same transaction that selected them: the write lock
      // is what makes this atomic against the service worker / other tabs.
      for (const record of claimed) {
        objectStore.put({ ...record, syncingAt: stamp });
      }
    };
    tx.oncomplete = () => resolve(claimed);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function readFailureReason(response: Response): Promise<string> {
  try {
    const body = (await response.clone().json()) as { error?: unknown };
    if (body && typeof body.error === "string" && body.error) return body.error;
  } catch {
    /* non-JSON error body */
  }
  return `The server refused it (HTTP ${response.status})`;
}

async function replay(
  store: StoreName,
  record: OfflineRecord,
  request: SyncRequest | null
): Promise<"synced" | "retried" | "rejected"> {
  const id = record.id!;

  if (!request) {
    await mutateRecord(store, id, (current) => ({
      ...current,
      syncingAt: null,
      rejectedAt: new Date().toISOString(),
      rejectReason: `Unknown change type${record.type ? ` "${record.type}"` : ""}`,
    }));
    return "rejected";
  }

  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    : null;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      // Exactly-once: the API replays the original response for this key.
      "x-idempotency-key": record.clientRef,
    };
    const response = await fetch(request.url, {
      method: request.method,
      headers,
      body:
        request.method === "DELETE"
          ? undefined
          : JSON.stringify(request.body ?? {}),
      signal: controller?.signal,
    });

    if (response.ok) {
      await deleteRecord(store, id);
      return "synced";
    }

    const reason = await readFailureReason(response);
    if (classifyFailure(response.status) === "reject") {
      await mutateRecord(store, id, (current) => ({
        ...current,
        syncingAt: null,
        attempts: (current.attempts ?? 0) + 1,
        lastAttemptAt: new Date().toISOString(),
        nextAttemptAt: null,
        lastError: reason,
        rejectedAt: new Date().toISOString(),
        rejectReason: reason,
      }));
      return "rejected";
    }

    await mutateRecord(store, id, (current) => {
      const attempts = (current.attempts ?? 0) + 1;
      const now = Date.now();
      return {
        ...current,
        syncingAt: null,
        attempts,
        lastAttemptAt: new Date(now).toISOString(),
        nextAttemptAt: new Date(now + retryDelayMs(attempts)).toISOString(),
        lastError: reason,
      };
    });
    return "retried";
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "The request timed out"
        : "No connection to the server";
    await mutateRecord(store, id, (current) => {
      const attempts = (current.attempts ?? 0) + 1;
      const now = Date.now();
      return {
        ...current,
        syncingAt: null,
        attempts,
        lastAttemptAt: new Date(now).toISOString(),
        nextAttemptAt: new Date(now + retryDelayMs(attempts)).toISOString(),
        lastError: message,
      };
    });
    return "retried";
  } finally {
    if (timer) clearTimeout(timer);
  }
}

let inflight: Promise<QueueSummary> | null = null;

/**
 * Replays everything that's due: sales first (money), then other changes.
 * Safe to call from anywhere, as often as you like — concurrent calls share
 * one run, and claims keep other workers off the same records.
 */
export function syncQueue(): Promise<QueueSummary> {
  if (inflight) return inflight;

  inflight = (async (): Promise<QueueSummary> => {
    const summary: QueueSummary = {
      synced: 0,
      retried: 0,
      rejected: 0,
      remaining: 0,
    };

    if (!isBrowserOnline()) {
      summary.remaining = await getPendingCount();
      return summary;
    }

    try {
      const now = Date.now();
      const orders = await claimDue(ORDERS, now);
      for (const record of orders) {
        const outcome = await replay(
          ORDERS,
          record,
          buildOrderRequest(record.data)
        );
        if (outcome === "synced") summary.synced++;
        else if (outcome === "rejected") summary.rejected++;
        else summary.retried++;
      }

      const actions = await claimDue(ACTIONS, now);
      for (const record of actions) {
        const outcome = await replay(
          ACTIONS,
          record,
          buildActionRequest(record.type ?? "", record.data)
        );
        if (outcome === "synced") summary.synced++;
        else if (outcome === "rejected") summary.rejected++;
        else summary.retried++;
      }

      if (summary.synced > 0) setLastSyncAt(new Date().toISOString());
    } finally {
      summary.remaining = await getPendingCount();
      announce();
    }

    return summary;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

/** Best-effort Background Sync registration (Chromium), plus an in-page sync
 *  now — Safari/Firefox have no Background Sync, and a registered sync is not
 *  a promise the browser runs it soon. */
export async function requestBackgroundSync(): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const sync = (
        registration as ServiceWorkerRegistration & {
          sync?: { register: (tag: string) => Promise<void> };
        }
      ).sync;
      if (sync?.register) await sync.register("sync-orders");
    }
  } catch {
    /* Background Sync unavailable — the in-page run below covers it */
  }
  void syncQueue();
}

/* ------------------------------------------------------------------ *
 * Read caches (POS works from these when the network is gone)
 * ------------------------------------------------------------------ */

export async function cacheProducts(
  products: Record<string, unknown>[]
): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("cached-products", "readwrite");
    const store = tx.objectStore("cached-products");
    store.clear();
    products.forEach((product) => store.put(product));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedProducts(): Promise<Record<string, unknown>[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached-products", "readonly");
    const request = tx.objectStore("cached-products").getAll();
    request.onsuccess = () => resolve(request.result as Record<string, unknown>[]);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheSetting(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("cached-settings", "readwrite");
    tx.objectStore("cached-settings").put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedSetting(key: string): Promise<unknown | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached-settings", "readonly");
    const request = tx.objectStore("cached-settings").get(key);
    request.onsuccess = () =>
      resolve((request.result as { value?: unknown } | undefined)?.value ?? null);
    request.onerror = () => reject(request.error);
  });
}
