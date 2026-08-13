"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Search, Grid3X3, List, Minus, Plus, Trash2,
  CreditCard, Banknote, Smartphone, Package, ShoppingCart, ChevronUp,
  Clock, Users, X, ScanBarcode,
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
  const [scannerActive, setScannerActive] = useState(false);

  // Tab management
  const [mode, setMode] = useState<"sale" | "tabs">("sale");
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [showNewTab, setShowNewTab] = useState(false);
  const [tabName, setTabName] = useState("");
  const [tabCustomer, setTabCustomer] = useState("");

  // Barcode scanner buffer
  const barcodeBuffer = useRef("");
  const barcodeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { items, addItem, removeItem, updateQuantity, clearCart, getSubtotal, getTax, getTotal } = useCartStore();

  // Barcode scanner handler - scanners type rapidly then hit Enter
  const handleBarcodeInput = useCallback((e: KeyboardEvent) => {
    if (!scannerActive) return;
    // Ignore if focused on an input field
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

    if (e.key === "Enter" && barcodeBuffer.current.length > 3) {
      const barcode = barcodeBuffer.current.trim();
      barcodeBuffer.current = "";
      // Find product by barcode or SKU
      const product = products.find(p => p.barcode === barcode || p.sku === barcode);
      if (product) {
        addItem({ id: product.id, name: product.name, price: product.price, sku: product.sku });
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
      if (data.user?.tenant?.taxRate != null) {
        setTaxRate(data.user.tenant.taxRate);
      }
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
        clearCart();
        setCartOpen(false);
        alert("Sale completed!");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to process sale");
      }
    } catch {
      alert("Network error");
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
        alert("Tab opened!");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to open tab");
      }
    } catch {
      alert("Network error");
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
        alert(`Added to "${tab.tabName}"`);
      }
    } catch {
      alert("Network error");
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
        alert(`Tab "${tab.tabName}" settled!`);
      }
    } catch {
      alert("Network error");
    } finally {
      setProcessing(false);
    }
  };

  // Get parent categories (no parentId)
  const parentCategories = categories.filter(c => !c.parentId);

  return (
    <div className="flex flex-col lg:flex-row h-screen relative">
      {/* Products Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search Bar + Mode Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 border-b border-border p-3 sm:p-4 bg-surface pt-14 lg:pt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setMode("sale")}
              className={cn("px-3 py-2 text-xs font-medium transition-colors", mode === "sale" ? "bg-gold/10 text-gold" : "text-text-secondary")}
            >
              Sale
            </button>
            <button
              onClick={() => { setMode("tabs"); loadTabs(); }}
              className={cn("px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1", mode === "tabs" ? "bg-gold/10 text-gold" : "text-text-secondary")}
            >
              <Clock className="h-3 w-3" />
              Tabs{tabs.length > 0 && <Badge variant="warning" className="text-[9px] px-1">{tabs.length}</Badge>}
            </button>
          </div>
          <button
            onClick={() => setScannerActive(!scannerActive)}
            className={cn("p-2.5 rounded-lg border border-border transition-colors", scannerActive ? "bg-gold/10 text-gold border-gold/30" : "text-text-secondary")}
            title={scannerActive ? "Scanner active" : "Enable barcode scanner"}
          >
            <ScanBarcode className="h-4 w-4" />
          </button>
          <div className="hidden sm:flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setViewMode("grid")} className={cn("p-2.5", viewMode === "grid" && "bg-surface-hover text-gold")}>
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode("list")} className={cn("p-2.5", viewMode === "list" && "bg-surface-hover text-gold")}>
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {mode === "sale" ? (
          <>
            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto border-b border-border bg-surface px-3 sm:px-4 py-2 sm:py-3 scrollbar-none">
              <button
                onClick={() => setActiveCategory("all")}
                className={cn("whitespace-nowrap rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-all", activeCategory === "all" ? "bg-surface-hover text-text-primary border border-border" : "text-text-muted hover:text-text-secondary")}
              >
                All Items
              </button>
              {parentCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn("flex items-center gap-2 whitespace-nowrap rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-all", activeCategory === cat.id ? "bg-surface-hover text-text-primary border border-border" : "text-text-muted hover:text-text-secondary")}
                >
                  <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 pb-20 lg:pb-4">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-text-muted">
                  <Package className="h-12 w-12 mb-3 opacity-50" />
                  <p className="text-sm">No products found</p>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
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
                        <p className="text-xs sm:text-sm font-bold text-gold">KSh {product.price.toLocaleString()}</p>
                        {product.unit && <span className="text-[8px] text-text-muted">/{product.unit.abbreviation}</span>}
                      </div>
                      {product.stocks[0] && product.stocks[0].quantity < 10 && (
                        <Badge variant="destructive" className="absolute top-1 right-1 text-[8px] px-1 py-0">Low</Badge>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => addItem({ id: product.id, name: product.name, price: product.price, sku: product.sku })}
                      className="w-full flex items-center justify-between rounded-lg border border-border bg-surface-elevated p-3 hover:border-gold/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-text-muted" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-text-primary">{product.name}</p>
                          <p className="text-xs text-text-muted">{product.sku}{product.unit ? ` · ${product.unit.abbreviation}` : ""}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-gold">KSh {product.price.toLocaleString()}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Open Tabs View */
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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

            {/* Selected Tab Detail */}
            {activeTab && (
              <div className="mt-6 rounded-xl border border-border bg-surface-elevated p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">{activeTab.tabName}</h3>
                    <p className="text-xs text-text-muted">Tab #{activeTab.orderNo}</p>
                  </div>
                  <button onClick={() => setActiveTab(null)} className="p-1 text-text-muted hover:text-text-primary">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {activeTab.items.map((item) => (
                    <div key={item.id} className="flex justify-between py-2">
                      <span className="text-sm text-text-primary">{item.quantity}x {item.product.name}</span>
                      <span className="text-sm text-text-secondary">KSh {(item.unitPrice * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border mt-3 pt-3 flex justify-between">
                  <span className="font-semibold text-text-primary">Total</span>
                  <span className="font-bold text-gold text-lg">KSh {activeTab.total.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4">
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
                <div className="flex gap-2 mt-4">
                  <Button onClick={() => { setMode("sale"); }} variant="outline" className="flex-1">
                    <Plus className="h-4 w-4 mr-1" /> Add Items
                  </Button>
                  <Button
                    onClick={() => handleCloseTab(activeTab)}
                    disabled={processing}
                    className="flex-1"
                  >
                    {processing ? "Processing..." : "Settle Tab"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Cart Toggle */}
      {mode === "sale" && (
        <button
          onClick={() => setCartOpen(!cartOpen)}
          className="lg:hidden fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-gold text-black px-4 py-3 shadow-lg shadow-gold/30"
        >
          <ShoppingCart className="h-5 w-5" />
          {items.length > 0 && (
            <span className="text-sm font-bold">{items.length} - KSh {getTotal(taxRate).toLocaleString()}</span>
          )}
          <ChevronUp className={cn("h-4 w-4 transition-transform", cartOpen && "rotate-180")} />
        </button>
      )}

      {/* Mobile cart overlay */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setCartOpen(false)} />
      )}

      {/* Cart Panel */}
      {mode === "sale" && (
        <div className={cn(
          "fixed lg:relative z-50 lg:z-auto bg-surface border-l border-border flex flex-col transition-transform duration-300",
          "bottom-0 left-0 right-0 lg:bottom-auto lg:left-auto lg:right-auto lg:top-0",
          "h-[85vh] lg:h-screen w-full lg:w-96 rounded-t-2xl lg:rounded-none",
          cartOpen ? "translate-y-0" : "translate-y-full lg:translate-y-0"
        )}>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold text-text-primary">
                {activeTab ? `Add to: ${activeTab.tabName}` : "Current Sale"}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {items.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCart} className="text-red-400 hover:text-red-300 text-xs">
                  Clear
                </Button>
              )}
              <button onClick={() => setCartOpen(false)} className="lg:hidden p-1 text-text-muted">
                <ChevronUp className="h-5 w-5 rotate-180" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <ShoppingCart className="h-12 w-12 opacity-30 mb-3" />
                <p className="text-sm">No items yet</p>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex items-center gap-2 sm:gap-3 rounded-lg border border-border bg-surface-elevated p-2.5 sm:p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{item.name}</p>
                    <p className="text-xs text-text-muted">KSh {item.price.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="h-6 w-6 rounded bg-surface-hover flex items-center justify-center">
                      <Minus className="h-3 w-3 text-text-secondary" />
                    </button>
                    <span className="w-7 text-center text-sm font-semibold text-text-primary">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="h-6 w-6 rounded bg-surface-hover flex items-center justify-center">
                      <Plus className="h-3 w-3 text-text-secondary" />
                    </button>
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-text-primary w-16 sm:w-20 text-right">KSh {(item.price * item.quantity).toLocaleString()}</p>
                  <button onClick={() => removeItem(item.id)} className="h-6 w-6 rounded flex items-center justify-center hover:bg-red-500/10">
                    <Trash2 className="h-3 w-3 text-text-muted hover:text-red-400" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Totals & Actions */}
          <div className="border-t border-border p-4 sm:p-5 space-y-3 bg-surface-elevated">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Subtotal</span>
                <span className="text-text-primary">KSh {getSubtotal().toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">VAT ({taxRate}%)</span>
                <span className="text-text-primary">KSh {getTax(taxRate).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-base font-semibold text-text-primary">Total</span>
                <span className="text-xl font-bold text-gold">KSh {getTotal(taxRate).toLocaleString()}</span>
              </div>
            </div>

            {/* New Tab Form */}
            {showNewTab ? (
              <div className="space-y-2 p-3 rounded-lg border border-gold/20 bg-gold/5">
                <Input
                  placeholder="Tab name (e.g. Table 5, John's group)"
                  value={tabName}
                  onChange={(e) => setTabName(e.target.value)}
                />
                <Input
                  placeholder="Customer name (optional)"
                  value={tabCustomer}
                  onChange={(e) => setTabCustomer(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleOpenTab} disabled={!tabName.trim() || items.length === 0 || processing} className="flex-1">
                    {processing ? "Opening..." : "Open Tab"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewTab(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                {/* If adding to existing tab */}
                {activeTab ? (
                  <Button size="lg" className="w-full" disabled={items.length === 0 || processing} onClick={() => handleAddToTab(activeTab)}>
                    {processing ? "Adding..." : `Add to "${activeTab.tabName}"`}
                  </Button>
                ) : (
                  <>
                    {/* Payment method */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "CASH", icon: Banknote, label: "Cash" },
                        { id: "MPESA", icon: Smartphone, label: "M-Pesa" },
                        { id: "CARD", icon: CreditCard, label: "Card" },
                      ].map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setPaymentMethod(m.id)}
                          className={cn("flex flex-col items-center gap-1 rounded-lg border p-2.5 transition-all", paymentMethod === m.id ? "border-gold/50 bg-gold/10 text-gold" : "border-border text-text-secondary")}
                        >
                          <m.icon className="h-4 w-4" />
                          <span className="text-[10px] font-medium">{m.label}</span>
                        </button>
                      ))}
                    </div>

                    <Button size="lg" className="w-full" disabled={items.length === 0 || processing} onClick={handleCheckout}>
                      {processing ? "Processing..." : `Complete Sale`}
                    </Button>

                    <Button size="sm" variant="outline" className="w-full" disabled={items.length === 0} onClick={() => setShowNewTab(true)}>
                      <Clock className="h-3.5 w-3.5 mr-1" /> Open as Tab
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
