"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Search, Eye, Printer, XCircle, CheckCircle, Clock,
  Receipt, Package, User, CreditCard, X, Mail, Loader2,
} from "lucide-react";

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  total: number;
  product: { name: string; sku: string };
}

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
  tabName: string | null;
  items: OrderItem[];
  user: { name: string };
  createdAt: string;
}

const statusFilters = ["ALL", "COMPLETED", "PENDING", "TAB", "CANCELLED", "REFUNDED"];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [tenantName, setTenantName] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("Thank you for shopping with us!");
  const [mpesaPaybill, setMpesaPaybill] = useState("");
  const [mpesaTill, setMpesaTill] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.user?.tenant?.name) setTenantName(d.user.tenant.name);
    }).catch(() => {});
    fetch("/api/settings").then(r => r.json()).then(d => {
      if (d?.receiptFooter) setReceiptFooter(d.receiptFooter);
      if (d?.mpesaPaybill) setMpesaPaybill(d.mpesaPaybill);
      if (d?.mpesaTill) setMpesaTill(d.mpesaTill);
    }).catch(() => {});
  }, []);

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/orders?${params.toString()}`);
      if (res.ok) setOrders(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, [search, statusFilter]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "COMPLETED": return { variant: "success" as const, icon: CheckCircle, color: "text-emerald-400" };
      case "PENDING": case "PREPARING": return { variant: "warning" as const, icon: Clock, color: "text-amber-400" };
      case "TAB": return { variant: "warning" as const, icon: Clock, color: "text-blue-400" };
      case "CANCELLED": case "REFUNDED": return { variant: "destructive" as const, icon: XCircle, color: "text-red-400" };
      default: return { variant: "secondary" as const, icon: Clock, color: "text-text-muted" };
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const handlePrint = (order: Order) => {
    const printWindow = window.open("", "_blank", "width=300,height=600");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Receipt</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; padding: 10px; max-width: 280px; margin: 0 auto; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin: 2px 0; }
        @media print { body { margin: 0; padding: 5px; } }
      </style></head><body>
      <div class="center bold">${tenantName}</div>
      <div class="divider"></div>
      <div class="row"><span>Order:</span><span>${order.orderNo}</span></div>
      <div class="row"><span>Date:</span><span>${formatDate(order.createdAt)}</span></div>
      <div class="row"><span>Served by:</span><span>${order.user.name}</span></div>
      <div class="row"><span>Payment:</span><span>${order.paymentMethod}</span></div>
      ${order.customerName ? `<div class="row"><span>Customer:</span><span>${order.customerName}</span></div>` : ""}
      <div class="divider"></div>
      ${order.items.map(i => `<div>${i.product.name}</div><div class="row"><span>${i.quantity} x KSh ${i.unitPrice.toLocaleString()}</span><span>KSh ${i.total.toLocaleString()}</span></div>`).join("")}
      <div class="divider"></div>
      <div class="row"><span>Subtotal</span><span>KSh ${order.subtotal.toLocaleString()}</span></div>
      <div class="row"><span>Tax</span><span>KSh ${order.taxAmount.toLocaleString()}</span></div>
      ${order.discount > 0 ? `<div class="row"><span>Discount</span><span>-KSh ${order.discount.toLocaleString()}</span></div>` : ""}
      <div class="divider"></div>
      <div class="row bold"><span>TOTAL</span><span>KSh ${order.total.toLocaleString()}</span></div>
      <div class="divider"></div>
      ${mpesaPaybill ? `<div class="center">Paybill: ${mpesaPaybill}</div>` : ""}
      ${mpesaTill ? `<div class="center">Till No: ${mpesaTill}</div>` : ""}
      ${(mpesaPaybill || mpesaTill) ? `<div class="divider"></div>` : ""}
      <div class="center">${receiptFooter}</div>
      <div class="divider"></div>
      <div class="center" style="font-size:9px;margin-top:4px;color:#888">Powered by LipaPoint POS</div>
      <div class="center" style="font-size:9px;color:#888">Dev: Joseph Masaka | 0791298382</div>
      <script>window.print(); window.close();</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const handleEmailReceipt = async (order: Order) => {
    const email = prompt("Enter customer email to send receipt:");
    if (!email) return;
    setEmailSending(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setEmailSent(order.id);
      } else {
        const d = await res.json();
        alert(d.error || "Failed to send email");
      }
    } catch { alert("Failed to send email"); }
    finally { setEmailSending(false); }
  };

  const totalRevenue = orders.filter(o => o.status === "COMPLETED").reduce((s, o) => s + o.total, 0);
  const completedCount = orders.filter(o => o.status === "COMPLETED").length;

  return (
    <div className="min-h-screen bg-surface overflow-x-hidden">
      <Header title="Orders" subtitle="Track and manage all orders" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <p className="text-xs text-text-muted">Total Orders</p>
            <p className="text-2xl font-bold text-text-primary">{orders.length}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-text-muted">Completed</p>
            <p className="text-2xl font-bold text-emerald-400">{completedCount}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-text-muted">Revenue</p>
            <p className="text-2xl font-bold text-gold">{formatCurrency(totalRevenue)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-text-muted">Open Tabs</p>
            <p className="text-2xl font-bold text-blue-400">{orders.filter(o => o.status === "TAB").length}</p>
          </CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-1 rounded-lg border border-border p-1 bg-surface-elevated overflow-x-auto scrollbar-none">
            {statusFilters.map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap", statusFilter === s ? "bg-gold/10 text-gold border border-gold/20" : "text-text-secondary hover:text-text-primary")}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-border bg-surface-elevated/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Order</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Payment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-12"><Loader label="Loading orders..." className="py-4" /></td></tr>
                  ) : orders.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-text-muted">No orders found.</td></tr>
                  ) : orders.map((order) => {
                    const status = getStatusConfig(order.status);
                    return (
                      <tr key={order.id} className="hover:bg-surface-hover/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-text-muted" />
                            <div>
                              <p className="font-mono text-xs font-medium text-gold">{order.orderNo}</p>
                              {order.tabName && <p className="text-[10px] text-text-muted">{order.tabName}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary">{formatDate(order.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-text-muted" />
                            <span className="text-xs text-text-primary">{order.customerName || "Walk-in"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-text-primary">{formatCurrency(order.total)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <CreditCard className="h-3 w-3 text-text-muted" />
                            <span className="text-xs text-text-secondary">{order.paymentMethod}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={status.variant} className="gap-1">
                            <status.icon className="h-3 w-3" />
                            {order.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setSelectedOrder(order)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-secondary hover:text-gold transition-colors" title="View details">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handlePrint(order)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-secondary hover:text-gold transition-colors" title="Print receipt">
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
          <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Order {selectedOrder.orderNo}</h2>
                <p className="text-xs text-text-muted">{formatDate(selectedOrder.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getStatusConfig(selectedOrder.status).variant}>{selectedOrder.status}</Badge>
                <button onClick={() => setSelectedOrder(null)} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              {/* Customer & Staff info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Customer</p>
                  <p className="text-sm font-medium text-text-primary">{selectedOrder.customerName || "Walk-in"}</p>
                  {selectedOrder.customerPhone && <p className="text-xs text-text-secondary">{selectedOrder.customerPhone}</p>}
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Served by</p>
                  <p className="text-sm font-medium text-text-primary">{selectedOrder.user.name}</p>
                  <p className="text-xs text-text-secondary">{selectedOrder.paymentMethod}</p>
                </div>
              </div>

              {/* Items */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="bg-surface-elevated/50 px-4 py-2 border-b border-border">
                  <p className="text-xs font-medium text-text-secondary uppercase">Items</p>
                </div>
                <div className="divide-y divide-border">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Package className="h-3.5 w-3.5 text-text-muted" />
                        <div>
                          <p className="text-sm text-text-primary">{item.product.name}</p>
                          <p className="text-[10px] text-text-muted">{item.quantity} x {formatCurrency(item.unitPrice)}</p>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-text-primary">{formatCurrency(item.total)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Subtotal</span>
                  <span className="text-text-primary">{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Tax</span>
                  <span className="text-text-primary">{formatCurrency(selectedOrder.taxAmount)}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Discount</span>
                    <span className="text-red-400">-{formatCurrency(selectedOrder.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="font-semibold text-text-primary">Total</span>
                  <span className="text-lg font-bold text-gold">{formatCurrency(selectedOrder.total)}</span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[10px] text-text-muted uppercase mb-1">Notes</p>
                  <p className="text-sm text-text-secondary">{selectedOrder.notes}</p>
                </div>
              )}
            </div>

            <div className="border-t border-border p-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => handlePrint(selectedOrder)}>
                <Printer className="h-4 w-4 mr-2" /> Print
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleEmailReceipt(selectedOrder)}
                disabled={emailSending}
              >
                {emailSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                {emailSent === selectedOrder.id ? "Sent!" : "Email"}
              </Button>
              <Button className="flex-1" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
