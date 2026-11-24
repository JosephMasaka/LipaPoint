/**
 * How many days of cover a restock suggestion aims for.
 *
 * The value is per tenant (Tenant.restockTargetDays) and always clamped here,
 * so a hand-edited row or an API caller cannot ask for a 0-day or 10-year
 * target and produce nonsense quantities.
 */
export const DEFAULT_TARGET_COVER_DAYS = 14;
export const MIN_TARGET_COVER_DAYS = 1;
export const MAX_TARGET_COVER_DAYS = 120;

export function clampTargetCoverDays(value: unknown): number {
  // `Number(null)` and `Number("")` are both 0, which would read as a
  // deliberate 1-day target — treat absent values as "not set" instead.
  if (value === null || value === undefined || value === "" || typeof value === "boolean") {
    return DEFAULT_TARGET_COVER_DAYS;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_TARGET_COVER_DAYS;
  return Math.min(MAX_TARGET_COVER_DAYS, Math.max(MIN_TARGET_COVER_DAYS, Math.round(parsed)));
}
