import type { IntelligenceConfidence } from "./types";

export function round(value: number, decimals = 2): number {
  const m = 10 ** decimals;
  return Math.round(value * m) / m;
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return round(((current - previous) / previous) * 100);
}

export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function confidenceFromSample(
  sample: number,
  high = 20,
  medium = 8,
  low = 3
): IntelligenceConfidence {
  if (sample >= high) return "high";
  if (sample >= medium) return "medium";
  if (sample >= low) return "low";
  return "insufficient";
}

export function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Splits large id lists so we stay well under Postgres' bind-variable limit. */
export function chunk<T>(arr: T[], size = 4000): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}