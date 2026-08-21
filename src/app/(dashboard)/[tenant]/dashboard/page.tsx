"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/loader";
import { formatCurrency } from "@/lib/utils";
import {
  ShoppingCart, Package, TrendingUp, Users, AlertTriangle,
  ClipboardList, Clock, DollarSign, ArrowUp, ArrowDown,
} from "lucide-react";

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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

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
      </div>
    </div>
  );
}
