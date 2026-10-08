"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  RefreshCw,
  ArrowUpRight,
  Lightbulb,
  Clock3,
  ChevronRight,
  Zap,
} from "lucide-react";
import { canAccessFeature } from "@/lib/plans";

interface InsightsData {
  insights: string[];
  generatedAt: string;
  provider?: string;
  cached?: boolean;
}

export function AIInsights({ tier }: { tier: string }) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAllowed = canAccessFeature(tier, "ai-assistant");

  const fetchInsights = useCallback(async () => {
    if (!isAllowed) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/insights");

      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Failed to load insights");
        return;
      }

      const json: InsightsData = await res.json();
      setData(json);
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [isAllowed]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  // ---------------------------------------------------------
  // UPGRADE STATE
  // ---------------------------------------------------------

  if (!isAllowed) {
    return (
      <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gold/10 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />

        <div className="relative p-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/20 bg-gold/10">
                <Sparkles className="h-5 w-5 text-gold" />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  AI Business Insights
                </h3>
                <p className="mt-0.5 text-xs text-text-muted">
                  Smarter decisions, powered by AI
                </p>
              </div>
            </div>

            <span className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gold">
              Pro
            </span>
          </div>

          {/* Content */}
          <div className="mt-5 rounded-xl border border-border bg-surface-elevated/50 p-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10 shadow-lg shadow-gold/5">
              <Sparkles className="h-7 w-7 text-gold" />
            </div>

            <h4 className="mt-4 text-sm font-semibold text-text-primary">
              Turn your data into decisions
            </h4>

            <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-text-secondary">
              Get personalized recommendations about sales, inventory,
              products, and growth based on your actual business data.
            </p>

            <a
              href="/dashboard/settings/plan"
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-gold/10 transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 hover:shadow-gold/20"
            >
              Unlock AI Insights
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>

          {/* Feature hints */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              "Sales",
              "Inventory",
              "Growth",
            ].map((item) => (
              <div
                key={item}
                className="rounded-lg border border-border bg-surface-elevated/40 px-2 py-2 text-center text-[10px] font-medium text-text-muted"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // MAIN STATE
  // ---------------------------------------------------------

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-shadow duration-300 hover:shadow-md">
      {/* Ambient AI glow */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-gold/8 blur-3xl" />

      {/* Subtle top accent */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/20 bg-gold/10">
              <Sparkles className="h-5 w-5 text-gold" />

              {/* Small status dot */}
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-emerald-400" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-text-primary">
                  AI Business Insights
                </h3>

                <span className="hidden rounded-full bg-gold/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gold sm:inline-flex">
                  AI
                </span>
              </div>

              <p className="mt-0.5 text-xs text-text-muted">
                Recommendations based on your business data
              </p>
            </div>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchInsights}
            disabled={isLoading}
            className="group/refresh inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface-elevated/50 px-2.5 py-1.5 text-xs font-medium text-text-muted transition-all duration-200 hover:border-gold/30 hover:bg-gold/5 hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Refresh insights"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 transition-transform ${
                isLoading ? "animate-spin" : "group-hover/refresh:rotate-180"
              }`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="mt-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-surface-elevated/40 p-3.5"
              >
                <div className="flex gap-3">
                  <div className="h-7 w-7 shrink-0 animate-pulse rounded-lg bg-surface-elevated" />

                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-4/5 animate-pulse rounded bg-surface-elevated" />
                    <div className="h-3 w-3/5 animate-pulse rounded bg-surface-elevated" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                <Zap className="h-4 w-4 text-red-400" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary">
                  Couldn't load insights
                </p>

                <p className="mt-1 text-xs leading-5 text-red-400">
                  {error}
                </p>

                <button
                  onClick={fetchInsights}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-text-primary transition-colors hover:text-gold"
                >
                  Try again
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Insights */}
        {!isLoading &&
          !error &&
          data &&
          data.insights.length > 0 && (
            <div className="mt-5 space-y-2.5">
              {data.insights.map((insight, index) => (
                <div
                  key={`${insight}-${index}`}
                  className="group/insight relative overflow-hidden rounded-xl border border-border bg-surface-elevated/40 p-3.5 transition-all duration-200 hover:border-gold/20 hover:bg-gold/[0.025]"
                >
                  <div className="flex items-start gap-3">
                    {/* Number */}
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gold/15 bg-gold/10 text-[11px] font-bold text-gold">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-5 text-text-secondary transition-colors group-hover/insight:text-text-primary">
                        {insight}
                      </p>
                    </div>

                    {/* Hover indicator */}
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-text-muted/40 transition-all duration-200 group-hover/insight:translate-x-0.5 group-hover/insight:text-gold/70" />
                  </div>
                </div>
              ))}
            </div>
          )}

        {/* Empty state */}
        {!isLoading &&
          !error &&
          data &&
          data.insights.length === 0 && (
            <div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center">
              <Lightbulb className="mx-auto h-7 w-7 text-text-muted" />

              <p className="mt-2 text-sm font-medium text-text-primary">
                No insights available yet
              </p>

              <p className="mt-1 text-xs text-text-muted">
                Keep recording sales and inventory activity and AI will
                surface useful patterns here.
              </p>
            </div>
          )}

        {/* Footer */}
        {!isLoading && data && !error && (
          <div className="mt-5 flex flex-col gap-2 border-t border-border pt-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-gold" />

              <span className="text-[10px] font-medium text-text-muted">
                AI-generated insights
              </span>

              {data.provider && (
                <span className="rounded-full bg-surface-elevated px-1.5 py-0.5 text-[9px] capitalize text-text-muted">
                  {data.provider}
                </span>
              )}
            </div>

            {data.generatedAt && (
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                <Clock3 className="h-3 w-3" />

                <span>
                  Updated{" "}
                  {new Date(
                    data.generatedAt
                  ).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
