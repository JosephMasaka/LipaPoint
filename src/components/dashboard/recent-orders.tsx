"use client";

import { Badge } from "@/components/ui/badge";

const orders = [
  { id: "ORD-001", customer: "Walk-in", total: "$142.50", status: "completed" },
  { id: "ORD-002", customer: "Table 5", total: "$89.00", status: "preparing" },
  { id: "ORD-003", customer: "Walk-in", total: "$234.00", status: "completed" },
  { id: "ORD-004", customer: "Table 12", total: "$67.50", status: "pending" },
  { id: "ORD-005", customer: "Walk-in", total: "$312.00", status: "completed" },
];

const statusVariant = {
  completed: "success" as const,
  preparing: "warning" as const,
  pending: "secondary" as const,
  cancelled: "destructive" as const,
};

export function RecentOrders() {
  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <div
          key={order.id}
          className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/30 p-3"
        >
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-zinc-200">{order.id}</p>
            <p className="text-xs text-zinc-500">{order.customer}</p>
          </div>
          <div className="text-right space-y-0.5">
            <p className="text-sm font-semibold text-zinc-100 tabular-nums">
              {order.total}
            </p>
            <Badge variant={statusVariant[order.status as keyof typeof statusVariant]}>
              {order.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
