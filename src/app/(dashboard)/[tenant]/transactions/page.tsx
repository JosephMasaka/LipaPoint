"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { formatCurrency } from "@/lib/utils";
import { Search } from "lucide-react";
import { Pagination } from "@/components/pagination";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  method: string;
  status: string;
  reference: string | null;
  description: string | null;
  order: { orderNo: string } | null;
  createdAt: string;
}

const paymentMethods = ["", "CASH", "MPESA_MANUAL", "MPESA_STK", "CARD", "PAYSTACK"];

const TXN_PAGE_SIZE = 25;

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [methodFilter, setMethodFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams();
      if (methodFilter) params.set("method", methodFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
        if (!methodFilter && !fromDate && !toDate) {
          try { localStorage.setItem("lipapoint-oc-transactions", JSON.stringify({ data, timestamp: Date.now() })); } catch {}
        }
      }
    } catch {
      if (transactions.length === 0) {
        try {
          const raw = localStorage.getItem("lipapoint-oc-transactions");
          if (raw) { const { data } = JSON.parse(raw); setTransactions(data); }
        } catch {}
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methodFilter, fromDate, toDate]);

  const filteredTransactions = transactions.filter((tx) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (tx.reference || "").toLowerCase().includes(q) ||
      (tx.description || "").toLowerCase().includes(q) ||
      (tx.order?.orderNo || "").toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filteredTransactions.length / TXN_PAGE_SIZE);
  const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * TXN_PAGE_SIZE, currentPage * TXN_PAGE_SIZE);

  const totalReceived = filteredTransactions
    .filter((t) => t.status === "COMPLETED")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalPending = filteredTransactions
    .filter((t) => t.status === "PENDING")
    .reduce((sum, t) => sum + t.amount, 0);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "success" as const;
      case "PENDING":
        return "warning" as const;
      case "FAILED":
      case "REFUNDED":
        return "destructive" as const;
      default:
        return "secondary" as const;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-surface overflow-x-hidden">
      <Header
        title="Transactions"
        subtitle="Track all payment transactions"
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">
                Total Received
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-400">
                {formatCurrency(totalReceived)}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {transactions.filter((t) => t.status === "COMPLETED").length} completed transactions
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">
                Total Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-400">
                {formatCurrency(totalPending)}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {transactions.filter((t) => t.status === "PENDING").length} pending transactions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input placeholder="Search reference, order..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="pl-9" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Payment Method
            </label>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="flex h-10 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-gold/50"
            >
              <option value="">All Methods</option>
              {paymentMethods
                .filter((m) => m)
                .map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
            </select>
          </div>
          <div className="max-w-[180px]">
            <Input
              label="From Date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="max-w-[180px]">
            <Input
              label="To Date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Reference
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Order
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12">
                        <Loader label="Loading transactions..." className="py-4" />
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    paginatedTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="hover:bg-surface-hover transition-colors"
                      >
                        <td className="px-6 py-4 font-mono text-xs text-text-primary">
                          {tx.reference || "-"}
                        </td>
                        <td className="px-6 py-4 text-text-secondary">
                          {formatDate(tx.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-text-primary capitalize">
                          {tx.type}
                        </td>
                        <td className="px-6 py-4 font-medium text-text-primary">
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="secondary">{tx.method}</Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={getStatusVariant(tx.status)}>
                            {tx.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gold">
                          {tx.order?.orderNo || "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredTransactions.length}
              pageSize={TXN_PAGE_SIZE}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
