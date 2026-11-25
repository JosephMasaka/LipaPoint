/**
 * Per-tier connection limits for LipaPoint Connect.
 *
 * Deliberately data (a tier map plus environment overrides), not a literal
 * checked at each call site: sales can change a plan's allowance by setting
 * `CONNECT_LIMIT_<TIER>` without a deploy, and the API enforces the same
 * number the UI shows.
 *
 * STARTER gets one connection: enough for a single spreadsheet or custom API
 * feed, which is what a starter customer can actually use. ENTERPRISE is
 * unlimited because large tenants routinely run several systems.
 */

export const DEFAULT_CONNECTION_LIMITS: Record<string, number> = {
  STARTER: 1,
  PROFESSIONAL: 3,
  ENTERPRISE: Number.POSITIVE_INFINITY,
};

/** Invalid or negative overrides are ignored rather than silently locking a tenant out. */
export function connectionLimitForTier(tier: string): number {
  const key = tier.toUpperCase();
  const override = process.env[`CONNECT_LIMIT_${key}`];
  if (override !== undefined && override !== "") {
    const parsed = Number(override);
    if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
    if (override.trim().toLowerCase() === "unlimited") return Number.POSITIVE_INFINITY;
  }
  return DEFAULT_CONNECTION_LIMITS[key] ?? 0;
}

export function canUseConnect(tier: string): boolean {
  return connectionLimitForTier(tier) > 0;
}

export function describeConnectionLimit(limit: number): string {
  if (!Number.isFinite(limit)) return "Unlimited connections";
  if (limit === 0) return "Not included in your plan";
  return limit === 1 ? "1 connection" : `${limit} connections`;
}
