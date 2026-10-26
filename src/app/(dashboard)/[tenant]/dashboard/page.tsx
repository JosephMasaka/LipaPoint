"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/loader";
import { AIInsights } from "@/components/ai-insights";
import { usePlan } from "@/components/plan-guard";
import { formatCurrency } from "@/lib/utils";
import { appsFromModules, APP_TASKS, type AppId } from "@/lib/apps";
import {
  ShoppingCart, Package, TrendingUp, Users, AlertTriangle,
  ClipboardList, Clock, DollarSign, ArrowUp, ArrowDown,
  LayoutDashboard, Calculator, HandCoins, Boxes, Globe, X, ArrowRight,
} from "lucide-react";

/** Odoo-style "apps dashboard": launch tiles for the purchased apps, each
 *  with a one-line get-started task. Dismissible, first login only. */
const WELCOME_KEY = "lipapoint-apps-welcome-dismissed";
const APP_TILE_ICONS: Record<AppId, React.ComponentType<{ className?: string }>> = {
  pos: LayoutDashboard,
  crm: Users,
  finance: Calculator,
  payroll: HandCoins,
  assets: Boxes,
  etims: Globe,
};

interface DashboardStats {
  todaySales: number;
  todayOrders: number;
  openTabs: number;
  monthRevenue: number;
  activeProducts: number;
  lowStockCount: number;
  activeStaff: number;
  recentOrders: { id: string; orderNo: string; total: number; status: string; tabName: string | null; createdAt: string; customerName: string | null }[];
  lowStockProducts: { id: string; name: string; stock: number; lowStockAlert: number }[];
  topProducts: { name: string; count: number; revenue: number }[];
}

export default function DashboardPage() {
  const plan = usePlan();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const tenantSlug = usePathname().split("/")[1] || "";

  // First-run apps panel — only for owners/admins (the modules API is
  // admin-gated) and only until it's dismissed.
  const [welcomeApps, setWelcomeApps] = useState<AppId[] | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(WELCOME_KEY) === "1"; } catch {}
    if (dismissed) return;
    fetch("/api/modules", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !Array.isArray(d.modules)) return;
        const enabled = d.modules.filter((m: { enabled: boolean }) => m.enabled).map((m: { key: string }) => m.key);
        const apps = [...appsFromModules(enabled)];
        if (apps.length === 0) return;
        setWelcomeApps(apps);
        setShowWelcome(true);
      })
      .catch(() => {});
  }, []);

  function dismissWelcome() {
    setShowWelcome(false);
    try { localStorage.setItem(WELCOME_KEY, "1"); } catch {}
  }

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        try { localStorage.setItem("lipapoint-oc-dashboard", JSON.stringify({ data, timestamp: Date.now() })); } catch {}
      })
      .catch(() => {
        try {
          const raw = localStorage.getItem("lipapoint-oc-dashboard");
          if (raw) { const { data } = JSON.parse(raw); setStats(data); }
        } catch {}
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface overflow-x-hidden">
        <Header title="Dashboard" subtitle="Loading your business overview..." />
        <PageLoader label="Loading dashboard..." />
      </div>
    );
  }

  const data = stats || {
    todaySales: 0, todayOrders: 0, openTabs: 0, monthRevenue: 0,
    activeProducts: 0, lowStockCount: 0, activeStaff: 0,
    recentOrders: [], lowStockProducts: [], topProducts: [],
  };

  return (
    <div className="min-h-screen bg-surface overflow-x-hidden">
      <Header title="Dashboard" subtitle="System overview and real-time status" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Guided first run — purchased apps as launch tiles */}
        {showWelcome && welcomeApps && welcomeApps.length > 0 && (
          <Card className="border-gold/20 bg-gold/5/40">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-3">
              <div>
                <CardTitle className="text-base">Your apps</CardTitle>
                <p className="text-sm text-text-secondary mt-0.5">
                  Everything you picked at sign-up — start with whichever task makes sense.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={dismissWelcome} aria-label="Dismiss">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {welcomeApps.map((id) => {
                  const meta = APP_TASKS[id];
                  const Icon = APP_TILE_ICONS[id];
                  if (!meta) return null;
                  return (
                    <Link
                      key={id}
                      href={`/${tenantSlug}${meta.href}`}
                      className="group flex items-center gap-3 rounded-xl border border-border bg-surface-elevated p-3.5 transition-colors hover:border-gold/40 hover:bg-gold/5"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-text-primary truncate">{meta.title}</span>
                        <span className="block text-xs text-text-secondary truncate">{meta.task}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />
                    </Link>
                  );
                })}
              </div>
              <p className="text-xs text-text-muted mt-3">
                Need another app? Switch it on from the{" "}
                <Link href={`/${tenantSlug}/dashboard/modules`} className="text-gold hover:underline">
                  Apps screen
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <DollarSign className="h-5 w-5 text-gold" />
                <ArrowUp className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <p className="mt-3 text-xl sm:text-2xl font-bold text-text-primary">{formatCurrency(data.todaySales)}</p>
              <p className="text-xs text-text-muted mt-1">Today&apos;s Sales</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <ShoppingCart className="h-5 w-5 text-blue-400" />
                <span className="text-xs text-text-muted">{data.todayOrders} today</span>
              </div>
              <p className="mt-3 text-xl sm:text-2xl font-bold text-text-primary">{data.todayOrders}</p>
              <p className="text-xs text-text-muted mt-1">Orders Today</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <Clock className="h-5 w-5 text-amber-400" />
                {data.openTabs > 0 && <Badge variant="warning">{data.openTabs} open</Badge>}
              </div>
              <p className="mt-3 text-xl sm:text-2xl font-bold text-text-primary">{data.openTabs}</p>
              <p className="text-xs text-text-muted mt-1">Open Tabs</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                <ArrowUp className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <p className="mt-3 text-xl sm:text-2xl font-bold text-emerald-400">{formatCurrency(data.monthRevenue)}</p>
              <p className="text-xs text-text-muted mt-1">This Month</p>
            </CardContent>
          </Card>
        </div>

        {/* Second Row - Quick Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Package className="h-5 w-5 text-text-secondary" />
              <div>
                <p className="text-lg font-bold text-text-primary">{data.activeProducts}</p>
                <p className="text-xs text-text-muted">Products</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div>
                <p className="text-lg font-bold text-red-400">{data.lowStockCount}</p>
                <p className="text-xs text-text-muted">Low Stock</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-text-secondary" />
              <div>
                <p className="text-lg font-bold text-text-primary">{data.activeStaff}</p>
                <p className="text-xs text-text-muted">Staff</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Recent Orders */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Recent Orders
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {data.recentOrders.length === 0 ? (
                    <p className="p-6 text-sm text-text-muted text-center">No orders yet today</p>
                  ) : (
                    data.recentOrders.slice(0, 8).map((order) => (
                      <div key={order.id} className="flex items-center justify-between px-4 sm:px-6 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div>
                            <p className="text-sm font-medium text-text-primary">
                              {order.tabName || order.customerName || order.orderNo}
                            </p>
                            <p className="text-xs text-text-muted">
                              {new Date(order.createdAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={
                            order.status === "COMPLETED" ? "success" :
                            order.status === "TAB" ? "warning" :
                            order.status === "CANCELLED" ? "destructive" : "secondary"
                          }>
                            {order.status}
                          </Badge>
                          <span className="text-sm font-medium text-text-primary">{formatCurrency(order.total)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alerts & Quick Info */}
          <div className="space-y-6">
            {/* Low Stock Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  Low Stock Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.lowStockProducts.length === 0 ? (
                  <p className="text-sm text-text-muted">All stock levels healthy</p>
                ) : (
                  data.lowStockProducts.slice(0, 5).map((p) => (
                    <div key={p.id} className="flex items-center justify-between">
                      <span className="text-sm text-text-primary truncate">{p.name}</span>
                      <Badge variant="destructive">{p.stock} left</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowDown className="h-4 w-4 rotate-180 text-gold" />
                  Top Selling Today
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.topProducts.length === 0 ? (
                  <p className="text-sm text-text-muted">No sales data yet</p>
                ) : (
                  data.topProducts.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-text-primary truncate">{p.name}</span>
                      <span className="text-xs text-text-secondary">{p.count}x</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* AI Insights */}
        <AIInsights tier={plan?.tier || "STARTER"} />
      </div>
    </div>
  );
}
