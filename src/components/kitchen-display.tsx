"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, ChefHat, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface KitchenOrder {
  id: string;
  orderNo: string;
  table: string;
  items: { name: string; quantity: number; notes?: string }[];
  status: "pending" | "preparing" | "ready";
  createdAt: string;
  elapsedMinutes: number;
}

const initialOrders: KitchenOrder[] = [
  {
    id: "1",
    orderNo: "ORD-K001",
    table: "Table 5",
    items: [
      { name: "Beef Burger", quantity: 2, notes: "No onions" },
      { name: "Caesar Salad", quantity: 1 },
      { name: "Fish & Chips", quantity: 1 },
    ],
    status: "preparing",
    createdAt: "14:15",
    elapsedMinutes: 8,
  },
  {
    id: "2",
    orderNo: "ORD-K002",
    table: "Table 12",
    items: [
      { name: "Grilled Chicken", quantity: 1 },
      { name: "Pasta Carbonara", quantity: 2, notes: "Extra parmesan" },
    ],
    status: "pending",
    createdAt: "14:18",
    elapsedMinutes: 5,
  },
  {
    id: "3",
    orderNo: "ORD-K003",
    table: "Table 3",
    items: [
      { name: "Chef Special", quantity: 1 },
      { name: "Cheesecake", quantity: 2 },
    ],
    status: "pending",
    createdAt: "14:20",
    elapsedMinutes: 3,
  },
  {
    id: "4",
    orderNo: "ORD-K004",
    table: "Bar",
    items: [
      { name: "Fish & Chips", quantity: 3 },
      { name: "Caesar Salad", quantity: 2 },
    ],
    status: "preparing",
    createdAt: "14:12",
    elapsedMinutes: 11,
  },
];

export function KitchenDisplay() {
  const [orders, setOrders] = useState(initialOrders);

  const updateStatus = (id: string, status: KitchenOrder["status"]) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status } : o))
    );
  };

  const getUrgencyColor = (minutes: number) => {
    if (minutes >= 15) return "border-red-500/50 bg-red-500/5";
    if (minutes >= 10) return "border-amber-500/50 bg-amber-500/5";
    return "border-zinc-800";
  };

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const preparingOrders = orders.filter((o) => o.status === "preparing");
  const readyOrders = orders.filter((o) => o.status === "ready");

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      {/* KDS Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10">
            <ChefHat className="h-5 w-5 text-gold" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Kitchen Display</h1>
            <p className="text-xs text-zinc-500">Real-time order management</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="warning">{pendingOrders.length} Pending</Badge>
          <Badge variant="default">{preparingOrders.length} Preparing</Badge>
          <Badge variant="success">{readyOrders.length} Ready</Badge>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {orders
          .filter((o) => o.status !== "ready")
          .sort((a, b) => b.elapsedMinutes - a.elapsedMinutes)
          .map((order) => (
            <Card
              key={order.id}
              className={cn(
                "overflow-hidden transition-all duration-300",
                getUrgencyColor(order.elapsedMinutes)
              )}
            >
              {/* Order Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 p-3">
                <div>
                  <p className="text-sm font-bold text-zinc-100">{order.orderNo}</p>
                  <p className="text-xs text-zinc-400">{order.table}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-zinc-500" />
                  <span
                    className={cn(
                      "text-xs font-mono font-bold tabular-nums",
                      order.elapsedMinutes >= 15
                        ? "text-red-400"
                        : order.elapsedMinutes >= 10
                          ? "text-amber-400"
                          : "text-zinc-400"
                    )}
                  >
                    {order.elapsedMinutes}m
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="p-3 space-y-2">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800 text-[10px] font-bold text-zinc-300 shrink-0">
                      {item.quantity}x
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-200">{item.name}</p>
                      {item.notes && (
                        <p className="text-[11px] text-amber-400 flex items-center gap-1">
                          <AlertCircle className="h-2.5 w-2.5" />
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="border-t border-zinc-800 p-3">
                {order.status === "pending" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    onClick={() => updateStatus(order.id, "preparing")}
                  >
                    Start Preparing
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="success"
                    className="w-full"
                    onClick={() => updateStatus(order.id, "ready")}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Mark Ready
                  </Button>
                )}
              </div>
            </Card>
          ))}
      </div>

      {/* Ready Orders */}
      {readyOrders.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-emerald-400 mb-4">Ready for Pickup</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {readyOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-center animate-pulse"
              >
                <p className="text-sm font-bold text-emerald-400">{order.orderNo}</p>
                <p className="text-xs text-zinc-400 mt-1">{order.table}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
