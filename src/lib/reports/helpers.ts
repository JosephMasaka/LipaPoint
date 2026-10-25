import type { ReportParams } from "./types";

/**
 * Shared helpers for report queries: date-range filtering and float rounding.
 * Kept dependency-free so every report module can import them without cycles.
 */

/** Builds a `{ [field]: { gte, lte } }` filter from ISO date params.
 *  `to` is pushed to end-of-day so the boundary day is included. */
export function dateFilter(params: ReportParams, field = "date") {
  const gte = params.from ? new Date(params.from) : undefined;
  let lte: Date | undefined;
  if (params.to) {
    lte = new Date(params.to);
    lte.setUTCHours(23, 59, 59, 999);
  }
  if (!gte && !lte) return {};
  return { [field]: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } } as Record<string, unknown>;
}

/** Prisma returns Decimal for numeric fields — coerce to a JS number. */
export const asNum = (v: unknown): number => Number(v ?? 0);

/** Round to 2dp — Float/Decimal source amounts drift. */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Local YYYY-MM-DD key for a date (day bucketing). */
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Local YYYY-MM key for a date (month bucketing). */
export function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}