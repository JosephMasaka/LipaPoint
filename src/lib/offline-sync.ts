/**
 * Offline Mode — the pure half.
 *
 * Everything the offline write queue needs to decide *what* to replay, *when*
 * to retry, and *how* to describe a queued write, with no IndexedDB, DOM or
 * fetch in sight. `src/lib/offline-db.ts` owns the storage/sync loop and
 * public/sw.js mirrors `buildActionRequest`/`classifyFailure`/`retryDelayMs`
 * (a service worker can't import this module), so the contract lives here and
 * `offline-mode.check.ts` pins it.
 *
 * Offline Mode is free for every tenant and every plan
 * (FEATURE_REGISTRY["offline-mode"].free), so nothing in this layer consults
 * an entitlement — a till that goes dark must always be able to queue.
 */

/** Every mutation the queue can hold, and the action type stored with it. */
export const OFFLINE_ACTION_TYPES = [
  "stock_add",
  "stock_initialize",
  "tab_open",
  "tab_add",
  "expense_add",
  "unit_create",
  "unit_conversion",
  "product_create",
  "product_update",
  "location_add",
  "location_update",
  "user_create",
  "user_toggle",
  "user_delete",
  "role_create",
  "role_update",
  "settings_update",
] as const;

export type OfflineActionType = (typeof OFFLINE_ACTION_TYPES)[number];

/** Human labels for the queue inspector — the cashier sees these. */
export const OFFLINE_ACTION_LABELS: Record<OfflineActionType, string> = {
  stock_add: "Stock received",
  stock_initialize: "Stock-take opened",
  tab_open: "Tab opened",
  tab_add: "Items added to tab",
  expense_add: "Expense recorded",
  unit_create: "Unit created",
  unit_conversion: "Unit conversion saved",
  product_create: "Product created",
  product_update: "Product updated",
  location_add: "Location added",
  location_update: "Location updated",
  user_create: "Staff member added",
  user_toggle: "Staff access changed",
  user_delete: "Staff member removed",
  role_create: "Role created",
  role_update: "Role updated",
  settings_update: "Settings updated",
};

export function offlineActionLabel(type: string): string {
  return OFFLINE_ACTION_LABELS[type as OfflineActionType] ?? "Offline change";
}

/**
 * One queued write. IndexedDB stores plain objects, so this is the exact
 * shape written to the `offline-orders` / `offline-actions` stores.
 *
 * Records written by older builds lack `clientRef`/`attempts`; every helper
 * here treats those as defaults (see `normalizeRecord`) so an upgrade never
 * strands a sale that was already queued on a till.
 */
export interface OfflineRecord {
  id?: number;
  /** Absent on order records — the store they live in is the type. */
  type?: OfflineActionType;
  data: Record<string, unknown>;
  createdAt: string;
  /** Idempotency key sent as `x-idempotency-key`, so a reply lost in the
   *  dark can be replayed without creating a second sale/expense/etc. */
  clientRef: string;
  /** Failed sync attempts so far. */
  attempts?: number;
  lastAttemptAt?: string | null;
  /** Earliest time the next attempt may run (exponential backoff). */
  nextAttemptAt?: string | null;
  lastError?: string | null;
  /** Set when the server permanently refused it (4xx): kept for the cashier
   *  to fix, never retried automatically. */
  rejectedAt?: string | null;
  rejectReason?: string | null;
  /** Stamped by whichever tab/service-worker claimed the record, so two
   *  workers never replay the same write at the same time. */
  syncingAt?: string | null;
}

export interface OfflineOrderRecord extends OfflineRecord {
  data: Record<string, unknown>;
}

/** How long a claim is honoured before another worker may take over. */
export const CLAIM_TTL_MS = 2 * 60 * 1000;

/** Retry delay: 10s, 20s, 40s … capped at 2 minutes (a sale shouldn't wait
 *  longer than that to reach the books once the network is back). */
export function retryDelayMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  return Math.min(10_000 * 2 ** exponent, 2 * 60 * 1000);
}

// 401/403 can be transient (session refresh, revoked-then-regranted). They are
// still treated as permanent: retrying a refused write forever is worse than
// surfacing it, and the queue lets the cashier retry by hand after signing in.

/**
 * Should a failed replay be retried automatically?
 *
 *   network error / 5xx / 408 / 425 / 429 → retry with backoff
 *   any other 4xx                        → the server will never accept it
 *                                          (price floor, stock, duplicate,
 *                                          validation) — keep it queued and
 *                                          ask a human.
 * Anything else (e.g. 3xx) is treated as retriable: a redirect usually means
 * the session expired and the next attempt may succeed.
 */
export type FailureKind = "retry" | "reject";

export function classifyFailure(status: number): FailureKind {
  if (status === 408 || status === 425 || status === 429) return "retry";
  if (status >= 400 && status < 500) return "reject";
  return "retry";
}

export interface SyncRequest {
  url: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
}

/** The HTTP replay for one queued action; null for an unknown type. */
export function buildActionRequest(
  type: string,
  data: Record<string, unknown>
): SyncRequest | null {
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
      return { url: `/api/products/${String(data._productId)}`, method: "PUT", body: data };
    case "location_add":
      return { url: "/api/locations", method: "POST", body: data };
    case "location_update":
      return { url: "/api/locations", method: "PUT", body: data };
    case "user_create":
      return { url: "/api/users", method: "POST", body: data };
    case "user_toggle":
      return {
        url: `/api/users/${String(data._userId)}`,
        method: "PATCH",
        body: { isActive: data.isActive },
      };
    case "user_delete":
      return { url: `/api/users/${String(data._userId)}`, method: "DELETE" };
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

/** The replay for a queued sale — always POST /api/orders. */
export function buildOrderRequest(data: Record<string, unknown>): SyncRequest {
  return { url: "/api/orders", method: "POST", body: data };
}

/** Fills the defaults older records lack, without mutating the stored row. */
export function normalizeRecord<T extends OfflineRecord>(record: T): T & {
  attempts: number;
  clientRef: string;
  nextAttemptAt: string | null;
} {
  return {
    ...record,
    attempts: record.attempts ?? 0,
    clientRef:
      record.clientRef ??
      // Deterministic fallback for rows queued by a pre-clientRef build: the
      // store id plus creation time is stable across replays.
      `legacy-${record.id ?? "0"}-${record.createdAt}`,
    nextAttemptAt: record.nextAttemptAt ?? null,
  };
}

function isClaimed(record: OfflineRecord, now: number): boolean {
  if (!record.syncingAt) return false;
  const claimedAt = Date.parse(record.syncingAt);
  return Number.isFinite(claimedAt) && now - claimedAt < CLAIM_TTL_MS;
}

/** May this record be replayed right now? */
export function isDue(record: OfflineRecord, now = Date.now()): boolean {
  if (record.rejectedAt) return false; // waiting for a human
  if (isClaimed(record, now)) return false;
  const next = record.nextAttemptAt ? Date.parse(record.nextAttemptAt) : 0;
  return !Number.isFinite(next) || next <= now;
}

/** A stable idempotency key for a brand-new queued write. */
export function newClientRef(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* older browsers: fall through to the timestamp form */
  }
  return `ref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface QueueSummary {
  synced: number;
  retried: number;
  rejected: number;
  remaining: number;
}

/** One row of the queue inspector. */
export interface QueueItem {
  id: number;
  store: "offline-orders" | "offline-actions";
  label: string;
  createdAt: string;
  status: "queued" | "retrying" | "needs-attention";
  detail: string | null;
  amount: number | null;
  attempts: number;
}

/** Describes a stored record for the UI (label, status, reason). */
export function describeRecord(
  store: QueueItem["store"],
  record: OfflineRecord
): QueueItem | null {
  if (typeof record.id !== "number") return null;
  const attempts = record.attempts ?? 0;
  const nextAt = record.nextAttemptAt ? Date.parse(record.nextAttemptAt) : 0;
  const waiting = !record.rejectedAt && Number.isFinite(nextAt) && nextAt > Date.now();

  let status: QueueItem["status"] = "queued";
  if (record.rejectedAt) status = "needs-attention";
  else if (waiting && attempts > 0) status = "retrying";

  const detail = record.rejectedAt
    ? record.rejectReason ?? "The server refused this change"
    : record.lastError && attempts > 0
      ? `Last attempt failed: ${record.lastError}`
      : null;

  const amount =
    store === "offline-orders" && typeof record.data.total === "number"
      ? (record.data.total as number)
      : null;

  return {
    id: record.id,
    store,
    label:
      store === "offline-orders"
        ? `Sale ${typeof record.data.orderNo === "string" ? record.data.orderNo : `#${record.id}`}`
        : offlineActionLabel(record.type ?? ""),
    createdAt: record.createdAt,
    status,
    detail,
    amount,
    attempts,
  };
}
