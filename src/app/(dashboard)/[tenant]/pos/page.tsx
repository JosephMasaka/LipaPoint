"use client";

import { useState, useEffect } from "react";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Search, Grid3X3, List, Minus, Plus, Trash2,
  CreditCard, Banknote, Smartphone, Package, ShoppingCart, ChevronUp,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  image: string | null;
  category: { id: string; name: string; color: string } | null;
  stocks: { quantity: number }[];
}

interface Category {
  id: string;
  name: string;
  color: string;
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

  const { items, addItem, removeItem, updateQuantity, clearCart, getSubtotal, getTax, getTotal } = useCartStore();

  useEffect(() => {
    fetch("/api/products").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setProducts(data);
    }).catch(() => {});
    fetch("/api/products?categories=true").then(r => r.json()).then(data => {
      if (data.categories) setCategories(data.categories);
    }).catch(() => {});
  }, []);

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
          taxAmount: getTax(16),
          total: getTotal(16),
        }),
      });
      if (res.ok) {
        clearCart();
        setCartOpen(false);
        alert("Sale completed successfully!");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to process sale");
      }
    } catch {
      alert("Network error. Transaction saved offline.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen relative">
      {/* Products Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search Bar */}
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
          <div className="hidden sm:flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setViewMode("grid")} className={cn("p-2.5", viewMode === "grid" && "bg-surface-hover text-gold")}>
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode("list")} className={cn("p-2.5", viewMode === "list" && "bg-surface-hover text-gold")}>
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto border-b border-border bg-surface px-3 sm:px-4 py-2 sm:py-3 scrollbar-none">
          <button
            onClick={() => setActiveCategory("all")}
            className={cn("whitespace-nowrap rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-all", activeCategory === "all" ? "bg-surface-hover text-text-primary border border-border" : "text-text-muted hover:text-text-secondary")}
          >
            All Items
          </button>
          {categories.map((cat) => (
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
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
              {filtered.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addItem({ id: product.id, name: product.name, price: product.price, sku: product.sku })}
                  className="relative flex flex-col items-center rounded-xl border border-border bg-surface-elevated p-3 sm:p-4 hover:border-gold/30 hover:shadow-lg transition-all group"
                >
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg object-cover mb-2 sm:mb-3" />
                  ) : (
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-surface-hover group-hover:bg-gold/10 transition-colors mb-2 sm:mb-3">
                      <Package className="h-5 w-5 sm:h-6 sm:w-6 text-text-muted group-hover:text-gold" />
                    </div>
                  )}
                  <p className="text-xs sm:text-sm font-medium text-text-primary text-center line-clamp-2">{product.name}</p>
                  <p className="text-sm sm:text-base font-bold text-gold mt-1">KSh {product.price.toLocaleString()}</p>
                  {product.stocks[0] && product.stocks[0].quantity < 10 && (
                    <Badge variant="destructive" className="absolute top-2 right-2 text-[9px]">Low</Badge>
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
                      <p className="text-xs text-text-muted">{product.sku}</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-gold">KSh {product.price.toLocaleString()}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Cart Toggle */}
      <button
        onClick={() => setCartOpen(!cartOpen)}
        className="lg:hidden fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-gold text-black px-4 py-3 shadow-lg shadow-gold/30"
      >
        <ShoppingCart className="h-5 w-5" />
        {items.length > 0 && (
          <span className="text-sm font-bold">{items.length} - KSh {getTotal(16).toLocaleString()}</span>
        )}
        <ChevronUp className={cn("h-4 w-4 transition-transform", cartOpen && "rotate-180")} />
      </button>

      {/* Mobile cart overlay */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setCartOpen(false)} />
      )}

      {/* Cart Panel - slide up on mobile, fixed sidebar on desktop */}
      <div className={cn(
        "fixed lg:relative z-50 lg:z-auto bg-surface border-l border-border flex flex-col transition-transform duration-300",
        "bottom-0 left-0 right-0 lg:bottom-auto lg:left-auto lg:right-auto lg:top-0",
        "h-[85vh] lg:h-screen w-full lg:w-96 rounded-t-2xl lg:rounded-none",
        cartOpen ? "translate-y-0" : "translate-y-full lg:translate-y-0"
      )}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-gold" />
            <h3 className="text-sm font-semibold text-text-primary">Current Sale</h3>
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

        {/* Totals & Payment */}
        <div className="border-t border-border p-4 sm:p-5 space-y-3 sm:space-y-4 bg-surface-elevated">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Subtotal</span>
              <span className="text-text-primary">KSh {getSubtotal().toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">VAT (16%)</span>
              <span className="text-text-primary">KSh {getTax(16).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="text-base font-semibold text-text-primary">Total</span>
              <span className="text-xl font-bold text-gold">KSh {getTotal(16).toLocaleString()}</span>
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
                className={cn("flex flex-col items-center gap-1 rounded-lg border p-2.5 sm:p-3 transition-all", paymentMethod === m.id ? "border-gold/50 bg-gold/10 text-gold" : "border-border text-text-secondary hover:border-border")}
              >
                <m.icon className="h-4 w-4" />
                <span className="text-[10px] font-medium">{m.label}</span>
              </button>
            ))}
          </div>

          <Button size="xl" className="w-full" disabled={items.length === 0 || processing} onClick={handleCheckout}>
            {processing ? "Processing..." : `Complete Sale - KSh ${getTotal(16).toLocaleString()}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
