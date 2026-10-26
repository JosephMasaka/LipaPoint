"use client";

import { Button } from "@/components/ui/button";
import { BarChart3, Download, Printer } from "lucide-react";
import type { ReportColumn, ReportCell, ReportResult } from "@/lib/reports/types";

/**
 * Shared report renderer (spec §5 / reports-spec §1): summary tiles + table
 * + CSV export + print (PDF) used by every report. A report supplies its
 * columns/rows and this component handles display and export — no bespoke
 * report pages.
 */

interface ReportViewerProps extends ReportResult {
  filename: string;
  currency?: string;
}

const CURRENCY_KEY = /(total|sales|revenue|amount|cost|price|profit|loss|balance|cash|paid|payment|value|tax|vat|discount|gross|net|payroll|salary|fee|income|expense|spent|received|turnover)/i;

function formatCell(value: ReportCell, kind: ReportColumn["kind"], currency: string): string {
  if (value === null || value === undefined) return "";
  if (kind === "currency" || kind === "number") {
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    return kind === "currency"
      ? `${currency} ${n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : n.toLocaleString("en-KE");
  }
  if (kind === "date") {
    const d = new Date(String(value));
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
    return String(value);
  }
  return String(value);
}

function formatSummaryValue(key: string, value: number, currency: string): string {
  if (!Number.isFinite(value)) return String(value);
  if (CURRENCY_KEY.test(key)) {
    return `${currency} ${value.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (Number.isInteger(value)) return value.toLocaleString("en-KE");
  return value.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function prettyLabel(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function csvEscape(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

export function ReportViewer({ columns, rows, summary, filename, currency = "KSh" }: ReportViewerProps) {
  function exportCsv() {
    const header = columns.map((c) => csvEscape(c.label)).join(",");
    const body = rows
      .map((r) => columns.map((c) => csvEscape(String(r[c.key] ?? ""))).join(","))
      .join("\n");
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const summaryEntries = summary ? Object.entries(summary) : [];

  return (
    <div>
      {/* Summary tiles + actions */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 print:hidden">
        {summaryEntries.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 min-w-0">
            {summaryEntries.map(([k, v]) => (
              <div
                key={k}
                className="rounded-lg border border-border bg-surface-elevated px-3 py-2 min-w-[9rem]"
              >
                <p className="text-[11px] text-text-muted truncate" title={prettyLabel(k)}>
                  {prettyLabel(k)}
                </p>
                <p className="text-sm font-semibold text-text-primary tabular-nums mt-0.5">
                  {formatSummaryValue(k, v, currency)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted self-center">
            {rows.length.toLocaleString("en-KE")} row{rows.length === 1 ? "" : "s"}
          </p>
        )}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} disabled={rows.length === 0}>
            <Printer className="h-3.5 w-3.5" />
            Print / PDF
          </Button>
        </div>
      </div>

      {summaryEntries.length > 0 && (
        <p className="text-xs text-text-muted mb-3 print:hidden">
          {rows.length.toLocaleString("en-KE")} row{rows.length === 1 ? "" : "s"} · generated{" "}
          {new Date().toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed border-border">
          <BarChart3 className="h-8 w-8 text-text-muted mb-2" />
          <p className="text-sm text-text-muted">No data for the selected filters.</p>
          <p className="text-xs text-text-muted mt-1">Try widening the date range.</p>
        </div>
      ) : (
        <div className="overflow-auto max-h-[65vh] rounded-lg border border-border">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface-elevated">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`px-3 py-2.5 font-medium text-text-secondary border-b border-border whitespace-nowrap ${
                      c.kind === "currency" || c.kind === "number" ? "text-right" : "text-left"
                    }`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-border last:border-0 hover:bg-surface-hover/60 ${
                    i % 2 === 1 ? "bg-surface-elevated/40" : ""
                  }`}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-3 py-2 text-text-primary ${
                        c.kind === "currency" || c.kind === "number"
                          ? "text-right tabular-nums"
                          : "text-left"
                      }`}
                    >
                      {formatCell(row[c.key] ?? null, c.kind, currency)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
