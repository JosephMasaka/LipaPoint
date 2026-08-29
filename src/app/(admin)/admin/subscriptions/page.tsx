"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Subscription {
  id: string;
  tenantId: string;
  tier: string;
  amount: number;
  currency: string;
  status: string;
  paystackSubCode: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
  tenantName?: string;
}

interface Stats {
  totalMRR: number;
  activeSubs: number;
  churnedThisMonth: number;
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<Stats>({ totalMRR: 0, activeSubs: 0, churnedThisMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    params.set("page", String(page));
    params.set("limit", "20");

    const res = await fetch(`/api/admin/subscriptions?${params}`);
    if (res.ok) {
      const data = await res.json();
      setSubscriptions(data.subscriptions);
      setTotalPages(data.totalPages);
      setStats(data.stats);
    }
    setLoading(false);
  }, [statusFilter, page]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "cancelled": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "past_due": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Subscriptions</h1>
        <p className="text-text-secondary text-sm mt-1">Manage platform subscriptions and payments</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-surface-elevated border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Total MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-text-primary">{formatCurrency(stats.totalMRR)}</p>
          </CardContent>
        </Card>
        <Card className="bg-surface-elevated border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Active Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-text-primary">{stats.activeSubs}</p>
          </CardContent>
        </Card>
        <Card className="bg-surface-elevated border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Churned This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-400">{stats.churnedThisMonth}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg border border-border bg-surface-elevated text-text-primary text-sm"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="cancelled">Cancelled</option>
          <option value="past_due">Past Due</option>
        </select>
      </div>

      {/* Table */}
      <Card className="bg-surface-elevated border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Tenant</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Plan</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Amount</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Payment Date</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Paystack Ref</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-text-muted">Loading...</td>
                  </tr>
                ) : subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-text-muted">No subscriptions found</td>
                  </tr>
                ) : (
                  subscriptions.map((sub) => (
                    <tr key={sub.id} className="border-b border-border/50 hover:bg-surface-hover">
                      <td className="py-3 px-4 text-text-primary font-medium">{sub.tenantName || sub.tenantId}</td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className="text-xs">{sub.tier}</Badge>
                      </td>
                      <td className="py-3 px-4 text-text-primary">{formatCurrency(sub.amount)}</td>
                      <td className="py-3 px-4">
                        <Badge className={getStatusColor(sub.status)}>{sub.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-text-muted">
                        {new Date(sub.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-text-muted text-xs font-mono">
                        {sub.paystackSubCode || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-text-secondary">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
