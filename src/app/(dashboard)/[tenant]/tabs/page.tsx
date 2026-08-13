"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";
import {
  ArrowLeft, Clock, Users, X, Banknote, Smartphone, CreditCard,
  Plus, ShoppingCart, Wifi, Receipt, CheckCircle,
} from "lucide-react";

interface Tab {
  id: string;
  orderNo: string;
  tabName: string;
  total: number;
  subtotal: number;
  taxAmount: number;
  customerName: string | null;
  items: { id: string; quantity: number; unitPrice: number; total: number; product: { name: string; sku: string } }[];
  user: { name: string };
  createdAt: string;
}

export default function TabsPage() {
  const params = useParams();
  const router = useRouter();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<Tab | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadTabs = async () => {
    try {
      const res = await fetch("/api/orders/tabs");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setTabs(data);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { loadTabs(); }, []);

  const handleCloseTab = async (tab: Tab) => {
    setProcessing(true);
    try {
      const res = await fetch("/api/orders/tabs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: tab.id, action: "close", paymentMethod }),
      });
      if (res.ok) {
        loadTabs();
        setSelectedTab(null);
        notify("success", `"${tab.tabName}" settled successfully`);
      }
    } catch {
      notify("error", "Network error");
    } finally {
      setProcessing(false);
    }
  };

  const totalValue = tabs.reduce((s, t) => s + t.total, 0);

  return (
    <div className="min-h-screen bg-surface relative">
      {/* Notification */}
      {notification && (
        <div className={cn(
          "fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm",
          notification.type === "success" && "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
          notification.type === "error" && "bg-red-500/10 border-red-500/30 text-red-400",
        )}>
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <div className="p-4 sm:p-6 lg:p-8 pt-14 lg:pt-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Open Tabs</h1>
              <p className="text-sm text-text-muted">Manage running tabs and settle payments</p>
            </div>
          </div>
          <Button onClick={() => router.push(`/${params.tenant}/pos`)} className="gap-2">
            <Plus className="h-4 w-4" /> New Tab
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{tabs.length}</p>
                <p className="text-xs text-text-muted">Open Tabs</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gold/10 flex items-center justify-center">
                <Receipt className="h-6 w-6 text-gold" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gold">{formatCurrency(totalValue)}</p>
                <p className="text-xs text-text-muted">Outstanding</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{tabs.reduce((s, t) => s + t.items.length, 0)}</p>
                <p className="text-xs text-text-muted">Total Items</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-40 text-text-muted">Loading...</div>
        ) : tabs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-text-muted">
              <div className="h-20 w-20 rounded-full bg-surface-elevated flex items-center justify-center mb-4">
                <ShoppingCart className="h-10 w-10 opacity-30" />
              </div>
              <p className="text-lg font-medium text-text-primary mb-1">No open tabs</p>
              <p className="text-sm mb-6">Start a new tab from the Point of Sale</p>
              <Button onClick={() => router.push(`/${params.tenant}/pos`)}>Go to POS</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {tabs.map((tab) => (
              <Card key={tab.id} className={cn("cursor-pointer transition-all hover:shadow-lg", selectedTab?.id === tab.id && "ring-2 ring-gold/50")}>
                <CardContent className="p-0" onClick={() => setSelectedTab(tab)}>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-text-primary">{tab.tabName}</h3>
                        {tab.customerName && <p className="text-xs text-text-secondary">{tab.customerName}</p>}
                      </div>
                      <Badge variant="warning" className="gap-1">
                        <Clock className="h-3 w-3" /> Open
                      </Badge>
                    </div>

                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-bold text-gold">{formatCurrency(tab.total)}</p>
                        <p className="text-xs text-text-muted mt-0.5">{tab.items.length} items · {tab.user?.name}</p>
                      </div>
                      <p className="text-xs text-text-muted">
                        {new Date(tab.createdAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border px-5 py-3 bg-surface-elevated/30">
                    <div className="space-y-1">
                      {tab.items.slice(0, 4).map((item) => (
                        <div key={item.id} className="flex justify-between text-xs">
                          <span className="text-text-secondary truncate">{item.quantity}x {item.product.name}</span>
                          <span className="text-text-muted shrink-0 ml-2">{formatCurrency(item.total)}</span>
                        </div>
                      ))}
                      {tab.items.length > 4 && (
                        <p className="text-[10px] text-text-muted">+{tab.items.length - 4} more items</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Settle Modal */}
      {selectedTab && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTab(null)} />
          <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-text-primary">{selectedTab.tabName}</h2>
                <p className="text-xs text-text-muted">Tab #{selectedTab.orderNo}</p>
              </div>
              <button onClick={() => setSelectedTab(null)} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 max-h-[50vh] overflow-y-auto space-y-4">
              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {selectedTab.items.map((item) => (
                  <div key={item.id} className="flex justify-between px-4 py-2.5">
                    <div>
                      <p className="text-sm text-text-primary">{item.product.name}</p>
                      <p className="text-[10px] text-text-muted">{item.quantity} x {formatCurrency(item.unitPrice)}</p>
                    </div>
                    <p className="text-sm font-medium text-text-primary">{formatCurrency(item.total)}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Subtotal</span>
                  <span className="text-text-primary">{formatCurrency(selectedTab.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Tax</span>
                  <span className="text-text-primary">{formatCurrency(selectedTab.taxAmount)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="font-semibold text-text-primary">Total</span>
                  <span className="text-xl font-bold text-gold">{formatCurrency(selectedTab.total)}</span>
                </div>
              </div>

              {/* Payment method */}
              <div>
                <p className="text-xs font-medium text-text-secondary mb-2">Payment Method</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "CASH", icon: Banknote, label: "Cash" },
                    { id: "MPESA", icon: Smartphone, label: "M-Pesa" },
                    { id: "CARD", icon: CreditCard, label: "Card" },
                    { id: "PDQ", icon: Wifi, label: "PDQ" },
                  ].map((m) => (
                    <button key={m.id} onClick={() => setPaymentMethod(m.id)} className={cn("flex flex-col items-center gap-1 rounded-lg border p-3 transition-all", paymentMethod === m.id ? "border-gold/50 bg-gold/10 text-gold" : "border-border text-text-secondary hover:border-text-muted")}>
                      <m.icon className="h-5 w-5" />
                      <span className="text-[10px] font-medium">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-border p-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => router.push(`/${params.tenant}/pos`)}>
                <Plus className="h-4 w-4 mr-2" /> Add Items
              </Button>
              <Button className="flex-1" disabled={processing} onClick={() => handleCloseTab(selectedTab)}>
                {processing ? "Processing..." : "Settle Tab"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
