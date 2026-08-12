"use client";

import { useState } from "react";
import { Search, Grid3X3, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProductGrid } from "./product-grid";
import { CartPanel } from "./cart-panel";
import { CategoryBar } from "./category-bar";

const categories = [
  { id: "all", name: "All Items", color: "#d4af37" },
  { id: "beverages", name: "Beverages", color: "#3b82f6" },
  { id: "food", name: "Food", color: "#10b981" },
  { id: "desserts", name: "Desserts", color: "#f59e0b" },
  { id: "spirits", name: "Spirits", color: "#8b5cf6" },
  { id: "specials", name: "Specials", color: "#ef4444" },
];

export function POSRegister() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  return (
    <div className="flex h-screen">
      {/* Left Panel - Products */}
      <div className="flex-1 flex flex-col border-r border-zinc-800 overflow-hidden">
        {/* Top Bar */}
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
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-none h-10",
                viewMode === "grid" && "bg-zinc-800 text-gold"
              )}
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-none h-10",
                viewMode === "list" && "bg-zinc-800 text-gold"
              )}
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Category Bar */}
        <CategoryBar
          categories={categories}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-zinc-950/50">
          <ProductGrid
            viewMode={viewMode}
            searchQuery={searchQuery}
            activeCategory={activeCategory}
          />
        </div>
      </div>

      {/* Right Panel - Cart */}
      <CartPanel />
    </div>
  );
}
