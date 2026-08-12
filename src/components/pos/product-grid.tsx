"use client";

import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart";
import { Package, Plus } from "lucide-react";

interface ProductGridProps {
  viewMode: "grid" | "list";
  searchQuery: string;
  activeCategory: string;
}

const products = [
  { id: "1", name: "Espresso", price: 4.5, category: "beverages", sku: "BEV-001", stock: 999 },
  { id: "2", name: "Cappuccino", price: 5.5, category: "beverages", sku: "BEV-002", stock: 999 },
  { id: "3", name: "Latte", price: 6.0, category: "beverages", sku: "BEV-003", stock: 999 },
  { id: "4", name: "Cold Brew", price: 5.0, category: "beverages", sku: "BEV-004", stock: 999 },
  { id: "5", name: "Grilled Chicken", price: 18.5, category: "food", sku: "FOD-001", stock: 45 },
  { id: "6", name: "Caesar Salad", price: 14.0, category: "food", sku: "FOD-002", stock: 30 },
  { id: "7", name: "Beef Burger", price: 16.0, category: "food", sku: "FOD-003", stock: 28 },
  { id: "8", name: "Fish & Chips", price: 15.5, category: "food", sku: "FOD-004", stock: 22 },
  { id: "9", name: "Cheesecake", price: 9.0, category: "desserts", sku: "DST-001", stock: 15 },
  { id: "10", name: "Tiramisu", price: 10.0, category: "desserts", sku: "DST-002", stock: 12 },
  { id: "11", name: "Whiskey Sour", price: 12.0, category: "spirits", sku: "SPR-001", stock: 999 },
  { id: "12", name: "Gin & Tonic", price: 11.0, category: "spirits", sku: "SPR-002", stock: 999 },
  { id: "13", name: "Mojito", price: 13.0, category: "spirits", sku: "SPR-003", stock: 999 },
  { id: "14", name: "Margarita", price: 12.5, category: "spirits", sku: "SPR-004", stock: 999 },
  { id: "15", name: "Chef Special", price: 24.0, category: "specials", sku: "SPC-001", stock: 10 },
  { id: "16", name: "Pasta Carbonara", price: 17.0, category: "food", sku: "FOD-005", stock: 35 },
];

export function ProductGrid({ viewMode, searchQuery, activeCategory }: ProductGridProps) {
  const addItem = useCartStore((s) => s.addItem);

  const filtered = products.filter((p) => {
    const matchesCategory = activeCategory === "all" || p.category === activeCategory;
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
        <Package className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-sm">No products found</p>
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <div className="space-y-2">
        {filtered.map((product) => (
          <button
            key={product.id}
            onClick={() => addItem(product)}
            className="w-full flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all duration-200 group"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 group-hover:bg-gold/10 transition-colors">
                <Package className="h-5 w-5 text-zinc-400 group-hover:text-gold transition-colors" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-zinc-200">{product.name}</p>
                <p className="text-xs text-zinc-500">{product.sku} · {product.stock} in stock</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm font-bold text-zinc-100 tabular-nums">
                ${product.price.toFixed(2)}
              </p>
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 group-hover:bg-gold/20 transition-colors">
                <Plus className="h-3.5 w-3.5 text-zinc-400 group-hover:text-gold transition-colors" />
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {filtered.map((product) => (
        <button
          key={product.id}
          onClick={() => addItem(product)}
          className={cn(
            "relative flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 p-5",
            "hover:bg-zinc-800/50 hover:border-gold/30 hover:shadow-lg hover:shadow-gold/5",
            "transition-all duration-200 group cursor-pointer"
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 group-hover:bg-gold/10 transition-colors mb-3">
            <Package className="h-6 w-6 text-zinc-400 group-hover:text-gold transition-colors" />
          </div>
          <p className="text-sm font-medium text-zinc-200 text-center">{product.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{product.sku}</p>
          <p className="text-base font-bold text-gold mt-2 tabular-nums">
            ${product.price.toFixed(2)}
          </p>
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/20">
              <Plus className="h-3.5 w-3.5 text-gold" />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
