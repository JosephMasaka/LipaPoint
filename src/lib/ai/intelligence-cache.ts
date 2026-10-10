import { buildIntelligence } from "./intelligence";
import type { BusinessIntelligence } from "./types";

// In-memory, per server instance. On serverless platforms each instance has
// its own cache, so this reduces load but is not a global guarantee. Move to
// Redis/Upstash if you need a shared cache.
const TTL_MS = 15 * 60 * 1000;
const FORCE_COOLDOWN_MS = 60 * 1000;

const cache = new Map<string, { value: BusinessIntelligence; expiresAt: number; builtAt: number }>();
const inFlight = new Map<string, Promise<BusinessIntelligence>>();

export async function getIntelligence(
  tenantId: string,
  opts: { force?: boolean } = {}
): Promise<{ intel: BusinessIntelligence; cached: boolean }> {
  const hit = cache.get(tenantId);
  const now = Date.now();

  // A forced refresh is honoured at most once per cooldown window per tenant.
  const canForce = !hit || now - hit.builtAt > FORCE_COOLDOWN_MS;
  const useCache = hit && now < hit.expiresAt && !(opts.force && canForce);
  if (hit && useCache) return { intel: hit.value, cached: true };

  let pending = inFlight.get(tenantId);
  if (!pending) {
    pending = buildIntelligence(tenantId).finally(() => inFlight.delete(tenantId));
    inFlight.set(tenantId, pending);
  }
  const intel = await pending;
  cache.set(tenantId, { value: intel, expiresAt: Date.now() + TTL_MS, builtAt: Date.now() });
  return { intel, cached: false };
}

/** Call after the tenant changes data that affects intelligence (e.g. location). */
export function invalidateIntelligence(tenantId: string): void {
  cache.delete(tenantId);
}