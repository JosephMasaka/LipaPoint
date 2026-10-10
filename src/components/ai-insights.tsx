"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useParams } from "next/navigation";
import {
  Sparkles, RefreshCw, ArrowUpRight, TrendingUp, TrendingDown, Package, Users, MapPin,
  AlertTriangle, Target, ShoppingBag, ShieldAlert, ChevronRight, Activity, Store, Clock3,
  BrainCircuit, Tag, Info, Boxes, CheckCircle2,
} from "lucide-react";
import { canAccessFeature } from "@/lib/plans";
import { KENYA_COUNTIES } from "@/lib/kenya-counties";
import type { BusinessIntelligence, MarketProductSignal } from "@/lib/ai/types";

/* =========================================================
   HELPERS
   ========================================================= */

const nf = new Intl.NumberFormat("en-KE");
const fmt = (v: number) => nf.format(Math.round(v));
const money = (v: number, cur: string) => `${cur} ${fmt(v)}`;
const pct = (v: number | null, digits = 1) => (v === null ? "—" : `${Number(v.toFixed(digits))}%`);

type Tone = "gold" | "good" | "warn" | "bad" | "muted";
const toneClass: Record<Tone, string> = {
  gold: "border-gold/30 bg-gold/10 text-gold",
  good: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  warn: "border-orange-500/20 bg-orange-500/10 text-orange-400",
  bad: "border-red-500/20 bg-red-500/10 text-red-400",
  muted: "border-border bg-background text-text-muted",
};

function Chip({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide ${toneClass[tone]}`}>
      {children}
    </span>
  );
}

const priorityTone = (p: string): Tone =>
  p === "critical" ? "bad" : p === "high" ? "warn" : p === "medium" ? "gold" : "muted";

function Bar({ value, tone = "gold" }: { value: number; tone?: "gold" | "muted" }) {
  const w = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full rounded-full bg-background">
      <div className={`h-1.5 rounded-full ${tone === "gold" ? "bg-gold" : "bg-text-muted/60"}`} style={{ width: `${w}%` }} />
    </div>
  );
}

function Panel({ title, icon: Icon, right, children }: {
  title: string; icon?: typeof Target; right?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-gold" />}
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub }: {
  icon: typeof TrendingUp; label: string; value: string; sub?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/30 p-4">
      <Icon className="h-4 w-4 text-gold" />
      <p className="mt-3 text-[10px] uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-text-primary">{value}</p>
      {sub && <div className="mt-1 text-xs text-text-muted">{sub}</div>}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border p-4 text-xs leading-relaxed text-text-muted">{children}</p>;
}

const signalMeta: Record<MarketProductSignal["signal"], { label: string; tone: Tone }> = {
  gap: { label: "Not in your range", tone: "gold" },
  understocked: { label: "Under-indexed", tone: "warn" },
  "strong-demand": { label: "Strong demand", tone: "good" },
  normal: { label: "In line", tone: "muted" },
};

/* =========================================================
   LOCATION PROMPT
   ========================================================= */

function LocationPrompt({ onSaved }: { onSaved: () => void }) {
  const [county, setCounty] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!county) { setError("Choose your county."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ county, city }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Could not save your location."); return; }
      onSaved();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5">
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-text-primary">Set your business location</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Your county unlocks local best-sellers, price benchmarks and area demographics.
            Only your county is used to find comparable businesses — other businesses never see your data.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <select
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary"
              aria-label="County"
            >
              <option value="">Select county…</option>
              {KENYA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Town / estate (optional)"
              className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
            />
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

type Section = "overview" | "products" | "customers" | "area" | "actions";

export function AIInsights({ tier }: { tier: string }) {
  const params = useParams<{ tenant?: string }>();
  const settingsHref = params?.tenant ? `/${params.tenant}/settings` : "/settings";

  const [data, setData] = useState<BusinessIntelligence | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("overview");

  const isAllowed = canAccessFeature(tier, "ai-assistant");

  const load = useCallback(async (refresh = false) => {
    if (!isAllowed) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/insights${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to load intelligence."); return; }
      setData(json);
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [isAllowed]);

  useEffect(() => { load(); }, [load]);

  /* ---------- upgrade ---------- */
  if (!isAllowed) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10">
                <BrainCircuit className="h-6 w-6 text-gold" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">LipaPoint Intelligence</h3>
                <p className="text-xs text-text-muted">Know your business. Know your area.</p>
              </div>
            </div>
            <Chip tone="gold">Pro</Chip>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [TrendingUp, "Sales & restock intelligence"],
              [MapPin, "What sells in your area"],
              [Users, "Area demographics & churn"],
              [Tag, "Price benchmarks"],
            ].map(([Icon, label]) => {
              const I = Icon as typeof TrendingUp;
              return (
                <div key={label as string} className="rounded-2xl border border-border bg-background/50 p-4">
                  <I className="mb-2 h-4 w-4 text-gold" />
                  <p className="text-xs font-medium text-text-primary">{label as string}</p>
                </div>
              );
            })}
          </div>
          <a href={settingsHref}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90">
            Unlock Intelligence <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }

  /* ---------- loading / error ---------- */
  if (isLoading && !data) {
    return (
      <div className="overflow-hidden rounded-3xl border border-border bg-surface">
        <div className="animate-pulse p-6">
          <div className="h-6 w-56 rounded bg-background" />
          <div className="mt-3 h-4 w-80 rounded bg-background" />
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-background" />)}
          </div>
          <div className="mt-6 h-64 rounded-2xl bg-background" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-3xl border border-red-500/20 bg-surface p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
          <div>
            <h3 className="font-semibold text-text-primary">Intelligence unavailable</h3>
            <p className="mt-1 text-sm text-text-muted">{error}</p>
            <button onClick={() => load()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-primary hover:bg-background">
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const cur = data.tenant.currency;
  const m = data.market;
  const d = data.demographics;
  const revUp = data.sales.revenueGrowthPercent >= 0;
  const ordUp = data.sales.orderGrowthPercent >= 0;
  const segmentFill = ["bg-gold/40", "bg-gold", "bg-gold/70", "bg-text-muted/50"];

  const tabs: Array<[Section, string]> = [
    ["overview", "Overview"], ["products", "Products & Stock"], ["customers", "Customers"],
    ["area", "Area Intelligence"], ["actions", "Action Plan"],
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
      <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-gold/10 blur-3xl" />

      {/* ---------- header ---------- */}
      <div className="relative border-b border-border p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10">
              <Sparkles className="h-6 w-6 text-gold" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-text-primary">LipaPoint Intelligence</h2>
                <Chip tone="gold">AI</Chip>
              </div>
              <p className="mt-1 text-sm text-text-muted">Know your business. Know your area.</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-text-muted">
                <span className="inline-flex items-center gap-1"><Store className="h-3 w-3" />{data.tenant.type}</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {data.tenant.county ? `${data.tenant.county} County` : "Location not set"}
                </span>
                <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" />30-day analysis</span>
              </div>
            </div>
          </div>
          <button onClick={() => load(true)} disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-border px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-background hover:text-text-primary disabled:opacity-50 lg:self-auto">
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        <div className="mt-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-background/50 p-1">
          {tabs.map(([key, label]) => (
            <button key={key} onClick={() => setSection(key)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition ${
                section === key ? "bg-surface text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================
          OVERVIEW
      ===================================================== */}
      {section === "overview" && (
        <div className="space-y-6 p-5 md:p-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={TrendingUp} label="Revenue" value={money(data.sales.currentRevenue, cur)}
              sub={<span className={`inline-flex items-center gap-1 ${revUp ? "text-emerald-400" : "text-red-400"}`}>
                {revUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {Math.abs(data.sales.revenueGrowthPercent)}% vs previous period</span>} />
            <Metric icon={ShoppingBag} label="Orders" value={fmt(data.sales.currentOrders)}
              sub={<span className={ordUp ? "text-emerald-400" : "text-red-400"}>
                {ordUp ? "+" : "-"}{Math.abs(data.sales.orderGrowthPercent)}% vs previous period</span>} />
            <Metric icon={Users} label="Retention" value={`${data.customers.retentionScore}/100`}
              sub={`${data.customers.repeatRate}% repeat rate`} />
            <Metric icon={Target} label="Area index"
              value={m.available && m.revenueIndex !== null ? `${m.revenueIndex}` : "Building"}
              sub={m.available ? `revenue vs peer median (100)` : `${m.cohortMerchants}/${m.cohortThreshold} comparable businesses`} />
          </div>

          {/* AI brief */}
          <div className="rounded-2xl border border-gold/20 bg-gold/5 p-5">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold text-text-primary">AI brief</h3>
              {data.ai && <Chip tone="muted">{data.ai.provider}</Chip>}
            </div>
            {data.ai ? (
              <>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">{data.ai.narrative.summary}</p>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {data.ai.narrative.priorities.map((p, i) => (
                    <div key={i} className="rounded-xl border border-border bg-surface p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-xs font-bold text-gold">{i + 1}</span>
                        <div>
                          <p className="text-xs font-semibold text-text-primary">{p.title}</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{p.why}</p>
                          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-text-secondary">
                            <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-gold" />{p.action}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-3 text-xs text-text-muted">
                The AI brief isn&apos;t available right now (provider busy or not configured). The rule-based insights below are unaffected.
              </p>
            )}
          </div>

          {/* data quality */}
          {data.dataQuality.notes.length > 0 && (
            <div className="rounded-2xl border border-border bg-background/30 p-5">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-text-primary">Make these insights sharper</h3>
              </div>
              <ul className="mt-3 space-y-2">
                {data.dataQuality.notes.map((n, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-text-secondary">
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />{n}
                  </li>
                ))}
              </ul>
              {!data.dataQuality.locationSet && (
                <button onClick={() => setSection("area")} className="mt-3 text-xs font-medium text-gold hover:underline">
                  Set your location in Area Intelligence →
                </button>
              )}
            </div>
          )}

          {/* insights */}
          <div className="grid gap-4 lg:grid-cols-3">
            {data.insights.slice(0, 6).map((ins) => (
              <div key={ins.id} className="rounded-2xl border border-border bg-background/30 p-4 transition hover:border-gold/30">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">{ins.category}</span>
                  <Chip tone={priorityTone(ins.priority)}>{ins.priority}</Chip>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-text-primary">{ins.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">{ins.description}</p>
                {ins.metric && <p className="mt-3 text-xs font-semibold text-gold">{ins.metric}</p>}
                {ins.action && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-surface p-3">
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                    <p className="text-[11px] leading-relaxed text-text-secondary">{ins.action}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Business risks" icon={ShieldAlert}>
              <div className="space-y-3">
                {data.risks.slice(0, 4).map((r, i) => (
                  <div key={i} className="flex gap-3 rounded-xl border border-border bg-background/30 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
                    <div>
                      <p className="text-xs font-medium text-text-primary">{r.title}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{r.description}</p>
                    </div>
                  </div>
                ))}
                {data.risks.length === 0 && <Empty>No major risks detected.</Empty>}
              </div>
            </Panel>
            <Panel title="Opportunities" icon={Target}>
              <div className="space-y-3">
                {data.opportunities.slice(0, 4).map((o, i) => (
                  <div key={i} className="rounded-xl border border-border bg-background/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium text-text-primary">{o.title}</p>
                      <span className="text-xs font-semibold text-gold">{Math.round(o.score)}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{o.description}</p>
                  </div>
                ))}
                {data.opportunities.length === 0 && <Empty>No standout opportunities yet.</Empty>}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* =====================================================
          PRODUCTS & STOCK
      ===================================================== */}
      {section === "products" && (
        <div className="space-y-6 p-5 md:p-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={Package} label="Tracked products" value={fmt(data.inventory.totalTrackedProducts)} />
            <Metric icon={Activity} label="Fast moving" value={fmt(data.inventory.fastMovingCount)} />
            <Metric icon={AlertTriangle} label="Stockout risk" value={fmt(data.inventory.stockoutRiskCount)} />
            <Metric icon={Boxes} label="Dead stock" value={fmt(data.inventory.deadStockCount)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Restock plan" icon={Boxes}
              right={<span className="text-[10px] text-text-muted">to ~14 days of cover</span>}>
              {data.restock.length === 0 ? (
                <Empty>Nothing needs restocking right now, or there isn&apos;t enough sales history yet.</Empty>
              ) : (
                <div className="divide-y divide-border">
                  {data.restock.map((r) => (
                    <div key={r.product} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-text-primary">{r.product}</p>
                        <p className="text-[10px] text-text-muted">
                          {fmt(r.stock)} left · {r.velocityPerDay}/day · {r.daysOfCover} days of cover
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Chip tone={priorityTone(r.urgency)}>{r.urgency}</Chip>
                        <span className="text-xs font-semibold text-gold">order ~{fmt(r.suggestedQty)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[10px] leading-relaxed text-text-muted">
                Based on your last 30 days&apos; average daily sales. Adjust for supplier lead time, cash and seasonality.
              </p>
            </Panel>

            <Panel title="Pricing signals" icon={Tag}>
              {data.pricing.length === 0 ? (
                <Empty>
                  No pricing flags. Add product costs and wait for area benchmarks to unlock margin and price-vs-area checks.
                </Empty>
              ) : (
                <div className="space-y-3">
                  {data.pricing.map((p) => (
                    <div key={p.product} className="rounded-xl border border-border bg-background/30 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-xs font-medium text-text-primary">{p.product}</p>
                        <Chip tone={p.basis === "margin" ? "warn" : "gold"}>{p.basis === "margin" ? "Margin" : "Area price"}</Chip>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{p.message}</p>
                      <p className="mt-2 text-[10px] text-text-muted">
                        Now {money(p.currentPrice, cur)}
                        {p.suggestedPrice !== null && <> · test {money(p.suggestedPrice, cur)}</>}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[10px] leading-relaxed text-text-muted">
                Area prices are peers&apos; list prices, not what customers paid. Test changes on a few products first.
              </p>
            </Panel>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="border-b border-border p-4"><h3 className="text-sm font-semibold text-text-primary">Product performance</h3></div>
            <div className="divide-y divide-border">
              {data.sales.topProducts.length === 0 && <div className="p-4"><Empty>No sales recorded in the last 30 days.</Empty></div>}
              {data.sales.topProducts.map((p) => (
                <div key={p.name} className="grid gap-3 p-4 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{p.name}</p>
                    <p className="text-[11px] text-text-muted">{p.category}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-text-primary">{fmt(p.unitsSold)} units</p>
                    <p className="text-[10px] text-text-muted">{p.velocityPerDay}/day</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">{money(p.revenue, cur)}</p>
                    <p className="text-[10px] text-text-muted">{p.marginPercent !== null ? `${p.marginPercent}% margin` : "cost not recorded"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">{p.stock !== null ? `${fmt(p.stock)} in stock` : "stock n/a"}</p>
                    <p className="text-[10px] text-text-muted">{p.daysOfCover !== null ? `${p.daysOfCover} days cover` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gold">{Math.round(p.demandScore)}</span>
                    <span className="text-[10px] text-text-muted">demand</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          CUSTOMERS
      ===================================================== */}
      {section === "customers" && (
        <div className="space-y-6 p-5 md:p-6">
          {data.customers.registeredCustomers === 0 && (
            <Empty>
              No customers are linked to your orders yet, so retention and churn can&apos;t be measured.
              Capturing customer details at checkout will unlock this section.
            </Empty>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={Users} label="Registered" value={fmt(data.customers.registeredCustomers)} />
            <Metric icon={Activity} label="Active (30d)" value={fmt(data.customers.activeCustomers)} />
            <Metric icon={CheckCircle2} label="Repeat rate" value={`${data.customers.repeatRate}%`} />
            <Metric icon={AlertTriangle} label="Churn signals" value={fmt(data.customers.churnedCustomers)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {data.customers.segments.map((s) => (
              <div key={s.name} className="rounded-2xl border border-border p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{s.name}</p>
                <p className="mt-3 text-2xl font-semibold text-text-primary">{fmt(s.customers)}</p>
                <p className="mt-1 text-xs text-gold">{s.share}% of registered customers</p>
                <p className="mt-4 text-xs leading-relaxed text-text-secondary">{s.behavior}</p>
                <div className="mt-4 rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-text-muted">Opportunity</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">{s.opportunity}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================
          AREA INTELLIGENCE
      ===================================================== */}
      {section === "area" && (
        <div className="space-y-6 p-5 md:p-6">
          {!data.dataQuality.locationSet && <LocationPrompt onSaved={() => load(true)} />}

          <div className="rounded-2xl border border-gold/20 bg-gold/5 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <MapPin className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold text-text-primary">{m.scopeLabel}</h3>
              <Chip tone={m.available ? (m.scope === "county" ? "good" : "gold") : "muted"}>
                {m.available ? (m.scope === "county" ? "Local benchmark" : "Kenya-wide benchmark") : "Building"}
              </Chip>
              <Chip tone="muted">confidence: {m.confidence}</Chip>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">{m.marketSummary}</p>
          </div>

          {m.available ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Metric icon={TrendingUp} label="Revenue index" value={m.revenueIndex !== null ? `${m.revenueIndex}` : "—"} sub="peer median = 100" />
                <Metric icon={ShoppingBag} label="Order-count index" value={m.orderIndex !== null ? `${m.orderIndex}` : "—"} sub="peer median = 100" />
                <Metric icon={Tag} label="Avg order index" value={m.averageOrderIndex !== null ? `${m.averageOrderIndex}` : "—"} sub="peer median = 100" />
              </div>

              <div className="overflow-hidden rounded-2xl border border-border">
                <div className="flex items-center justify-between border-b border-border p-4">
                  <h3 className="text-sm font-semibold text-text-primary">What sells in your area</h3>
                  <span className="text-[10px] text-text-muted">{m.qualifiedMerchants} comparable businesses · avg units / 30 days</span>
                </div>
                <div className="divide-y divide-border">
                  {m.localTopProducts.length === 0 && <div className="p-4"><Empty>Not enough overlap between peers&apos; products to show a ranking yet.</Empty></div>}
                  {m.localTopProducts.map((p) => {
                    const sig = signalMeta[p.signal];
                    const delta = p.priceDeltaPercent;
                    return (
                      <div key={p.name} className="grid gap-3 p-4 md:grid-cols-[1.4fr_1fr_1fr_1.2fr_auto] md:items-center">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-primary">{p.name}</p>
                          <p className="text-[11px] text-text-muted">{p.category} · sold by {p.merchantsObserved} peers</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-text-primary">{p.estimatedUnits} / peer</p>
                          <div className="mt-1"><Bar value={p.demandScore} /></div>
                        </div>
                        <div>
                          <p className="text-xs text-text-secondary">You: {p.yourUnits}</p>
                        </div>
                        <div>
                          {p.areaMedianPrice !== null ? (
                            <>
                              <p className="text-xs text-text-secondary">Area ~{money(p.areaMedianPrice, cur)}</p>
                              <p className="text-[10px] text-text-muted">
                                {p.yourPrice !== null ? `yours ${money(p.yourPrice, cur)}` : "not in your range"}
                                {delta !== null && (
                                  <span className={`ml-1 ${Math.abs(delta) >= 10 ? "text-orange-400" : ""}`}>
                                    ({delta > 0 ? "+" : ""}{delta}%)
                                  </span>
                                )}
                              </p>
                            </>
                          ) : <p className="text-[10px] text-text-muted">price benchmark n/a</p>}
                        </div>
                        <Chip tone={sig.tone}>{sig.label}</Chip>
                      </div>
                    );
                  })}
                </div>
                <p className="border-t border-border p-3 text-[10px] text-text-muted">Prices are peers&apos; list prices, not realised prices.</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="What registered customers keep buying" icon={Users}>
                  {m.loyaltyProducts.length === 0 ? (
                    <Empty>Not enough peers have customers linked to orders yet for a privacy-safe view.</Empty>
                  ) : (
                    <div className="space-y-3">
                      {m.loyaltyProducts.map((p) => (
                        <div key={p.name} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-text-primary">{p.name}</p>
                            <p className="text-[10px] text-text-muted">{p.category}</p>
                          </div>
                          <span className="shrink-0 text-xs text-gold">{p.estimatedUnits} / peer</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel title="Category demand vs yours" icon={Package}>
                  {m.categoryDemand.length === 0 ? (
                    <Empty>Not enough categorised sales across peers yet.</Empty>
                  ) : (
                    <div className="space-y-4">
                      {m.categoryDemand.map((c) => (
                        <div key={c.category}>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-medium text-text-primary">{c.category}</span>
                            <span className={c.gap >= 10 ? "text-orange-400" : "text-text-muted"}>
                              area {c.areaShare}% · you {c.yourShare}%
                            </span>
                          </div>
                          <div className="mt-1.5 space-y-1">
                            <Bar value={c.areaShare} />
                            <Bar value={c.yourShare} tone="muted" />
                          </div>
                        </div>
                      ))}
                      <p className="text-[10px] text-text-muted">Gold = area share of sales · grey = your share.</p>
                    </div>
                  )}
                </Panel>
              </div>
            </>
          ) : null}

          <Panel title="Customer retention: you vs the area" icon={Activity}>
            {m.retention.available ? (
              <div className="space-y-4">
                {([
                  ["Repeat customers", m.retention.yourRepeatRate, m.retention.areaRepeatRate, true],
                  ["Active in last 30 days", m.retention.yourActiveRate, m.retention.areaActiveRate, true],
                  ["Lapsed 60+ days", m.retention.yourChurnRate, m.retention.areaChurnRate, false],
                ] as Array<[string, number | null, number | null, boolean]>).map(([label, you, area]) => (
                  <div key={label}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-text-primary">{label}</span>
                      <span className="text-text-muted">you {pct(you)} · area {pct(area)}</span>
                    </div>
                    <div className="mt-1.5 space-y-1">
                      <Bar value={you ?? 0} />
                      <Bar value={area ?? 0} tone="muted" />
                    </div>
                  </div>
                ))}
                <p className="text-[10px] leading-relaxed text-text-muted">{m.retention.note}</p>
              </div>
            ) : (
              <Empty>{m.retention.note}</Empty>
            )}
          </Panel>

          {/* demographics */}
          <Panel title="Area demographics" icon={Users}
            right={<Chip tone={d.scope === "county" ? "good" : "gold"}>{d.scope === "county" ? "County data" : "Kenya-wide"}</Chip>}>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <p className="text-sm font-semibold text-text-primary">{d.geography}</p>
              {d.population !== null && <p className="text-xs text-text-muted">{fmt(d.population)} people{d.year ? ` (${d.year} census)` : ""}</p>}
              {d.households !== null && <p className="text-xs text-text-muted">{fmt(d.households)} households{d.averageHouseholdSize ? ` · ${d.averageHouseholdSize} per household` : ""}</p>}
            </div>

            <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-background">
              {d.segments.map((s, i) => (
                <div key={s.id} className={segmentFill[i % segmentFill.length]} style={{ width: `${s.share}%` }} title={`${s.label} ${s.share}%`} />
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {d.segments.map((s, i) => (
                <div key={s.id} className="flex items-start gap-2">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-sm ${segmentFill[i % segmentFill.length]}`} />
                  <div>
                    <p className="text-xs font-medium text-text-primary">{s.label} <span className="text-text-muted">({s.ageRange})</span></p>
                    <p className="text-[11px] text-text-muted">{s.share}% · {fmt(s.population)}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-text-muted">{d.note}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-text-muted">Source: {d.source}. {d.sourceNote}</p>
          </Panel>

          {/* buying potential */}
          <Panel title="Buying potential by demographic" icon={Target} right={<Chip tone="warn">Modelled estimate</Chip>}>
            {d.buyingPotential.length === 0 ? (
              <Empty>Demographic buying-potential modelling isn&apos;t available for this business type.</Empty>
            ) : (
              <div className="divide-y divide-border">
                {d.buyingPotential.map((b, i) => (
                  <div key={`${b.segmentId}-${b.category}-${i}`} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold text-text-primary">{b.category}</p>
                        <Chip tone="muted">{b.segmentLabel} · {b.segmentShare}%</Chip>
                        <Chip tone={b.affinity === "high" ? "gold" : "muted"}>{b.affinity} affinity</Chip>
                      </div>
                      <Chip tone={b.status === "gap" ? "warn" : b.status === "covered" ? "good" : "muted"}>
                        {b.status === "gap" ? "Gap in your sales" : b.status === "covered" ? "Covered" : "No sales data"}
                      </Chip>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{b.rationale}</p>
                    {b.yourRevenueShare !== null && (
                      <p className="mt-1 text-[10px] text-text-muted">{b.yourRevenueShare}% of your revenue is in this category.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer text-[11px] font-medium text-gold">How is this calculated?</summary>
              <p className="mt-2 text-[11px] leading-relaxed text-text-muted">{d.methodology}</p>
            </details>
          </Panel>
        </div>
      )}

      {/* =====================================================
          ACTION PLAN
      ===================================================== */}
      {section === "actions" && (
        <div className="space-y-5 p-5 md:p-6">
          <div className="rounded-2xl border border-gold/20 bg-gold/5 p-5">
            <h3 className="text-sm font-semibold text-text-primary">What should you do next?</h3>
            <p className="mt-1 text-xs text-text-secondary">
              Prioritised from your sales, stock, customers and area signals.
            </p>
          </div>
          {data.actions.length === 0 && <Empty>No actions yet — more sales history will sharpen this list.</Empty>}
          {data.actions.map((a, i) => (
            <div key={`${a.title}-${i}`} className="flex gap-4 rounded-2xl border border-border p-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-sm font-bold text-gold">{i + 1}</div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-text-primary">{a.title}</h3>
                  <span className="text-[9px] uppercase tracking-wide text-text-muted">Priority {a.priority}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">{a.reason}</p>
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-background/50 p-3">
                  <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                  <p className="text-[11px] leading-relaxed text-text-muted">{a.expectedImpact}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- footer ---------- */}
      <div className="flex flex-col gap-2 border-t border-border px-5 py-3 text-[10px] text-text-muted sm:flex-row sm:items-center sm:justify-between md:px-6">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3 w-3" />
          Updated {new Date(data.generatedAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
        </span>
        <span className="inline-flex items-center gap-1">
          <BrainCircuit className="h-3 w-3 text-gold" />
          {data.ai?.provider ? `${data.ai.provider} AI` : "LipaPoint Intelligence"}
          {data.cached ? " · cached" : ""}
        </span>
      </div>
    </section>
  );
}