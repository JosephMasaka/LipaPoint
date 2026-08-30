"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { ChefHat, Clock, CheckCircle, Play, Check, ArrowRight } from "lucide-react";

interface KitchenItem {
  id: string;
  quantity: number;
  kitchenStatus: "PENDING" | "PREPARING" | "READY" | "SERVED";
  note: string | null;
  product: { id: string; name: string };
}

interface KitchenOrder {
  id: string;
  orderNo: string;
  status: string;
  createdAt: string;
  table: { id: string; name: string } | null;
  items: KitchenItem[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function KitchenDisplayPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const [prevOrderCount, setPrevOrderCount] = useState(0);
  const [hasNewOrders, setHasNewOrders] = useState(false);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchOrders = useCallback(() => {
    fetch("/api/kitchen")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          // Detect new orders for pulse animation
          const pendingCount = data.filter(
            (o: KitchenOrder) => o.items.some((i) => i.kitchenStatus === "PENDING")
          ).length;
          if (pendingCount > prevOrderCount && prevOrderCount > 0) {
            setHasNewOrders(true);
            setTimeout(() => setHasNewOrders(false), 5000);
          }
          setPrevOrderCount(pendingCount);
          setOrders(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [prevOrderCount]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/kitchen")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const pendingCount = data.filter(
              (o: KitchenOrder) => o.items.some((i) => i.kitchenStatus === "PENDING")
            ).length;
            if (pendingCount > prevOrderCount && prevOrderCount > 0) {
              setHasNewOrders(true);
              setTimeout(() => setHasNewOrders(false), 5000);
            }
            setPrevOrderCount(pendingCount);
            setOrders(data);
          }
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [prevOrderCount]);

  const updateItemStatus = async (
    itemId: string,
    newStatus: "PREPARING" | "READY" | "SERVED"
  ) => {
    setUpdatingItem(itemId);
    try {
      const res = await fetch(`/api/kitchen/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kitchenStatus: newStatus }),
      });
      if (res.ok) {
        // Optimistically update the local state
        setOrders((prev) =>
          prev
            .map((order) => ({
              ...order,
              items: order.items.map((item) =>
                item.id === itemId ? { ...item, kitchenStatus: newStatus } : item
              ),
            }))
            // Remove orders where all items are now SERVED
            .filter((order) => order.items.some((item) => {
              const status = item.id === itemId ? newStatus : item.kitchenStatus;
              return status !== "SERVED";
            }))
        );
      } else {
        const data = await res.json();
        notify("error", data.error || "Failed to update item");
      }
    } catch {
      notify("error", "Network error");
    } finally {
      setUpdatingItem(null);
    }
  };

  // Categorize orders by their items' statuses into columns
  const pendingOrders: KitchenOrder[] = [];
  const preparingOrders: KitchenOrder[] = [];
  const readyOrders: KitchenOrder[] = [];

  orders.forEach((order) => {
    const hasPending = order.items.some((i) => i.kitchenStatus === "PENDING");
    const hasPreparing = order.items.some((i) => i.kitchenStatus === "PREPARING");
    const hasReady = order.items.some((i) => i.kitchenStatus === "READY");

    // An order can appear in multiple columns if it has items in different statuses
    if (hasPending) pendingOrders.push({ ...order, items: order.items.filter((i) => i.kitchenStatus === "PENDING") });
    if (hasPreparing) preparingOrders.push({ ...order, items: order.items.filter((i) => i.kitchenStatus === "PREPARING") });
    if (hasReady) readyOrders.push({ ...order, items: order.items.filter((i) => i.kitchenStatus === "READY") });
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-surface overflow-x-hidden">
        <Header title="Kitchen Display" subtitle="Track and manage order preparation" />
        <div className="p-4 sm:p-6 lg:p-8">
          <Loader size="lg" label="Loading kitchen orders..." className="min-h-[60vh]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface overflow-x-hidden">
      <Header title="Kitchen Display" subtitle="Track and manage order preparation" />

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm ${notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <div className="p-4 sm:p-6 lg:p-8">
        {/* Summary bar */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-gold" />
            <span className="text-sm font-medium text-text-primary">
              {orders.length} active order{orders.length !== 1 ? "s" : ""}
            </span>
          </div>
          {hasNewOrders && (
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
              <span className="text-sm font-medium text-amber-400">New orders!</span>
            </div>
          )}
        </div>

        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <ChefHat className="h-12 w-12 text-text-muted mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium text-text-secondary mb-1">Kitchen is clear</p>
              <p className="text-sm text-text-muted">No pending orders at the moment.</p>
            </CardContent>
          </Card>
        ) : (
          /* Kanban Columns */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* PENDING Column */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <h2 className="text-base sm:text-lg font-bold text-text-primary">New Orders</h2>
                <Badge variant="warning">{pendingOrders.length}</Badge>
              </div>
              <div className="space-y-3">
                {pendingOrders.length === 0 ? (
                  <p className="text-sm text-text-muted py-8 text-center">No new orders</p>
                ) : (
                  pendingOrders.map((order) => (
                    <OrderCard
                      key={`pending-${order.id}`}
                      order={order}
                      borderColor="border-amber-500/40"
                      actionLabel="Start"
                      actionIcon={<Play className="h-3.5 w-3.5" />}
                      nextStatus="PREPARING"
                      updatingItem={updatingItem}
                      onUpdateItem={updateItemStatus}
                    />
                  ))
                )}
              </div>
            </div>

            {/* PREPARING Column */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-3 rounded-full bg-blue-400" />
                <h2 className="text-base sm:text-lg font-bold text-text-primary">Preparing</h2>
                <Badge variant="default">{preparingOrders.length}</Badge>
              </div>
              <div className="space-y-3">
                {preparingOrders.length === 0 ? (
                  <p className="text-sm text-text-muted py-8 text-center">Nothing being prepared</p>
                ) : (
                  preparingOrders.map((order) => (
                    <OrderCard
                      key={`preparing-${order.id}`}
                      order={order}
                      borderColor="border-blue-500/40"
                      actionLabel="Done"
                      actionIcon={<Check className="h-3.5 w-3.5" />}
                      nextStatus="READY"
                      updatingItem={updatingItem}
                      onUpdateItem={updateItemStatus}
                    />
                  ))
                )}
              </div>
            </div>

            {/* READY Column */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-3 rounded-full bg-emerald-400" />
                <h2 className="text-base sm:text-lg font-bold text-text-primary">Ready to Serve</h2>
                <Badge variant="success">{readyOrders.length}</Badge>
              </div>
              <div className="space-y-3">
                {readyOrders.length === 0 ? (
                  <p className="text-sm text-text-muted py-8 text-center">Nothing ready yet</p>
                ) : (
                  readyOrders.map((order) => (
                    <OrderCard
                      key={`ready-${order.id}`}
                      order={order}
                      borderColor="border-emerald-500/40"
                      actionLabel="Served"
                      actionIcon={<ArrowRight className="h-3.5 w-3.5" />}
                      nextStatus="SERVED"
                      updatingItem={updatingItem}
                      onUpdateItem={updateItemStatus}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  borderColor,
  actionLabel,
  actionIcon,
  nextStatus,
  updatingItem,
  onUpdateItem,
}: {
  order: KitchenOrder;
  borderColor: string;
  actionLabel: string;
  actionIcon: React.ReactNode;
  nextStatus: "PREPARING" | "READY" | "SERVED";
  updatingItem: string | null;
  onUpdateItem: (itemId: string, status: "PREPARING" | "READY" | "SERVED") => void;
}) {
  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardContent className="p-4">
        {/* Order header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm sm:text-base font-bold text-text-primary">
              #{order.orderNo}
            </p>
            {order.table && (
              <p className="text-xs text-text-secondary mt-0.5">
                {order.table.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-text-muted">
            <Clock className="h-3 w-3" />
            {timeAgo(order.createdAt)}
          </div>
        </div>

        {/* Items */}
        <div className="space-y-2">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-surface/60 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm sm:text-base font-medium text-text-primary truncate">
                  {item.quantity}x {item.product.name}
                </p>
                {item.note && (
                  <p className="text-xs text-text-muted italic mt-0.5 truncate">
                    {item.note}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant={nextStatus === "SERVED" ? "outline" : "default"}
                onClick={() => onUpdateItem(item.id, nextStatus)}
                disabled={updatingItem === item.id}
                className="shrink-0 text-xs"
              >
                {updatingItem === item.id ? (
                  <Loader size="sm" />
                ) : (
                  <>
                    {actionIcon}
                    <span className="ml-1 hidden sm:inline">{actionLabel}</span>
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
