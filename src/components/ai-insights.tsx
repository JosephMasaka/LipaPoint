"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, ArrowUpRight } from "lucide-react";
import { canAccessFeature } from "@/lib/plans";

interface InsightsData {
  insights: string[];
  generatedAt: string;
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
        setIsLoading(false);
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

  // Upgrade prompt for STARTER plan
  if (!isAllowed) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-gold" />
          <h3 className="font-semibold text-text-primary">AI Business Insights</h3>
        </div>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
            <Sparkles className="h-6 w-6 text-gold" />
          </div>
          <p className="text-sm text-text-secondary">
            Get AI-powered business insights tailored to your store.
          </p>
          <a
            href="/dashboard/settings/plan"
            className="inline-flex items-center gap-1 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
          >
            Upgrade to Pro
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" />
          <h3 className="font-semibold text-text-primary">AI Business Insights</h3>
        </div>
        <button
          onClick={fetchInsights}
          disabled={isLoading}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text-muted transition-colors hover:text-gold disabled:opacity-50"
          aria-label="Refresh insights"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-2">
              <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-surface-elevated" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-full animate-pulse rounded bg-surface-elevated" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-surface-elevated" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Insights List */}
      {!isLoading && !error && data && (
        <div className="space-y-2.5">
          {data.insights.map((insight, index) => (
            <div key={index} className="flex gap-2 text-sm">
              <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-gold" />
              <p className="text-text-secondary">{insight}</p>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {!isLoading && data && (
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-text-muted">Powered by AI</span>
          {data.generatedAt && (
            <span className="text-xs text-text-muted">
              Updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
