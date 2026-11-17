import { buildIntelligence, type IntelligenceOptions } from "./intelligence";
import type { BusinessIntelligence } from "./types";

// In-memory, per server instance. On serverless platforms each instance has
// its own cache, so this reduces load but is not a global guarantee. Move to
// Redis/Upstash if you need a shared cache.
const TTL_MS = 15 * 60 * 1000;
const FORCE_COOLDOWN_MS = 60 * 1000;

export interface IntelligenceRequest extends IntelligenceOptions {
  force?: boolean;
}

const cache = new Map<string, { value: BusinessIntelligence; expiresAt: number; builtAt: number }>();
const inFlight = new Map<string, Promise<BusinessIntelligence>>();

/** One cache entry per tenant + window + branch, so ranges never collide. */
function cacheKey(tenantId: string, opts: IntelligenceRequest): string {
  return [
    tenantId,
    opts.from ? opts.from.toISOString() : "default",
    opts.to ? opts.to.toISOString() : "now",
    opts.locationId ?? "all",
  ].join(":");
}

export async function getIntelligence(
  tenantId: string,
  opts: IntelligenceRequest = {}
): Promise<{ intel: BusinessIntelligence; cached: boolean }> {
  const key = cacheKey(tenantId, opts);
  const hit = cache.get(key);
  const now = Date.now();

  // A forced refresh is honoured at most once per cooldown window per key.
  const canForce = !hit || now - hit.builtAt > FORCE_COOLDOWN_MS;
  const useCache = hit && now < hit.expiresAt && !(opts.force && canForce);
  if (hit && useCache) return { intel: hit.value, cached: true };

  let pending = inFlight.get(key);
  if (!pending) {
    pending = buildIntelligence(tenantId, opts).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  const intel = await pending;
  cache.set(key, { value: intel, expiresAt: Date.now() + TTL_MS, builtAt: Date.now() });
  return { intel, cached: false };
}

/** Call after the tenant changes data that affects intelligence (e.g. a sale). */
export function invalidateIntelligence(tenantId: string): void {
  const prefix = `${tenantId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
