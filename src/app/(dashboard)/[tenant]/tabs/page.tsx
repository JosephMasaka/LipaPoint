"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Clock, Users, X, Banknote, Smartphone, CreditCard,
} from "lucide-react";

interface Tab {
  id: string;
  orderNo: string;
  tabName: string;
  total: number;
  subtotal: number;
  taxAmount: number;
  customerName: string | null;
  items: { id: string; quantity: number; unitPrice: number; total: number; product: { name: string } }[];
  createdAt: string;
}

export default function TabsPage() {
  const params = useParams();
  const router = useRouter();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [processing, setProcessing] = useState(false);

  const loadTabs = async () => {
    try {
      const res = await fetch("/api/orders/tabs");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setTabs(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTabs();
  }, []);

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
        setActiveTab(null);
        alert(`Tab "${tab.tabName}" settled!`);
      }
    } catch {
      alert("Network error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-14 lg:pt-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Open Tabs</h1>
          <p className="text-sm text-text-muted">Manage customer tabs and settle payments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className={activeTab ? "lg:col-span-2" : "lg:col-span-3"}>
          {loading ? (
            <div className="flex items-center justify-center h-64 text-text-muted">
              Loading tabs...
            </div>
          ) : tabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-text-muted">
              <Users className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">No open tabs</p>
              <p className="text-xs mt-1">Open tabs from the Point of Sale</p>
              <Button variant="outline" className="mt-4" onClick={() => router.push(`/${params.tenant}/pos`)}>
                Go to POS
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "text-left rounded-xl border p-4 transition-all",
                    activeTab?.id === tab.id ? "border-gold bg-gold/5" : "border-border bg-surface-elevated hover:border-gold/30"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-text-primary">{tab.tabName}</h3>
                    <Badge variant="warning">Open</Badge>
                  </div>
                  {tab.customerName && (
                    <p className="text-xs text-text-secondary mb-1">{tab.customerName}</p>
                  )}
                  <p className="text-lg font-bold text-gold">KSh {tab.total.toLocaleString()}</p>
                  <p className="text-xs text-text-muted mt-1">
                    {tab.items.length} items · Opened {new Date(tab.createdAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <div className="mt-2 space-y-0.5">
                    {tab.items.slice(0, 3).map((item) => (
                      <p key={item.id} className="text-xs text-text-secondary truncate">
                        {item.quantity}x {item.product.name}
                      </p>
                    ))}
                    {tab.items.length > 3 && (
                      <p className="text-xs text-text-muted">+{tab.items.length - 3} more</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {activeTab && (
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{activeTab.tabName}</CardTitle>
                  <button onClick={() => setActiveTab(null)} className="p-1 text-text-muted hover:text-text-primary">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-text-muted">Tab #{activeTab.orderNo}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="divide-y divide-border">
                  {activeTab.items.map((item) => (
                    <div key={item.id} className="flex justify-between py-2">
                      <span className="text-sm text-text-primary">{item.quantity}x {item.product.name}</span>
                      <span className="text-sm text-text-secondary">KSh {item.total.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Subtotal</span>
                    <span className="text-text-primary">KSh {activeTab.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Tax</span>
                    <span className="text-text-primary">KSh {activeTab.taxAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-border pt-2">
                    <span className="text-text-primary">Total</span>
                    <span className="text-gold text-lg">KSh {activeTab.total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "CASH", icon: Banknote, label: "Cash" },
                    { id: "MPESA", icon: Smartphone, label: "M-Pesa" },
                    { id: "CARD", icon: CreditCard, label: "Card" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id)}
                      className={cn("flex flex-col items-center gap-1 rounded-lg border p-2 transition-all", paymentMethod === m.id ? "border-gold/50 bg-gold/10 text-gold" : "border-border text-text-secondary")}
                    >
                      <m.icon className="h-4 w-4" />
                      <span className="text-[10px] font-medium">{m.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.push(`/${params.tenant}/pos`)}
                  >
                    Add Items
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={processing}
                    onClick={() => handleCloseTab(activeTab)}
                  >
                    {processing ? "Processing..." : "Settle Tab"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
