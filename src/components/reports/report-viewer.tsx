"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ReportColumn, ReportCell, ReportResult } from "@/lib/reports/types";

/**
 * Shared report renderer (spec §5 / reports-spec §1): one table + CSV export
 * + print (PDF) used by every report. A report supplies its columns/rows and
 * this component handles display and export — no bespoke report pages.
 */

interface ReportViewerProps extends ReportResult {
  filename: string;
  currency?: string;
}

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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
        <div className="flex flex-wrap gap-2">
          {summaryEntries.map(([k, v]) => (
            <Badge key={k} variant="secondary">
              {k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}:{" "}
              {typeof v === "number" && Number.isFinite(v)
                ? v.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : String(v)}
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} disabled={rows.length === 0}>
            Print / PDF
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">
          No data for the selected filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-hover">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`px-3 py-2 font-medium text-text-secondary border-b border-border ${
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
                <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-hover/50">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-3 py-2 text-text-primary ${
                        c.kind === "currency" || c.kind === "number" ? "text-right tabular-nums" : "text-left"
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