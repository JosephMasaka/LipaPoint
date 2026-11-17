"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Lightbulb, RefreshCw, X } from "lucide-react";

type Status = "new" | "accepted" | "dismissed" | "done";

interface Recommendation {
  id: string;
  type: string;
  title: string;
  summary: string;
  urgency: "critical" | "high" | "medium";
  status: Status;
  confidence: number;
  createdAt: string;
  evidence: {
    formula?: string;
    stock?: number;
    velocityPerDay?: number;
    daysOfCover?: number;
    suggestedQty?: number;
    targetDays?: number;
    period?: { from: string; to: string };
  };
}

const URGENCY_CLASS: Record<Recommendation["urgency"], string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  medium: "bg-gold/10 text-gold border-gold/20",
};

const TABS: Array<{ key: "new" | "accepted" | "dismissed" | "all"; label: string }> = [
  { key: "new", label: "Open" },
  { key: "accepted", label: "Accepted" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
];

export function RecommendationsPanel() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [counts, setCounts] = useState<Record<Status, number> | null>(null);
  const [tab, setTab] = useState<"new" | "accepted" | "dismissed" | "all">("new");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: typeof tab) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/recommendations?status=${status}&limit=20`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Could not load recommendations."); return; }
      setItems(json.items ?? []);
      setCounts(json.counts ?? null);
    } catch {
      setError("Could not load recommendations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(tab); }, [tab, load]);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Could not refresh recommendations."); return; }
      await load(tab);
    } catch {
      setError("Could not refresh recommendations.");
    } finally {
      setRefreshing(false);
    }
  }

  async function update(id: string, status: Status) {
    const previous = items;
    setItems((current) => current.filter((item) => item.id !== id));
    try {
      const res = await fetch("/api/ai/recommendations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        setItems(previous);
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Could not update the recommendation.");
      } else if (counts) {
        setCounts({ ...counts, new: Math.max(0, counts.new - 1) });
      }
    } catch {
      setItems(previous);
      setError("Could not update the recommendation.");
    }
  }

  return (
    <section className="rounded-2xl border border-border p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Lightbulb className="h-4 w-4 text-gold" />
        <h3 className="text-sm font-semibold text-text-primary">Recommendations</h3>
        {counts && (
          <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-gold">
            {counts.new} open
          </span>
        )}
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Checking stock…" : "Refresh"}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${
              tab === entry.key
                ? "bg-gold/15 text-gold"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {entry.label}
            {counts && entry.key !== "all" ? ` (${counts[entry.key as Status] ?? 0})` : ""}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-orange-500/20 bg-orange-500/10 p-2.5 text-[11px] text-orange-400">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-text-muted">Loading recommendations…</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-[11px] leading-relaxed text-text-muted">
          No recommendations in this view. Press Refresh to re-check stock cover from
          current sales velocity — suggestions only appear when a selling product is
          below its target cover.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-background/30 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${URGENCY_CLASS[item.urgency]}`}>
                  {item.urgency}
                </span>
                <h4 className="text-sm font-semibold text-text-primary">{item.title}</h4>
                <span className="ml-auto text-[10px] text-text-muted">
                  {Math.round(item.confidence * 100)}% confidence
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-text-secondary">{item.summary}</p>

              <details className="mt-2">
                <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-text-muted hover:text-text-primary">
                  Evidence
                </summary>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-text-muted">
                  {item.evidence.stock !== undefined && (
                    <>
                      <dt>Stock on hand</dt><dd className="text-text-secondary">{item.evidence.stock}</dd>
                    </>
                  )}
                  {item.evidence.velocityPerDay !== undefined && (
                    <>
                      <dt>Velocity</dt><dd className="text-text-secondary">{item.evidence.velocityPerDay.toFixed(2)}/day</dd>
                    </>
                  )}
                  {item.evidence.daysOfCover !== undefined && (
                    <>
                      <dt>Days of cover</dt><dd className="text-text-secondary">{item.evidence.daysOfCover}</dd>
                    </>
                  )}
                  {item.evidence.suggestedQty !== undefined && (
                    <>
                      <dt>Suggested order</dt><dd className="text-text-secondary">{item.evidence.suggestedQty} units</dd>
                    </>
                  )}
                  {item.evidence.period && (
                    <>
                      <dt>Period</dt>
                      <dd className="text-text-secondary">
                        {item.evidence.period.from.slice(0, 10)} → {item.evidence.period.to.slice(0, 10)}
                      </dd>
                    </>
                  )}
                </dl>
                {item.evidence.formula && (
                  <p className="mt-2 text-[10px] text-text-muted">{item.evidence.formula}</p>
                )}
              </details>

              {item.status === "new" && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => update(item.id, "accepted")}
                    className="inline-flex items-center gap-1 rounded-lg bg-gold px-2.5 py-1 text-[11px] font-semibold text-black hover:bg-gold/90"
                  >
                    <Check className="h-3 w-3" /> Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => update(item.id, "dismissed")}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary"
                  >
                    <X className="h-3 w-3" /> Dismiss
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-[10px] leading-relaxed text-text-muted">
        Recomputed from your own sales and stock — never generated as free text by a model,
        and never actioned automatically.
      </p>
    </section>
  );
}
