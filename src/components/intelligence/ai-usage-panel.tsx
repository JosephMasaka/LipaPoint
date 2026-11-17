"use client";

import { useEffect, useState } from "react";
import { Activity, Coins, Gauge, AlertTriangle } from "lucide-react";

interface UsageSummary {
  month: string;
  requests: number;
  tokens: number;
  estimatedCostUsd: number;
  quota: { limit: number; used: number; remaining: number; resetsAt: string };
  recent: Array<{
    runId: string;
    surface: string;
    provider: string;
    totalTokens: number;
    estimatedCostUsd: number;
    latencyMs: number;
    status: string;
    errorCode: string | null;
    createdAt: string;
  }>;
}

const nf = new Intl.NumberFormat("en-KE");

export function AiUsagePanel() {
  const [data, setData] = useState<UsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/usage", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setError(json.error ?? "Could not load AI usage."); return; }
        setData(json as UsageSummary);
      })
      .catch(() => { if (!cancelled) setError("Could not load AI usage."); });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return <p className="rounded-2xl border border-border p-5 text-xs text-text-muted">{error}</p>;
  }
  if (!data) {
    return <p className="rounded-2xl border border-border p-5 text-xs text-text-muted">Loading AI usage…</p>;
  }

  const usedPct = data.quota.limit > 0 ? Math.min(100, (data.quota.used / data.quota.limit) * 100) : 0;
  const failures = data.recent.filter((r) => r.status !== "SUCCESS").slice(0, 5);

  return (
    <section className="rounded-2xl border border-border p-5">
      <div className="mb-4 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-gold" />
        <h3 className="text-sm font-semibold text-text-primary">AI usage — {data.month}</h3>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-text-muted">Owners & admins</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-background/30 p-4">
          <Activity className="h-4 w-4 text-gold" />
          <p className="mt-3 text-[10px] uppercase tracking-wide text-text-muted">Requests</p>
          <p className="mt-1 text-xl font-semibold text-text-primary">
            {nf.format(data.quota.used)} <span className="text-sm font-normal text-text-muted">/ {nf.format(data.quota.limit)}</span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background/30 p-4">
          <Coins className="h-4 w-4 text-gold" />
          <p className="mt-3 text-[10px] uppercase tracking-wide text-text-muted">Tokens</p>
          <p className="mt-1 text-xl font-semibold text-text-primary">{nf.format(data.tokens)}</p>
        </div>
        <div className="rounded-xl border border-border bg-background/30 p-4">
          <Coins className="h-4 w-4 text-gold" />
          <p className="mt-3 text-[10px] uppercase tracking-wide text-text-muted">Estimated cost</p>
          <p className="mt-1 text-xl font-semibold text-text-primary">${data.estimatedCostUsd.toFixed(3)}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[11px] text-text-muted">
          <span>{data.quota.remaining} requests remaining</span>
          <span>Resets {data.quota.resetsAt.slice(0, 10)}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-background">
          <div
            className={`h-1.5 rounded-full ${usedPct >= 90 ? "bg-red-500" : "bg-gold"}`}
            style={{ width: `${usedPct}%` }}
          />
        </div>
      </div>

      {failures.length > 0 && (
        <div className="mt-4 rounded-xl border border-orange-500/20 bg-orange-500/10 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-orange-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Recent failures
          </p>
          <ul className="mt-2 space-y-1 text-[11px] text-text-muted">
            {failures.map((f) => (
              <li key={f.runId}>
                {new Date(f.createdAt).toLocaleString("en-KE")} · {f.surface} · {f.status}
                {f.errorCode ? ` (${f.errorCode})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-[10px] leading-relaxed text-text-muted">
        Cost is an estimate based on provider list prices, not an invoice. Prompt and reply text are not stored.
      </p>
    </section>
  );
}
