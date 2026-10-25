/**
 * Reporting engine core types (LipaPoint ERP spec §5 / reports-spec §1).
 *
 * One generic layer: a ReportDefinition row describes a report, a report
 * query function produces its rows, and one shared renderer displays and
 * exports them. Building a new report = a ReportDefinition row + a query
 * registered in `registry.ts` — not a bespoke page.
 */

export type ReportColumnKind = "text" | "number" | "currency" | "date";

export interface ReportColumn {
  key: string;
  label: string;
  kind: ReportColumnKind;
}

/** Filters every report supports at minimum (date range) plus report-specific. */
export interface ReportParams {
  from?: string; // ISO date (inclusive)
  to?: string; // ISO date (inclusive)
  search?: string; // free-text (audit action, account name, ...)
  limit?: number;
}

export type ReportCell = string | number | null;

export interface ReportResult {
  columns: ReportColumn[];
  rows: Record<string, ReportCell>[];
  /** Optional aggregate figures surfaced above the table (e.g. net profit). */
  summary?: Record<string, number>;
}

/** A report's query: tenant-scoped, always. Returns the renderable result. */
export type ReportQuery = (
  tenantId: string,
  params: ReportParams
) => Promise<ReportResult>;

/** Maps a ReportDefinition.category to its pricing feature flag (spec §10).
 *  Returns null for reports that are always available (audit trail). */
export function reportFeature(category: string): string | null {
  switch (category) {
    case "finance":
      return "finance";
    case "cash-bank":
      return "cashier-reports";
    case "sales":
      return "sales-reports";
    case "stock":
      return "stock-reports";
    case "customer":
      return "customer-reports";
    case "supplier":
      return "procurement";
    case "payroll":
      return "payroll";
    case "asset":
      return "assets";
    case "etims":
      return "etims";
    case "maintenance":
      return null; // audit trail — every tier sees its own
    default:
      return null;
  }
}

/** Normalizes a report key so `profit-and-loss` and `profit_and_loss` resolve alike. */
export function normalizeReportKey(key: string): string {
  return key.trim().toLowerCase().replace(/-/g, "_");
}