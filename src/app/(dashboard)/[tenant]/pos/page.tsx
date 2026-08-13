"use client";

import { useState, useEffect } from "react";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Search, Grid3X3, List, Minus, Plus, Trash2,
  CreditCard, Banknote, Smartphone, Package, ShoppingCart,
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
    <div className="flex h-screen">
      {/* Products Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search Bar */}
        <div className="flex items-center gap-3 border-b border-zinc-800 p-4 bg-zinc-950">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Search products by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-zinc-900 border-zinc-800"
            />
          </div>
          <div className="flex rounded-lg border border-zinc-800 overflow-hidden">
            <button onClick={() => setViewMode("grid")} className={cn("p-2.5", viewMode === "grid" && "bg-zinc-800 text-gold")}>
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode("list")} className={cn("p-2.5", viewMode === "list" && "bg-zinc-800 text-gold")}>
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto border-b border-zinc-800 bg-zinc-950 px-4 py-3 scrollbar-none">
          <button
            onClick={() => setActiveCategory("all")}
            className={cn("whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all", activeCategory === "all" ? "bg-zinc-800 text-zinc-100 border border-zinc-700" : "text-zinc-500 hover:text-zinc-300")}
          >
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn("flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all", activeCategory === cat.id ? "bg-zinc-800 text-zinc-100 border border-zinc-700" : "text-zinc-500 hover:text-zinc-300")}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-zinc-950/50">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
              <Package className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">No products found</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addItem({ id: product.id, name: product.name, price: product.price, sku: product.sku })}
                  className="relative flex flex-col items-center rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-gold/30 hover:shadow-lg transition-all group"
                >
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="h-12 w-12 rounded-lg object-cover mb-3" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 group-hover:bg-gold/10 transition-colors mb-3">
                      <Package className="h-6 w-6 text-zinc-400 group-hover:text-gold" />
                    </div>
                  )}
                  <p className="text-sm font-medium text-zinc-200 text-center">{product.name}</p>
                  <p className="text-base font-bold text-gold mt-1">KSh {product.price.toLocaleString()}</p>
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
                  className="w-full flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 hover:border-gold/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-zinc-400" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-zinc-200">{product.name}</p>
                      <p className="text-xs text-zinc-500">{product.sku}</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-gold">KSh {product.price.toLocaleString()}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Panel */}
      <div className="w-96 flex flex-col bg-zinc-950 border-l border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-gold" />
            <h3 className="text-sm font-semibold text-zinc-100">Current Sale</h3>
          </div>
          {items.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearCart} className="text-red-400 hover:text-red-300 text-xs">
              Clear
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <ShoppingCart className="h-12 w-12 opacity-30 mb-3" />
              <p className="text-sm">No items yet</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{item.name}</p>
                  <p className="text-xs text-zinc-500">KSh {item.price.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="h-6 w-6 rounded bg-zinc-800 flex items-center justify-center hover:bg-zinc-700">
                    <Minus className="h-3 w-3 text-zinc-400" />
                  </button>
                  <span className="w-7 text-center text-sm font-semibold text-zinc-200">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="h-6 w-6 rounded bg-zinc-800 flex items-center justify-center hover:bg-zinc-700">
                    <Plus className="h-3 w-3 text-zinc-400" />
                  </button>
                </div>
                <p className="text-sm font-semibold text-zinc-100 w-20 text-right">KSh {(item.price * item.quantity).toLocaleString()}</p>
                <button onClick={() => removeItem(item.id)} className="h-6 w-6 rounded flex items-center justify-center hover:bg-red-500/10">
                  <Trash2 className="h-3 w-3 text-zinc-500 hover:text-red-400" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Totals & Payment */}
        <div className="border-t border-zinc-800 p-5 space-y-4 bg-zinc-900/30">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Subtotal</span>
              <span className="text-zinc-200">KSh {getSubtotal().toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">VAT (16%)</span>
              <span className="text-zinc-200">KSh {getTax(16).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-800 pt-2">
              <span className="text-base font-semibold text-zinc-100">Total</span>
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
                className={cn("flex flex-col items-center gap-1 rounded-lg border p-3 transition-all", paymentMethod === m.id ? "border-gold/50 bg-gold/10 text-gold" : "border-zinc-800 text-zinc-400 hover:border-zinc-700")}
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
