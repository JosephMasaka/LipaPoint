"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Search, Grid3X3, List, Minus, Plus, Trash2,
  CreditCard, Banknote, Smartphone, Package, ShoppingCart, ChevronUp,
  Clock, Users, X, ScanBarcode, Printer, CheckCircle, Wifi,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  price: number;
  image: string | null;
  category: { id: string; name: string; color: string } | null;
  unit: { abbreviation: string } | null;
  stocks: { quantity: number }[];
}

interface Category {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
}

interface Tab {
  id: string;
  orderNo: string;
  tabName: string;
  total: number;
  subtotal: number;
  items: { id: string; quantity: number; unitPrice: number; product: { name: string } }[];
  createdAt: string;
}

interface CompletedOrder {
  id: string;
  orderNo: string;
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
  paymentMethod: string;
  items: { quantity: number; unitPrice: number; total: number; product: { name: string; sku: string } }[];
  user: { name: string };
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [processing, setProcessing] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [taxRate, setTaxRate] = useState(16);
  const [scannerActive, setScannerActive] = useState(true);
  const [tenantName, setTenantName] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("Thank you for shopping with us!");

  // Tab management
  const [mode, setMode] = useState<"sale" | "tabs">("sale");
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [showNewTab, setShowNewTab] = useState(false);
  const [tabName, setTabName] = useState("");
  const [tabCustomer, setTabCustomer] = useState("");

  // Receipt & success state
  const [completedOrder, setCompletedOrder] = useState<CompletedOrder | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Notification
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Barcode scanner buffer
  const barcodeBuffer = useRef("");
  const barcodeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { items, addItem, removeItem, updateQuantity, clearCart, getSubtotal, getTax, getTotal } = useCartStore();

  const notify = (type: "success" | "error" | "info", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Barcode scanner handler
  const handleBarcodeInput = useCallback((e: KeyboardEvent) => {
    if (!scannerActive) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

    if (e.key === "Enter" && barcodeBuffer.current.length > 3) {
      const barcode = barcodeBuffer.current.trim();
      barcodeBuffer.current = "";
      const product = products.find(p => p.barcode === barcode || p.sku === barcode);
      if (product) {
        addItem({ id: product.id, name: product.name, price: product.price, sku: product.sku });
        notify("success", `Added: ${product.name}`);
      } else {
        notify("error", `Product not found: ${barcode}`);
      }
    } else if (e.key === "Enter") {
      barcodeBuffer.current = "";
    } else if (e.key.length === 1) {
      barcodeBuffer.current += e.key;
      if (barcodeTimeout.current) clearTimeout(barcodeTimeout.current);
      barcodeTimeout.current = setTimeout(() => { barcodeBuffer.current = ""; }, 100);
    }
  }, [scannerActive, products, addItem]);

  useEffect(() => {
    document.addEventListener("keydown", handleBarcodeInput);
    return () => document.removeEventListener("keydown", handleBarcodeInput);
  }, [handleBarcodeInput]);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(data => {
      if (data.user?.tenant) {
        setTaxRate(data.user.tenant.taxRate ?? 16);
        setTenantName(data.user.tenant.name);
      }
    }).catch(() => {});
    fetch("/api/settings").then(r => r.json()).then(data => {
      if (data?.receiptFooter) setReceiptFooter(data.receiptFooter);
    }).catch(() => {});
    fetch("/api/products").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setProducts(data);
    }).catch(() => {});
    fetch("/api/products?categories=true").then(r => r.json()).then(data => {
      if (data.categories) setCategories(data.categories);
    }).catch(() => {});
    loadTabs();
  }, []);

  const loadTabs = () => {
    fetch("/api/orders/tabs").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setTabs(data);
    }).catch(() => {});
  };

  const filtered = products.filter((p) => {
    const matchesCat = activeCategory === "all" || p.category?.id === activeCategory;
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(i => ({ productId: i.id, quantity: i.quantity, unitPrice: i.price })),
          paymentMethod,
          subtotal: getSubtotal(),
          taxAmount: getTax(taxRate),
          total: getTotal(taxRate),
        }),
      });
      if (res.ok) {
        const order = await res.json();
        setCompletedOrder(order);
        setShowSuccess(true);
        clearCart();
        setCartOpen(false);
      } else {
        const data = await res.json();
        notify("error", data.error || "Failed to process sale");
      }
    } catch {
      notify("error", "Network error. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenTab = async () => {
    if (items.length === 0 || !tabName.trim()) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/orders/tabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tabName: tabName.trim(),
          customerName: tabCustomer.trim() || null,
          items: items.map(i => ({ productId: i.id, quantity: i.quantity })),
        }),
      });
      if (res.ok) {
        clearCart();
        setCartOpen(false);
        setShowNewTab(false);
        setTabName("");
        setTabCustomer("");
        loadTabs();
        notify("success", `Tab "${tabName}" opened`);
      } else {
        const data = await res.json();
        notify("error", data.error || "Failed to open tab");
      }
    } catch {
      notify("error", "Network error");
    } finally {
      setProcessing(false);
    }
  };

  const handleAddToTab = async (tab: Tab) => {
    if (items.length === 0) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/orders/tabs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: tab.id,
          action: "add",
          items: items.map(i => ({ productId: i.id, quantity: i.quantity })),
        }),
      });
      if (res.ok) {
        clearCart();
        loadTabs();
        setActiveTab(null);
        notify("success", `Added to "${tab.tabName}"`);
      }
    } catch {
      notify("error", "Network error");
    } finally {
      setProcessing(false);
    }
  };

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
        setMode("sale");
        notify("success", `Tab "${tab.tabName}" settled`);
      }
    } catch {
      notify("error", "Network error");
    } finally {
      setProcessing(false);
    }
  };

  const handlePrintReceipt = () => {
    if (!completedOrder) return;
    const receipt = document.getElementById("receipt-content");
    if (!receipt) return;
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
        .item-name { max-width: 160px; }
        @media print { body { margin: 0; padding: 5px; } }
      </style></head><body>
      ${receipt.innerHTML}
      <script>window.print(); window.close();</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const parentCategories = categories.filter(c => !c.parentId);

  return (
    <div className="flex flex-col lg:flex-row h-screen relative overflow-hidden">
      {/* Notification Toast */}
      {notification && (
        <div className={cn(
          "fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm animate-in slide-in-from-top-2 fade-in duration-300",
          notification.type === "success" && "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
          notification.type === "error" && "bg-red-500/10 border-red-500/30 text-red-400",
          notification.type === "info" && "bg-blue-500/10 border-blue-500/30 text-blue-400",
        )}>
          {notification.type === "success" && <CheckCircle className="h-4 w-4 shrink-0" />}
          {notification.type === "error" && <X className="h-4 w-4 shrink-0" />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Sale Success Modal */}
      {showSuccess && completedOrder && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSuccess(false)} />
          <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            {/* Success header */}
            <div className="bg-emerald-500/10 border-b border-emerald-500/20 p-6 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-text-primary">Sale Complete</h2>
              <p className="text-sm text-text-secondary mt-1">Order #{completedOrder.orderNo}</p>
            </div>

            {/* Receipt Preview */}
            <div className="p-6 max-h-[50vh] overflow-y-auto">
              <div id="receipt-content" className="font-mono text-xs space-y-1">
                <div className="center bold">{tenantName}</div>
                <div className="divider"></div>
                <div className="row"><span>Order:</span><span>{completedOrder.orderNo}</span></div>
                <div className="row"><span>Date:</span><span>{new Date().toLocaleDateString("en-KE")}</span></div>
                <div className="row"><span>Served by:</span><span>{completedOrder.user?.name}</span></div>
                <div className="row"><span>Payment:</span><span>{completedOrder.paymentMethod}</span></div>
                <div className="divider"></div>
                {completedOrder.items.map((item, i) => (
                  <div key={i}>
                    <div className="item-name">{item.product.name}</div>
                    <div className="row"><span>{item.quantity} x {formatCurrency(item.unitPrice)}</span><span>{formatCurrency(item.total)}</span></div>
                  </div>
                ))}
                <div className="divider"></div>
                <div className="row"><span>Subtotal</span><span>{formatCurrency(completedOrder.subtotal)}</span></div>
                <div className="row"><span>VAT ({taxRate}%)</span><span>{formatCurrency(completedOrder.taxAmount)}</span></div>
                {completedOrder.discount > 0 && <div className="row"><span>Discount</span><span>-{formatCurrency(completedOrder.discount)}</span></div>}
                <div className="divider"></div>
                <div className="row bold"><span>TOTAL</span><span>{formatCurrency(completedOrder.total)}</span></div>
                <div className="divider"></div>
                <div className="center">{receiptFooter}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-border p-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handlePrintReceipt}>
                <Printer className="h-4 w-4 mr-2" /> Print Receipt
              </Button>
              <Button className="flex-1" onClick={() => setShowSuccess(false)}>
                New Sale
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Products Panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Search Bar + Mode Toggle */}
        <div className="flex items-center gap-2 border-b border-border p-3 bg-surface pt-12 lg:pt-3 shrink-0">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
            <button
              onClick={() => setMode("sale")}
              className={cn("px-2.5 py-2 text-xs font-medium transition-colors", mode === "sale" ? "bg-gold/10 text-gold" : "text-text-secondary")}
            >
              Sale
            </button>
            <button
              onClick={() => { setMode("tabs"); loadTabs(); }}
              className={cn("px-2.5 py-2 text-xs font-medium transition-colors flex items-center gap-1", mode === "tabs" ? "bg-gold/10 text-gold" : "text-text-secondary")}
            >
              <Clock className="h-3 w-3" />
              Tabs{tabs.length > 0 && <Badge variant="warning" className="text-[9px] px-1 ml-0.5">{tabs.length}</Badge>}
            </button>
          </div>
          <button
            onClick={() => setScannerActive(!scannerActive)}
            className={cn("p-2 rounded-lg border transition-colors shrink-0", scannerActive ? "bg-gold/10 text-gold border-gold/30" : "border-border text-text-secondary")}
            title={scannerActive ? "Scanner active" : "Enable barcode scanner"}
          >
            <ScanBarcode className="h-4 w-4" />
          </button>
          <div className="hidden md:flex rounded-lg border border-border overflow-hidden shrink-0">
            <button onClick={() => setViewMode("grid")} className={cn("p-2", viewMode === "grid" && "bg-surface-hover text-gold")}>
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode("list")} className={cn("p-2", viewMode === "list" && "bg-surface-hover text-gold")}>
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {mode === "sale" ? (
          <>
            {/* Categories - horizontal scroll, no x-overflow leak */}
            <div className="flex gap-2 border-b border-border bg-surface px-3 py-2 overflow-x-auto scrollbar-none shrink-0">
              <button
                onClick={() => setActiveCategory("all")}
                className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all shrink-0", activeCategory === "all" ? "bg-surface-hover text-text-primary border border-border" : "text-text-muted hover:text-text-secondary")}
              >
                All Items
              </button>
              {parentCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all shrink-0", activeCategory === cat.id ? "bg-surface-hover text-text-primary border border-border" : "text-text-muted hover:text-text-secondary")}
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Product Grid - contained, no x overflow */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 pb-16 lg:pb-3">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-text-muted">
                  <Package className="h-12 w-12 mb-3 opacity-50" />
                  <p className="text-sm">No products found</p>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                  {filtered.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => addItem({ id: product.id, name: product.name, price: product.price, sku: product.sku })}
                      className="relative flex flex-col items-center rounded-lg border border-border bg-surface-elevated p-2 sm:p-3 hover:border-gold/30 hover:shadow-lg transition-all group"
                    >
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg object-cover mb-1.5" />
                      ) : (
                        <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-surface-hover group-hover:bg-gold/10 transition-colors mb-1.5">
                          <Package className="h-4 w-4 sm:h-5 sm:w-5 text-text-muted group-hover:text-gold" />
                        </div>
                      )}
                      <p className="text-[10px] sm:text-xs font-medium text-text-primary text-center line-clamp-2 leading-tight">{product.name}</p>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <p className="text-xs sm:text-sm font-bold text-gold">{formatCurrency(product.price)}</p>
                        {product.unit && <span className="text-[8px] text-text-muted">/{product.unit.abbreviation}</span>}
                      </div>
                      {product.stocks[0] && product.stocks[0].quantity < 10 && (
                        <Badge variant="destructive" className="absolute top-1 right-1 text-[8px] px-1 py-0">Low</Badge>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filtered.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => addItem({ id: product.id, name: product.name, price: product.price, sku: product.sku })}
                      className="w-full flex items-center justify-between rounded-lg border border-border bg-surface-elevated p-2.5 hover:border-gold/30 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Package className="h-4 w-4 text-text-muted shrink-0" />
                        <div className="text-left min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{product.name}</p>
                          <p className="text-xs text-text-muted">{product.sku}{product.unit ? ` · ${product.unit.abbreviation}` : ""}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-gold shrink-0 ml-2">{formatCurrency(product.price)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Open Tabs View */
          <div className="flex-1 overflow-y-auto p-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Open Tabs ({tabs.length})</h2>
            </div>
            {tabs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-text-muted">
                <Users className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">No open tabs</p>
                <p className="text-xs mt-1">Add items and open a tab from the cart</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <p className="text-lg font-bold text-gold">{formatCurrency(tab.total)}</p>
                    <p className="text-xs text-text-muted mt-1">
                      {tab.items.length} items · {new Date(tab.createdAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {activeTab && (
              <div className="mt-4 rounded-xl border border-border bg-surface-elevated p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-text-primary">{activeTab.tabName}</h3>
                  <button onClick={() => setActiveTab(null)} className="p-1 text-text-muted hover:text-text-primary"><X className="h-4 w-4" /></button>
                </div>
                <div className="divide-y divide-border mb-3">
                  {activeTab.items.map((item) => (
                    <div key={item.id} className="flex justify-between py-1.5 text-sm">
                      <span className="text-text-primary">{item.quantity}x {item.product.name}</span>
                      <span className="text-text-secondary">{formatCurrency(item.unitPrice * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-2 flex justify-between mb-3">
                  <span className="font-semibold text-text-primary">Total</span>
                  <span className="font-bold text-gold">{formatCurrency(activeTab.total)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { id: "CASH", icon: Banknote, label: "Cash" },
                    { id: "MPESA", icon: Smartphone, label: "M-Pesa" },
                    { id: "CARD", icon: CreditCard, label: "Card" },
                  ].map((m) => (
                    <button key={m.id} onClick={() => setPaymentMethod(m.id)} className={cn("flex flex-col items-center gap-1 rounded-lg border p-2 transition-all", paymentMethod === m.id ? "border-gold/50 bg-gold/10 text-gold" : "border-border text-text-secondary")}>
                      <m.icon className="h-4 w-4" /><span className="text-[10px] font-medium">{m.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setMode("sale")}>
                    <Plus className="h-4 w-4 mr-1" /> Add Items
                  </Button>
                  <Button className="flex-1" disabled={processing} onClick={() => handleCloseTab(activeTab)}>
                    {processing ? "Processing..." : "Settle Tab"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Cart Toggle */}
      {mode === "sale" && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between bg-gold text-black px-5 py-3.5 shadow-[0_-4px_20px_rgba(212,175,55,0.3)]"
        >
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            <span className="text-sm font-bold">
              {items.length === 0 ? "Cart" : `${items.length} item${items.length > 1 ? "s" : ""}`}
            </span>
          </div>
          {items.length > 0 && (
            <span className="text-base font-bold">{formatCurrency(getTotal(taxRate))}</span>
          )}
          {items.length === 0 && (
            <ChevronUp className="h-5 w-5" />
          )}
        </button>
      )}

      {cartOpen && <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setCartOpen(false)} />}

      {/* Cart Panel */}
      {mode === "sale" && (
        <div className={cn(
          "fixed lg:relative z-50 lg:z-auto bg-surface border-l border-border flex flex-col transition-transform duration-300",
          "bottom-0 left-0 right-0 lg:bottom-auto lg:left-auto lg:right-auto lg:top-0",
          "h-[90vh] lg:h-screen w-full lg:w-80 xl:w-96 rounded-t-2xl lg:rounded-none shadow-[0_-8px_30px_rgba(0,0,0,0.3)] lg:shadow-none",
          cartOpen ? "translate-y-0" : "translate-y-full lg:translate-y-0"
        )}>
          {/* Mobile drag handle */}
          <div className="lg:hidden flex justify-center py-2 shrink-0" onClick={() => setCartOpen(false)}>
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>

          <div className="flex items-center justify-between border-b border-border px-4 py-2 lg:py-3 shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold text-text-primary">
                {activeTab ? `Add to: ${activeTab.tabName}` : "Current Sale"}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {items.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCart} className="text-red-400 hover:text-red-300 text-xs h-7 px-2">
                  Clear
                </Button>
              )}
              <button onClick={() => setCartOpen(false)} className="lg:hidden p-1.5 rounded-lg bg-surface-hover text-text-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <ShoppingCart className="h-10 w-10 opacity-30 mb-2" />
                <p className="text-sm">No items yet</p>
                <p className="text-xs mt-0.5">Tap products or scan barcodes</p>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-elevated p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">{item.name}</p>
                    <p className="text-[10px] text-text-muted">{formatCurrency(item.price)} ea</p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="h-6 w-6 rounded bg-surface-hover flex items-center justify-center">
                      <Minus className="h-3 w-3 text-text-secondary" />
                    </button>
                    <span className="w-6 text-center text-xs font-semibold text-text-primary">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="h-6 w-6 rounded bg-surface-hover flex items-center justify-center">
                      <Plus className="h-3 w-3 text-text-secondary" />
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-text-primary w-16 text-right">{formatCurrency(item.price * item.quantity)}</p>
                  <button onClick={() => removeItem(item.id)} className="h-6 w-6 rounded flex items-center justify-center hover:bg-red-500/10">
                    <Trash2 className="h-3 w-3 text-text-muted hover:text-red-400" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Totals & Actions */}
          <div className="border-t border-border p-4 space-y-3 bg-surface-elevated shrink-0">
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Subtotal</span>
                <span className="text-text-primary">{formatCurrency(getSubtotal())}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">VAT ({taxRate}%)</span>
                <span className="text-text-primary">{formatCurrency(getTax(taxRate))}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-sm font-semibold text-text-primary">Total</span>
                <span className="text-lg font-bold text-gold">{formatCurrency(getTotal(taxRate))}</span>
              </div>
            </div>

            {showNewTab ? (
              <div className="space-y-2 p-3 rounded-lg border border-gold/20 bg-gold/5">
                <Input placeholder="Tab name (e.g. Table 5)" value={tabName} onChange={(e) => setTabName(e.target.value)} />
                <Input placeholder="Customer (optional)" value={tabCustomer} onChange={(e) => setTabCustomer(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleOpenTab} disabled={!tabName.trim() || items.length === 0 || processing} className="flex-1">
                    {processing ? "Opening..." : "Open Tab"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewTab(false)}>Cancel</Button>
                </div>
              </div>
            ) : activeTab ? (
              <Button size="lg" className="w-full" disabled={items.length === 0 || processing} onClick={() => handleAddToTab(activeTab)}>
                {processing ? "Adding..." : `Add to "${activeTab.tabName}"`}
              </Button>
            ) : (
              <>
                {/* Payment methods */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: "CASH", icon: Banknote, label: "Cash" },
                    { id: "MPESA", icon: Smartphone, label: "M-Pesa" },
                    { id: "CARD", icon: CreditCard, label: "Card" },
                    { id: "PDQ", icon: Wifi, label: "PDQ" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id)}
                      className={cn("flex flex-col items-center gap-0.5 rounded-lg border p-2 transition-all", paymentMethod === m.id ? "border-gold/50 bg-gold/10 text-gold" : "border-border text-text-secondary")}
                    >
                      <m.icon className="h-3.5 w-3.5" />
                      <span className="text-[9px] font-medium">{m.label}</span>
                    </button>
                  ))}
                </div>

                <Button size="lg" className="w-full" disabled={items.length === 0 || processing} onClick={handleCheckout}>
                  {processing ? "Processing..." : `Complete Sale · ${formatCurrency(getTotal(taxRate))}`}
                </Button>

                <Button size="sm" variant="outline" className="w-full" disabled={items.length === 0} onClick={() => setShowNewTab(true)}>
                  <Clock className="h-3.5 w-3.5 mr-1" /> Open as Tab
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
