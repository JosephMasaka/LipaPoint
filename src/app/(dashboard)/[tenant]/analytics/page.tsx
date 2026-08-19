"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/loader";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, BarChart3, PieChart,
  Calendar, DollarSign, ShoppingCart, Users,
} from "lucide-react";

interface AnalyticsData {
  revenue: { today: number; yesterday: number; week: number; month: number; lastMonth: number };
  orders: { today: number; week: number; month: number; avgOrderValue: number };
  topProducts: { name: string; quantity: number; revenue: number }[];
  topCategories: { name: string; revenue: number; percentage: number }[];
  salesByHour: { hour: string; sales: number }[];
  salesByDay: { day: string; sales: number }[];
  paymentMethods: { method: string; count: number; total: number }[];
  staffPerformance: { name: string; orders: number; revenue: number }[];
  profitMargin: { revenue: number; cost: number; profit: number; margin: number };
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");

  useEffect(() => {
    fetch(`/api/analytics?period=${period}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  const pctChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const d = data || {
    revenue: { today: 0, yesterday: 0, week: 0, month: 0, lastMonth: 0 },
    orders: { today: 0, week: 0, month: 0, avgOrderValue: 0 },
    topProducts: [], topCategories: [], salesByHour: [], salesByDay: [],
    paymentMethods: [], staffPerformance: [],
    profitMargin: { revenue: 0, cost: 0, profit: 0, margin: 0 },
  };

  const revenueChange = pctChange(d.revenue.today, d.revenue.yesterday);
  const monthChange = pctChange(d.revenue.month, d.revenue.lastMonth);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface overflow-x-hidden">
        <Header title="Analytics" subtitle="Comprehensive business performance insights" />
        <PageLoader label="Loading analytics..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface overflow-x-hidden">
      <Header title="Analytics" subtitle="Comprehensive business performance insights" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Period Selector */}
        <div className="flex gap-1 rounded-lg border border-border p-1 bg-surface-elevated w-fit">
          {(["today", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                period === p ? "bg-gold/10 text-gold border border-gold/20" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {p === "today" ? "Today" : p === "week" ? "This Week" : "This Month"}
            </button>
          ))}
        </div>

        {/* Revenue Overview */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="h-4 w-4 text-gold" />
                <div className={`flex items-center gap-0.5 text-xs ${revenueChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {revenueChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(revenueChange)}%
                </div>
              </div>
              <p className="text-lg sm:text-xl font-bold text-text-primary">{formatCurrency(d.revenue.today)}</p>
              <p className="text-xs text-text-muted">Today&apos;s Revenue</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <Calendar className="h-4 w-4 text-blue-400" />
                <div className={`flex items-center gap-0.5 text-xs ${monthChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {monthChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(monthChange)}%
                </div>
              </div>
              <p className="text-lg sm:text-xl font-bold text-text-primary">{formatCurrency(d.revenue.month)}</p>
              <p className="text-xs text-text-muted">Monthly Revenue</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <ShoppingCart className="h-4 w-4 text-text-secondary mb-2" />
              <p className="text-lg sm:text-xl font-bold text-text-primary">{d.orders.month}</p>
              <p className="text-xs text-text-muted">Monthly Orders</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <BarChart3 className="h-4 w-4 text-text-secondary mb-2" />
              <p className="text-lg sm:text-xl font-bold text-text-primary">{formatCurrency(d.orders.avgOrderValue)}</p>
              <p className="text-xs text-text-muted">Avg Order Value</p>
            </CardContent>
          </Card>
        </div>

        {/* Profit Margin */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-4 w-4" /> Profit Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-text-muted">Revenue</p>
                <p className="text-lg font-bold text-text-primary">{formatCurrency(d.profitMargin.revenue)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Cost</p>
                <p className="text-lg font-bold text-red-400">{formatCurrency(d.profitMargin.cost)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Gross Profit</p>
                <p className="text-lg font-bold text-emerald-400">{formatCurrency(d.profitMargin.profit)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Margin</p>
                <p className="text-lg font-bold text-gold">{d.profitMargin.margin.toFixed(1)}%</p>
              </div>
            </div>
            {d.profitMargin.revenue > 0 && (
              <div className="mt-4 h-3 rounded-full bg-surface-hover overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: `${d.profitMargin.margin}%` }} />
                <div className="bg-red-400/50 h-full flex-1" />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Sales by Hour - Simple bar chart */}
          <Card>
            <CardHeader>
              <CardTitle>Sales by Hour</CardTitle>
            </CardHeader>
            <CardContent>
              {d.salesByHour.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-8">No sales data for this period</p>
              ) : (
                <div className="flex items-end gap-1 h-40">
                  {d.salesByHour.map((h, i) => {
                    const max = Math.max(...d.salesByHour.map(s => s.sales), 1);
                    const height = (h.sales / max) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-gold/60 rounded-t hover:bg-gold transition-colors"
                          style={{ height: `${height}%`, minHeight: h.sales > 0 ? "4px" : "0" }}
                          title={`${h.hour}: ${formatCurrency(h.sales)}`}
                        />
                        <span className="text-[9px] text-text-muted">{h.hour}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sales by Day */}
          <Card>
            <CardHeader>
              <CardTitle>Sales by Day</CardTitle>
            </CardHeader>
            <CardContent>
              {d.salesByDay.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-8">No sales data for this period</p>
              ) : (
                <div className="space-y-2">
                  {d.salesByDay.map((day, i) => {
                    const max = Math.max(...d.salesByDay.map(s => s.sales), 1);
                    const width = (day.sales / max) * 100;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-text-secondary w-12 shrink-0">{day.day}</span>
                        <div className="flex-1 h-5 bg-surface-hover rounded overflow-hidden">
                          <div className="h-full bg-gold/60 rounded" style={{ width: `${width}%` }} />
                        </div>
                        <span className="text-xs text-text-muted w-20 text-right">{formatCurrency(day.sales)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle>Top Products</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {d.topProducts.length === 0 ? (
                <p className="text-sm text-text-muted">No data</p>
              ) : (
                d.topProducts.slice(0, 8).map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-text-muted w-4">{i + 1}.</span>
                      <span className="text-sm text-text-primary truncate">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-text-muted">{p.quantity}x</span>
                      <span className="text-xs font-medium text-gold">{formatCurrency(p.revenue)}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Top Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {d.topCategories.length === 0 ? (
                <p className="text-sm text-text-muted">No data</p>
              ) : (
                d.topCategories.slice(0, 8).map((c, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-sm text-text-primary">{c.name}</span>
                      <span className="text-xs text-text-muted">{c.percentage.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
                      <div className="h-full bg-gold rounded-full" style={{ width: `${c.percentage}%` }} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {d.paymentMethods.length === 0 ? (
                <p className="text-sm text-text-muted">No data</p>
              ) : (
                d.paymentMethods.map((pm, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{pm.method}</Badge>
                      <span className="text-xs text-text-muted">{pm.count} orders</span>
                    </div>
                    <span className="text-sm font-medium text-text-primary">{formatCurrency(pm.total)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Staff Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Staff Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.staffPerformance.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">No data for this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs font-medium text-text-secondary">Staff</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-text-secondary">Orders</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-text-secondary">Revenue</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-text-secondary">Avg/Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {d.staffPerformance.map((s, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3 text-text-primary">{s.name}</td>
                        <td className="py-2 px-3 text-right text-text-secondary">{s.orders}</td>
                        <td className="py-2 px-3 text-right font-medium text-gold">{formatCurrency(s.revenue)}</td>
                        <td className="py-2 px-3 text-right text-text-secondary">
                          {s.orders > 0 ? formatCurrency(s.revenue / s.orders) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
