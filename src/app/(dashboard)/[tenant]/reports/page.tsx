"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import { ReportViewer } from "@/components/reports/report-viewer";
import type { ReportColumn, ReportCell } from "@/lib/reports/types";

interface ReportListItem {
  key: string;
  normalizedKey: string;
  title: string;
  description: string | null;
  category: string;
  section: string;
}

interface ReportRunResult {
  definition: {
    key: string;
    title: string;
    description: string | null;
    category: string;
    section: string;
  };
  columns: ReportColumn[];
  rows: Record<string, ReportCell>[];
  summary?: Record<string, number>;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportListItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [selected, setSelected] = useState<ReportListItem | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<ReportRunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch("/api/reports", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || `Request failed (${r.status})`);
        }
        return r.json();
      })
      .then((d) => setReports(d.reports as ReportListItem[]))
      .catch((e) => setListError(e.message || "Failed to load reports"));
  }, []);

  const run = useCallback(
    async (item: ReportListItem, opts?: { from?: string; to?: string; search?: string }) => {
      setRunning(true);
      setRunError(null);
      setResult(null);
      try {
        const qs = new URLSearchParams();
        const f = opts?.from ?? from;
        const t = opts?.to ?? to;
        const s = opts?.search ?? search;
        if (f) qs.set("from", f);
        if (t) qs.set("to", t);
        if (s) qs.set("search", s);
        const res = await fetch(`/api/reports/${encodeURIComponent(item.key)}?${qs.toString()}`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setRunError(data.message || data.error || `Request failed (${res.status})`);
        } else {
          setResult(data as ReportRunResult);
        }
      } catch {
        setRunError("Failed to run report");
      } finally {
        setRunning(false);
      }
    },
    [from, to, search]
  );

  function select(item: ReportListItem) {
    setSelected(item);
    run(item);
  }

  function applyFilters() {
    if (!selected) return;
    run(selected, { from, to, search });
  }

  // Group the catalog by section for display.
  const sections = new Map<string, ReportListItem[]>();
  for (const r of reports ?? []) {
    if (!sections.has(r.section)) sections.set(r.section, []);
    sections.get(r.section)!.push(r);
  }

  const showAuditSearch = selected?.normalizedKey === "audit_trail";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
        <p className="text-sm text-text-secondary mt-1">
          Filterable, exportable reports. Each report supports a date range, CSV export and print-to-PDF.
        </p>
      </div>

      {listError && (
        <Card>
          <CardContent className="p-4 text-sm text-red-400">{listError}</CardContent>
        </Card>
      )}

      {reports === null && !listError && (
        <div className="flex justify-center py-10">
          <Loader size="md" label="Loading reports..." />
        </div>
      )}

      {reports !== null && reports.length === 0 && !listError && (
        <Card>
          <CardContent className="p-6 text-sm text-text-muted">
            No reports are available on your current plan.
          </CardContent>
        </Card>
      )}

      {reports !== null && reports.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...sections.entries()].map(([section, items]) => (
            <Card key={section}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{section}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {items.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => select(item)}
                    className={`text-left rounded-lg border px-3 py-2 text-sm transition-colors cursor-pointer ${
                      selected?.key === item.key
                        ? "border-gold/60 bg-gold/10 text-text-primary"
                        : "border-border hover:bg-surface-hover text-text-secondary"
                    }`}
                  >
                    <span className="font-medium">{item.title}</span>
                    {item.description && (
                      <span className="block text-xs text-text-muted mt-0.5 line-clamp-2">
                        {item.description}
                      </span>
                    )}
                  </button>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>{selected.title}</CardTitle>
                {selected.description && (
                  <CardDescription className="mt-1">{selected.description}</CardDescription>
                )}
              </div>
              <Badge variant="secondary">{selected.category}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3 print:hidden">
              <div className="w-40">
                <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="w-40">
                <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              {showAuditSearch && (
                <div className="w-56">
                  <Input
                    label="Search"
                    placeholder="action, entity or detail"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              )}
              <Button onClick={applyFilters} disabled={running} className="print:hidden">
                {running ? "Running..." : "Run"}
              </Button>
            </div>

            {runError && <p className="text-sm text-red-400">{runError}</p>}

            {running && (
              <div className="flex justify-center py-8">
                <Loader size="md" label="Generating report..." />
              </div>
            )}

            {!running && result && (
              <ReportViewer
                columns={result.columns}
                rows={result.rows}
                summary={result.summary}
                filename={result.definition.key}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}