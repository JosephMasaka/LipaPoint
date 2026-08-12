"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Filter, Eye } from "lucide-react";

const orders = [
  { id: "ORD-M8K2-XYZ1", date: "2026-08-12 14:23", customer: "Walk-in", items: 4, total: "$142.50", status: "completed", register: "Register 1" },
  { id: "ORD-M8K2-XYZ2", date: "2026-08-12 14:15", customer: "Table 5", items: 2, total: "$89.00", status: "preparing", register: "Register 2" },
  { id: "ORD-M8K2-XYZ3", date: "2026-08-12 13:58", customer: "Walk-in", items: 6, total: "$234.00", status: "completed", register: "Register 1" },
  { id: "ORD-M8K2-XYZ4", date: "2026-08-12 13:42", customer: "Table 12", items: 3, total: "$67.50", status: "pending", register: "Register 3" },
  { id: "ORD-M8K2-XYZ5", date: "2026-08-12 13:30", customer: "Walk-in", items: 5, total: "$312.00", status: "completed", register: "Register 1" },
  { id: "ORD-M8K2-XYZ6", date: "2026-08-12 13:15", customer: "Table 3", items: 2, total: "$45.00", status: "cancelled", register: "Register 2" },
  { id: "ORD-M8K2-XYZ7", date: "2026-08-12 12:50", customer: "Walk-in", items: 8, total: "$189.00", status: "completed", register: "Register 1" },
  { id: "ORD-M8K2-XYZ8", date: "2026-08-12 12:35", customer: "Table 8", items: 4, total: "$156.00", status: "completed", register: "Register 3" },
];

const statusVariant = {
  completed: "success" as const,
  preparing: "warning" as const,
  pending: "secondary" as const,
  cancelled: "destructive" as const,
};

export function OrdersTable() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = orders.filter((o) => {
    const matchesSearch = !search || o.id.toLowerCase().includes(search.toLowerCase()) || o.customer.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {["all", "pending", "preparing", "completed", "cancelled"].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="capitalize"
            >
              {s === "all" && <Filter className="h-3 w-3 mr-1.5" />}
              {s}
            </Button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Order ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Register</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">Items</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-zinc-800/20 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono font-medium text-zinc-200">{order.id}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{order.date}</td>
                  <td className="px-4 py-3 text-sm text-zinc-300">{order.customer}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{order.register}</td>
                  <td className="px-4 py-3 text-sm text-zinc-300 text-center tabular-nums">{order.items}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-zinc-100 text-right tabular-nums">{order.total}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={statusVariant[order.status as keyof typeof statusVariant]}>
                      {order.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
