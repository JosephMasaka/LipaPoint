"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface Order {
  id: string;
  orderNo: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  itemsCount: number;
  user: { name: string };
  items: { id: string; quantity: number }[];
  createdAt: string;
}

const statusFilters = ["ALL", "PENDING", "COMPLETED", "CANCELLED"];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch {
      console.error("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "success" as const;
      case "PENDING":
      case "PREPARING":
        return "warning" as const;
      case "CANCELLED":
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
    <div className="min-h-screen bg-zinc-950">
      <Header title="Orders" subtitle="View and manage all customer orders" />

      <div className="p-8 space-y-6">
        {/* Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3 flex-1">
            <div className="max-w-xs flex-1">
              <Input
                placeholder="Search by order number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1 rounded-lg border border-zinc-800 p-1 bg-zinc-900/50">
              {statusFilters.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    statusFilter === status
                      ? "bg-gold/10 text-gold border border-gold/20"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Orders Table */}
          <div className={selectedOrder ? "lg:col-span-2" : "lg:col-span-3"}>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                          Order No
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                          Customer
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                          Items
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                          Payment
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                            Loading orders...
                          </td>
                        </tr>
                      ) : orders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                            No orders found.
                          </td>
                        </tr>
                      ) : (
                        orders.map((order) => (
                          <tr
                            key={order.id}
                            onClick={() => setSelectedOrder(order)}
                            className={`cursor-pointer transition-colors ${
                              selectedOrder?.id === order.id
                                ? "bg-gold/5 border-l-2 border-l-gold"
                                : "hover:bg-zinc-800/30"
                            }`}
                          >
                            <td className="px-6 py-4 font-mono text-xs font-medium text-gold">
                              {order.orderNo}
                            </td>
                            <td className="px-6 py-4 text-zinc-400">
                              {formatDate(order.createdAt)}
                            </td>
                            <td className="px-6 py-4 text-zinc-100">
                              {order.customerName || "Walk-in"}
                            </td>
                            <td className="px-6 py-4 text-zinc-400">
                              {order.itemsCount}
                            </td>
                            <td className="px-6 py-4 text-zinc-100 font-medium">
                              {formatCurrency(order.total)}
                            </td>
                            <td className="px-6 py-4">
                              <Badge variant="secondary">
                                {order.paymentMethod}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <Badge variant={getStatusVariant(order.status)}>
                                {order.status}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Details Panel */}
          {selectedOrder && (
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Order Details</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedOrder(null)}
                    >
                      Close
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Order No</span>
                      <span className="font-mono text-xs text-gold">
                        {selectedOrder.orderNo}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Date</span>
                      <span className="text-zinc-100">
                        {formatDate(selectedOrder.createdAt)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Customer</span>
                      <span className="text-zinc-100">
                        {selectedOrder.customerName || "Walk-in"}
                      </span>
                    </div>
                    {selectedOrder.customerPhone && (
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Phone</span>
                        <span className="text-zinc-100">
                          {selectedOrder.customerPhone}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Served by</span>
                      <span className="text-zinc-100">
                        {selectedOrder.user.name}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-zinc-800 pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Subtotal</span>
                      <span className="text-zinc-100">
                        {formatCurrency(selectedOrder.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Tax</span>
                      <span className="text-zinc-100">
                        {formatCurrency(selectedOrder.taxAmount)}
                      </span>
                    </div>
                    {selectedOrder.discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Discount</span>
                        <span className="text-red-400">
                          -{formatCurrency(selectedOrder.discount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold border-t border-zinc-800 pt-2">
                      <span className="text-zinc-100">Total</span>
                      <span className="text-gold">
                        {formatCurrency(selectedOrder.total)}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-zinc-800 pt-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Payment</span>
                      <Badge variant="secondary">
                        {selectedOrder.paymentMethod}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Status</span>
                      <Badge variant={getStatusVariant(selectedOrder.status)}>
                        {selectedOrder.status}
                      </Badge>
                    </div>
                  </div>

                  {selectedOrder.notes && (
                    <div className="border-t border-zinc-800 pt-3">
                      <p className="text-xs text-zinc-400">Notes</p>
                      <p className="mt-1 text-sm text-zinc-300">
                        {selectedOrder.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
