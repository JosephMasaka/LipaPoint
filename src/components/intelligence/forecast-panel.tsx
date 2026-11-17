"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, TrendingDown, TrendingUp, Wallet } from "lucide-react";

interface Forecast {
  currency: string;
  horizonDays: number;
  weeks: Array<{
    start: string;
    end: string;
    expectedInflow: number;
    expectedOutflow: number;
    committedOutflow: number;
    net: number;
  }>;
  totals: { expectedInflow: number; expectedOutflow: number; net: number };
  assumptions: string[];
  warnings: string[];
  coverage: {
    salesDays: number;
    expenseDays: number;
    unpaidInvoices: number;
    confidence: "low" | "medium" | "high";
  };
  anomalies: Array<{
    id: string;
    type: "expense-spike" | "sales-drop";
    severity: "high" | "medium";
    title: string;
    detail: string;
    date: string;
  }>;
}

interface AccuracyWeek {
  start: string;
  end: string;
  expectedInflow: number;
  expectedOutflow: number;
  actualInflow: number;
  actualOutflow: number;
  paidInvoiceOutflow: number;
  inflowErrorPercent: number | null;
  outflowErrorPercent: number | null;
  baselineSalesDays: number;
  baselineExpenseDays: number;
}

interface Accuracy {
  weeks: AccuracyWeek[];
  meanAbsoluteErrorPercent: { inflow: number | null; outflow: number | null };
  notes: string[];
}

const CONFIDENCE_CLASS: Record<Forecast["coverage"]["confidence"], string> = {
  high: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medium: "bg-gold/10 text-gold border-gold/20",
  low: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

export function ForecastPanel() {
  const [data, setData] = useState<Forecast | null>(null);
  const [accuracy, setAccuracy] = useState<Accuracy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/forecast", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "Could not build the forecast.");
          return;
        }
        setData(json.forecast as Forecast);
        setAccuracy((json.accuracy as Accuracy) ?? null);
      })
      .catch(() => {
        if (!cancelled) setError("Could not build the forecast.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="rounded-2xl border border-border p-5 text-xs text-text-muted">{error}</p>;
  }
  if (!data) {
    return <p className="rounded-2xl border border-border p-5 text-xs text-text-muted">Building forecast…</p>;
  }

  const money = (value: number) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: data.currency,
      maximumFractionDigits: 0,
    }).format(value);

  const shortDate = (iso: string) =>
    new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  return (
    <section className="rounded-2xl border border-border p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Wallet className="h-4 w-4 text-gold" />
        <h3 className="text-sm font-semibold text-text-primary">
          Cash flow — next {data.horizonDays} days
        </h3>
        <span
          className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${CONFIDENCE_CLASS[data.coverage.confidence]}`}
        >
          {data.coverage.confidence} confidence
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase tracking-wide text-text-muted">
            <tr>
              <th className="pb-2 font-medium">Week</th>
              <th className="pb-2 text-right font-medium">In</th>
              <th className="pb-2 text-right font-medium">Out</th>
              <th className="pb-2 text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody className="text-text-secondary">
            {data.weeks.map((week) => (
              <tr key={week.start} className="border-t border-border/60">
                <td className="py-2">
                  {shortDate(week.start)} – {shortDate(week.end)}
                </td>
                <td className="py-2 text-right">{money(week.expectedInflow)}</td>
                <td className="py-2 text-right">
                  {money(week.expectedOutflow)}
                  {week.committedOutflow > 0 && (
                    <span className="ml-1 text-[10px] text-text-muted">
                      ({money(week.committedOutflow)} invoiced)
                    </span>
                  )}
                </td>
                <td
                  className={`py-2 text-right font-medium ${
                    week.net < 0 ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {money(week.net)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <td className="pt-2 text-[11px] font-semibold text-text-primary">Total</td>
              <td className="pt-2 text-right text-text-primary">{money(data.totals.expectedInflow)}</td>
              <td className="pt-2 text-right text-text-primary">{money(data.totals.expectedOutflow)}</td>
              <td
                className={`pt-2 text-right font-semibold ${
                  data.totals.net < 0 ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {money(data.totals.net)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-text-muted">
        <span>{data.coverage.salesDays} sales days</span>
        <span>{data.coverage.expenseDays} expense days</span>
        <span>{data.coverage.unpaidInvoices} unpaid invoices due</span>
      </div>

      <AccuracyReadout accuracy={accuracy} money={money} shortDate={shortDate} />

      {data.warnings.length > 0 && (
        <div className="mt-3 rounded-xl border border-orange-500/20 bg-orange-500/10 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-orange-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Coverage warnings
          </p>
          <ul className="mt-1.5 list-disc pl-4 text-[11px] leading-relaxed text-text-muted">
            {data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {data.anomalies.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] uppercase tracking-wide text-text-muted">
            Flags from the last few days
          </p>
          <ul className="space-y-1.5">
            {data.anomalies.map((anomaly) => (
              <li
                key={anomaly.id}
                className="flex gap-2 rounded-lg border border-border bg-background/30 p-2.5"
              >
                {anomaly.type === "sales-drop" ? (
                  <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" />
                ) : (
                  <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" />
                )}
                <div>
                  <p className="text-[11px] font-medium text-text-primary">
                    {anomaly.title}
                    <span className="ml-1.5 text-[10px] uppercase text-text-muted">{anomaly.severity}</span>
                  </p>
                  <p className="text-[11px] leading-relaxed text-text-muted">{anomaly.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-text-muted hover:text-text-primary">
          Assumptions
        </summary>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[10px] leading-relaxed text-text-muted">
          {data.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function AccuracyReadout({
  accuracy,
  money,
  shortDate,
}: {
  accuracy: Accuracy | null;
  money: (value: number) => string;
  shortDate: (iso: string) => string;
}) {
  if (!accuracy || accuracy.weeks.length === 0) return null;

  const compared = accuracy.weeks.filter(
    (week) => week.inflowErrorPercent !== null || week.outflowErrorPercent !== null
  );
  if (compared.length === 0) return null;

  return (
    <section className="mt-4 rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="text-[10px] uppercase tracking-wide text-text-muted">
          Forecast accuracy — last {compared.length} completed week{compared.length === 1 ? "" : "s"}
        </p>
        <p className="ml-auto text-[10px] text-text-muted">
          mean error: in {formatPercent(accuracy.meanAbsoluteErrorPercent.inflow)} · out{" "}
          {formatPercent(accuracy.meanAbsoluteErrorPercent.outflow)}
        </p>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="text-[10px] uppercase tracking-wide text-text-muted">
            <tr>
              <th className="pb-1.5 font-medium">Week</th>
              <th className="pb-1.5 text-right font-medium">In: forecast</th>
              <th className="pb-1.5 text-right font-medium">actual</th>
              <th className="pb-1.5 text-right font-medium">Out: forecast</th>
              <th className="pb-1.5 text-right font-medium">actual</th>
            </tr>
          </thead>
          <tbody className="text-text-secondary">
            {compared.map((week) => (
              <tr key={week.start} className="border-t border-border/60">
                <td
                  className="py-1.5 whitespace-nowrap"
                  title={`Baseline data: ${week.baselineSalesDays} sales days, ${week.baselineExpenseDays} expense days`}
                >
                  {shortDate(week.start)} – {shortDate(week.end)}
                </td>
                <td className="py-1.5 text-right whitespace-nowrap">
                  {money(week.expectedInflow)}
                  <ErrorBadge percent={week.inflowErrorPercent} />
                </td>
                <td className="py-1.5 text-right whitespace-nowrap">{money(week.actualInflow)}</td>
                <td className="py-1.5 text-right whitespace-nowrap">
                  {money(week.expectedOutflow)}
                  <ErrorBadge percent={week.outflowErrorPercent} />
                </td>
                <td className="py-1.5 text-right">{money(week.actualOutflow)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {accuracy.weeks.some((week) => week.paidInvoiceOutflow > 0) && (
        <p className="mt-2 text-[10px] text-text-muted">
          Supplier payments recorded in these weeks:{" "}
          {accuracy.weeks
            .filter((week) => week.paidInvoiceOutflow > 0)
            .map((week) => `${shortDate(week.start)} ${money(week.paidInvoiceOutflow)}`)
            .join(" · ")}
        </p>
      )}

      <ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] leading-relaxed text-text-muted">
        {accuracy.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  );
}

function ErrorBadge({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  const tone =
    Math.abs(percent) <= 15
      ? "bg-emerald-500/10 text-emerald-400"
      : Math.abs(percent) <= 40
        ? "bg-gold/10 text-gold"
        : "bg-orange-500/10 text-orange-400";
  return (
    <span
      className={`ml-1.5 inline-block rounded px-1 py-0.5 text-[10px] tabular-nums ${tone}`}
    >
      {percent > 0 ? "+" : ""}
      {percent.toFixed(0)}%
    </span>
  );
}

function formatPercent(value: number | null) {
  return value === null ? "n/a" : `${value.toFixed(0)}%`;
}
