import { FEATURE_REGISTRY, type FeatureKey } from "@/lib/module-registry";
import { normalizeReportKey } from "./types";

/**
 * Report → sub-feature gate (sub-feature spec §5 / handoff §5.3 — R1).
 *
 * Every one of the 59 catalog reports maps to the feature that owns its data.
 * Deliberately a *code-side* map, not a column on ReportDefinition (handoff
 * D7): no schema churn, and the registry stays the single source of truth
 * for what a feature is.
 *
 * Decisions baked in (handoff §5.3, confirmed 2026-10-27):
 * - `null` = session-only, never gated (`audit-trail`).
 * - Discount report stays on the free `core-till` floor (D4) so no tenant
 *   loses a report it can run today.
 * - Cashier reports gate on `multi-till-cashier`; M-Pesa/Card/PDQ, cheques
 *   and transfers gate on `core-till` (D3 "split" ruling).
 *
 * Only the *run* endpoint uses this: `GET /api/reports` keeps returning the
 * full catalog (D2), so a gated report is visibly listed, never silently gone.
 */
const REPORT_FEATURE_MAP: Record<string, FeatureKey | null> = {
  // finance
  "profit-and-loss": "financial-statements",
  "balance-sheet": "financial-statements",
  "trial-balance": "general-ledger",
  "gl-journal-register": "general-ledger",
  "cash-bank-statement": "bank-reconciliation",
  "cash-bank-summary": "bank-reconciliation",
  "mpesa-card-pdq-report": "core-till",
  "cheques-received": "core-till",
  "transfer-report": "core-till",

  // platform — always available
  "audit-trail": null,

  // payroll
  "payroll-run-summary": "payroll",
  "statutory-deductions-summary": "payroll",
  "payslip-register": "payroll",
  "p9-annual-export": "payroll",

  // assets
  "asset-register": "asset-register",
  "depreciation-schedule": "depreciation",
  "maintenance-cost-report": "maintenance-tracking",

  // etims
  "etims-submission-log": "etims-submission",
  "vat-output-reconciliation": "etims-compliance-dashboard",

  // procurement
  "supplier-statement": "supplier-invoicing",
  "supplier-unpaid-invoices": "supplier-invoicing",
  "supplier-invoice-received": "supplier-invoicing",
  "purchased-by-item": "purchase-orders",

  // crm
  "customer-statement": "customer-statements",
  "customer-balance": "customer-statements",
  "customer-balance-by-department": "customer-statements",
  "withholding-tax-by-customer": "withholding-tax-tracking",

  // inventory
  "stock-report": "stock-records",
  "stock-by-department": "stock-records",
  "stock-received": "stock-records",
  "items-not-sold": "stock-records",
  "stock-adjustment": "stock-records",
  "price-change": "stock-records",
  "stock-valuation": "stock-valuation",
  "reorder-points": "reorder-alerts",
  "stock-transferred": "multi-location-transfers",
  "stock-expiry": "expiry-tracking",
  "physical-stock-take": "physical-stock-take",

  // pos
  "invoice-report": "core-till",
  "sales-detailed": "core-till",
  "sales-summary": "core-till",
  "sales-by-day": "core-till",
  "sales-by-week": "core-till",
  "sales-by-month": "core-till",
  "sales-by-hour": "core-till",
  "sales-by-item": "core-till",
  "sales-by-customer": "core-till",
  "sales-by-payment-method": "core-till",
  "sales-by-tax": "core-till",
  "sales-return-report": "core-till",
  "unpaid-bills": "core-till",
  "sales-by-sales-rep": "core-till",
  "sales-by-sales-rep-per-day": "core-till",
  "sales-complementary": "core-till",
  "discount-report": "core-till",
  "items-sold-out-of-set-price": "price-override",
  "cashier-cash-print-report": "multi-till-cashier",
  "cashier-shortage-report": "multi-till-cashier",
  "cash-collection-from-cashiers": "multi-till-cashier",
};

/** Keyed by normalizeReportKey so `profit-and-loss` and `profit_and_loss` resolve alike. */
const BY_NORMALIZED_KEY = new Map(
  Object.entries(REPORT_FEATURE_MAP).map(([key, feature]) => [
    normalizeReportKey(key),
    feature,
  ])
);

/**
 * The feature a report's run endpoint requires, or `null` when the report is
 * session-only (always available). Unknown keys return `null` too — a report
 * missing from this map must never become *less* reachable than today (R1),
 * so the safe default is "no extra gate".
 */
export function reportFeatureKey(reportKey: string): FeatureKey | null {
  const mapped = BY_NORMALIZED_KEY.get(normalizeReportKey(reportKey));
  return mapped ?? null;
}

/** Human label for the 403 message ("Enable <label> to run this report"). */
export function reportFeatureLabel(reportKey: string): string | null {
  const key = reportFeatureKey(reportKey);
  return key ? FEATURE_REGISTRY[key].label : null;
}