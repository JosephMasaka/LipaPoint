/**
 * Entitlement probe for the paid `offline-mode` feature (sub-feature
 * granularity spec §1/§9 step 8) — client side, no Prisma.
 *
 * The offline write queue in src/lib/offline-db.ts is what Offline Mode
 * actually sells: queue a sale (or any other mutation) while the internet is
 * down and replay it when connectivity returns. Without this check that whole
 * capability would ship free to every plan, so the queue consults the
 * tenant's `offline-mode` row before accepting anything.
 *
 * The answer is cached in localStorage (5-minute TTL) because the queue is
 * consulted *while the browser is offline*, where a network round-trip is
 * impossible: PWAProvider warms the cache on app start, and a stale/absent
 * cache re-fetches in the background.
 *
 * Degradation policy — never lose a sale to a stale cache:
 *  - cache fresh      → use it (a tenant that revoked the feature stops queueing)
 *  - cache stale/none → refresh; if the refresh can't reach the server (we're
 *                       offline) fall back to the last known value, or to
 *                       `true` when we've never managed to fetch one, so a
 *                       first-ever offline sale for an entitled tenant still
 *                       queues. Enforcement tightens on the next online probe.
 */

const ENABLED_KEY = "lipapoint-offline-mode-enabled"; // "1" | "0"
const STAMP_KEY = "lipapoint-offline-mode-checked-at";
const TTL_MS = 5 * 60 * 1000;

let inflight: Promise<boolean> | null = null;

function readCache(): boolean | null {
  try {
    const raw = localStorage.getItem(ENABLED_KEY);
    if (raw === null) return null;
    const at = Number(localStorage.getItem(STAMP_KEY) ?? 0);
    if (!at || Date.now() - at > TTL_MS) return null; // stale, but still a fallback
    return raw === "1";
  } catch {
    return null;
  }
}

/** Last known value regardless of age — the offline fallback. */
function readCacheAllowStale(): boolean | null {
  try {
    const raw = localStorage.getItem(ENABLED_KEY);
    return raw === null ? null : raw === "1";
  } catch {
    return null;
  }
}

function writeCache(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
    localStorage.setItem(STAMP_KEY, String(Date.now()));
  } catch {}
}

/** Fetches the live entitlement and refreshes the cache. Deduplicated. */
export async function refreshOfflineEntitlement(): Promise<boolean> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/features", {
        method: "GET",
        credentials: "include",
        headers: { accept: "application/json" },
      });
      if (!res.ok) return readCacheAllowStale() ?? true;
      const data = (await res.json()) as { enabled?: unknown };
      const enabled =
        Array.isArray(data.enabled) && data.enabled.includes("offline-mode");
      writeCache(enabled);
      return enabled;
    } catch {
      // Offline (or the API hiccuped): trust the last answer we had.
      return readCacheAllowStale() ?? true;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * May this browser queue writes for background sync? Consults the cache and
 * refreshes it whenever it has gone stale (the refresh itself falls back
 * gracefully while offline).
 */
export async function isOfflineQueueEnabled(): Promise<boolean> {
  const fresh = readCache();
  if (fresh !== null) return fresh;
  return refreshOfflineEntitlement();
}

/**
 * Thrown by the offline write queue when the tenant lacks `offline-mode`.
 * Call sites use it as the "this can't be queued" signal: the await rejects,
 * so the "Saved offline — will sync" success path after it never runs, while
 * the `lipapoint:offline-feature-required` event (dispatched just before the
 * throw) lets OfflineIndicator explain why on screen. Throwing instead of
 * returning a sentinel is deliberate — every existing caller ignores the
 * return value and would otherwise report a save that never happened.
 */
export class OfflineModeRequiredError extends Error {
  constructor() {
    super(
      "Offline Mode is not enabled for this tenant — writes cannot be queued for background sync"
    );
    this.name = "OfflineModeRequiredError";
  }
}

/** Puts the answer on screen when the queue refuses a write (offline-db.ts). */
export function announceOfflineFeatureRequired(): void {
  try {
    window.dispatchEvent(new CustomEvent("lipapoint:offline-feature-required"));
  } catch {
    /* non-browser context (tests) — nothing to announce to */
  }
}
