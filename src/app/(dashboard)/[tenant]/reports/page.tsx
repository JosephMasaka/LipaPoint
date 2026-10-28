"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import { ReportViewer } from "@/components/reports/report-viewer";
import { Search, BarChart3, X } from "lucide-react";
import { cn } from "@/lib/utils";
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

const isoDate = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

/** Quick range presets — the Odoo-style "date filter" shortcuts. */
const RANGE_PRESETS: { label: string; range: () => { from: string; to: string } }[] = [
  { label: "Today", range: () => { const t = isoDate(new Date()); return { from: t, to: t }; } },
  {
    label: "Last 7 days",
    range: () => {
      const to = new Date();
      const from = new Date(Date.now() - 6 * 86400000);
      return { from: isoDate(from), to: isoDate(to) };
    },
  },
  {
    label: "Last 30 days",
    range: () => {
      const to = new Date();
      const from = new Date(Date.now() - 29 * 86400000);
      return { from: isoDate(from), to: isoDate(to) };
    },
  },
  {
    label: "This month",
    range: () => {
      const now = new Date();
      return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(now) };
    },
  },
];

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportListItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");

  const [selected, setSelected] = useState<ReportListItem | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);
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
    setRunError(null);
    run(item);
  }

  function applyFilters() {
    if (!selected) return;
    run(selected, { from, to, search });
  }

  function applyPreset(label: string) {
    const preset = RANGE_PRESETS.find((p) => p.label === label);
    if (!preset || !selected) return;
    const range = preset.range();
    setFrom(range.from);
    setTo(range.to);
    setActivePreset(label);
    run(selected, { ...range, search });
  }

  function clearFilters() {
    setFrom("");
    setTo("");
    setSearch("");
    setActivePreset(null);
    if (selected) run(selected, { from: "", to: "", search: "" });
  }

  // Group the catalog by section, applying the catalog search filter.
  const sections = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    const map = new Map<string, ReportListItem[]>();
    for (const r of reports ?? []) {
      if (
        q &&
        !r.title.toLowerCase().includes(q) &&
        !(r.description ?? "").toLowerCase().includes(q) &&
        !r.category.toLowerCase().includes(q) &&
        !r.section.toLowerCase().includes(q)
      ) {
        continue;
      }
      if (!map.has(r.section)) map.set(r.section, []);
      map.get(r.section)!.push(r);
    }
    return map;
  }, [reports, catalogSearch]);

  const totalVisible = [...sections.values()].reduce((n, items) => n + items.length, 0);
  const showAuditSearch = selected?.normalizedKey === "audit_trail";
  const hasFilters = Boolean(from || to || search);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-surface/80 backdrop-blur-sm px-4 sm:px-6 lg:px-8 py-4 pt-12 lg:pt-5 shrink-0 sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
          <p className="text-sm text-text-secondary mt-1">
            Filterable, exportable reports. Each report supports a date range, CSV export and
            print-to-PDF.
          </p>
        </div>
        {reports !== null && reports.length > 0 && (
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
            <Input
              placeholder="Search reports…"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              className="pl-9 h-10"
              aria-label="Search reports"
            />
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
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

      {reports !== null && reports.length > 0 && totalVisible === 0 && (
        <Card>
          <CardContent className="p-6 flex items-center gap-3 text-sm text-text-muted">
            <Search className="h-4 w-4" />
            No reports match &ldquo;{catalogSearch}&rdquo;.
            <Button variant="ghost" size="sm" onClick={() => setCatalogSearch("")}>
              Clear search
            </Button>
          </CardContent>
        </Card>
      )}

      {reports !== null && totalVisible > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...sections.entries()].map(([section, items]) => (
            <Card key={section}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span>{section}</span>
                  <Badge variant="secondary" className="font-normal">
                    {items.length}
                  </Badge>
                </CardTitle>
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
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-gold" />
                  <CardTitle>{selected.title}</CardTitle>
                </div>
                {selected.description && (
                  <p className="text-sm text-text-secondary mt-1">{selected.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selected.category}</Badge>
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                    <X className="h-3.5 w-3.5" /> Clear
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 print:hidden">
              <div className="flex flex-wrap gap-1.5">
                {RANGE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p.label)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer",
                      activePreset === p.label
                        ? "border-gold/60 bg-gold/10 text-gold"
                        : "border-border bg-surface-elevated text-text-secondary hover:text-text-primary"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="w-40">
                  <Input
                    label="From"
                    type="date"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      setActivePreset(null);
                    }}
                  />
                </div>
                <div className="w-40">
                  <Input
                    label="To"
                    type="date"
                    value={to}
                    onChange={(e) => {
                      setTo(e.target.value);
                      setActivePreset(null);
                    }}
                  />
                </div>
                {showAuditSearch && (
                  <div className="w-56">
                    <Input
                      label="Search"
                      placeholder="action, entity or detail"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                    />
                  </div>
                )}
                <Button onClick={applyFilters} disabled={running}>
                  {running ? "Running..." : "Run"}
                </Button>
              </div>
            </div>

            {runError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {runError}
              </div>
            )}

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
    </div>
  );
}
