import { getCacheStore } from "@/lib/cache-store";
import { buildIntelligence, type IntelligenceOptions } from "./intelligence";
import type { BusinessIntelligence } from "./types";

// Shared cache when UPSTASH_REDIS_REST_URL is configured, otherwise per-process
// memory (see src/lib/cache-store.ts). Intelligence is derived data: a lost
// cache entry costs a rebuild, never correctness.
const TTL_SECONDS = 15 * 60;
const FORCE_COOLDOWN_MS = 60 * 1000;

export interface IntelligenceRequest extends IntelligenceOptions {
  force?: boolean;
}

interface CachedIntelligence {
  intel: BusinessIntelligence;
  builtAt: number;
}

// Collapses concurrent rebuilds within one process; across processes the cache
// itself is shared, and duplicate builds are merely wasteful.
const inFlight = new Map<string, Promise<BusinessIntelligence>>();

/** One cache entry per tenant + window + branch, so ranges never collide. */
function cacheKey(tenantId: string, opts: IntelligenceRequest): string {
  return [
    "intel",
    tenantId,
    opts.from ? opts.from.toISOString() : "default",
    opts.to ? opts.to.toISOString() : "now",
    opts.locationId ?? "all",
  ].join(":");
}

function tenantPrefix(tenantId: string): string {
  return `intel:${tenantId}:`;
}

export async function getIntelligence(
  tenantId: string,
  opts: IntelligenceRequest = {}
): Promise<{ intel: BusinessIntelligence; cached: boolean }> {
  const store = getCacheStore();
  const key = cacheKey(tenantId, opts);
  const hit = await store.get<CachedIntelligence>(key);
  const now = Date.now();

  // A forced refresh is honoured at most once per cooldown window per key.
  const canForce = !hit || now - hit.builtAt > FORCE_COOLDOWN_MS;
  if (hit && !(opts.force && canForce)) return { intel: hit.intel, cached: true };

  let pending = inFlight.get(key);
  if (!pending) {
    pending = buildIntelligence(tenantId, opts).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  const intel = await pending;
  const entry: CachedIntelligence = { intel, builtAt: Date.now() };
  await store.set(key, entry, TTL_SECONDS).catch((error) => {
    // A cache write failure must not fail the request.
    console.error("Failed to cache intelligence:", error);
  });
  return { intel, cached: false };
}

/**
 * Call after the tenant changes data that affects intelligence (e.g. a sale).
 * Await it where you can: with the shared backend the delete is a network call,
 * so returning before it completes leaves a short window where another instance
 * could still serve the old snapshot.
 */
export async function invalidateIntelligence(tenantId: string): Promise<void> {
  try {
    await getCacheStore().deleteByPrefix(tenantPrefix(tenantId));
  } catch (error) {
    // Invalidation is best effort: stale data expires within the TTL.
    console.error(`Failed to invalidate intelligence for ${tenantId}:`, error);
  }
}
