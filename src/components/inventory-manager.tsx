"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Package, AlertTriangle, TrendingDown } from "lucide-react";

const inventory = [
  { id: "1", sku: "BEV-001", name: "Espresso", category: "Beverages", price: 4.5, cost: 1.2, stock: 999, location: "Main Store" },
  { id: "2", sku: "BEV-002", name: "Cappuccino", category: "Beverages", price: 5.5, cost: 1.8, stock: 999, location: "Main Store" },
  { id: "3", sku: "FOD-001", name: "Grilled Chicken", category: "Food", price: 18.5, cost: 7.5, stock: 45, location: "Main Store" },
  { id: "4", sku: "FOD-002", name: "Caesar Salad", category: "Food", price: 14.0, cost: 4.5, stock: 30, location: "Main Store" },
  { id: "5", sku: "FOD-003", name: "Beef Burger", category: "Food", price: 16.0, cost: 6.0, stock: 8, location: "Main Store" },
  { id: "6", sku: "DST-001", name: "Cheesecake", category: "Desserts", price: 9.0, cost: 3.0, stock: 5, location: "Main Store" },
  { id: "7", sku: "SPR-001", name: "Whiskey Sour", category: "Spirits", price: 12.0, cost: 4.0, stock: 999, location: "Main Store" },
  { id: "8", sku: "SPC-001", name: "Chef Special", category: "Specials", price: 24.0, cost: 10.0, stock: 3, location: "Main Store" },
];

export function InventoryManager() {
  const [search, setSearch] = useState("");

  const filtered = inventory.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = inventory.filter((p) => p.stock < 10 && p.stock !== 999);
  const totalValue = inventory.reduce((sum, p) => sum + p.price * (p.stock === 999 ? 0 : p.stock), 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10">
              <Package className="h-5 w-5 text-gold" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Products</p>
              <p className="text-xl font-bold text-zinc-100">{inventory.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Low Stock Items</p>
              <p className="text-xl font-bold text-amber-400">{lowStock.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <TrendingDown className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Inventory Value</p>
              <p className="text-xl font-bold text-zinc-100">${totalValue.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product List */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Products</CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Product
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Margin</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 uppercase">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filtered.map((item) => {
                  const margin = ((item.price - item.cost) / item.price) * 100;
                  const isLowStock = item.stock < 10 && item.stock !== 999;
                  return (
                    <tr key={item.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-zinc-400">{item.sku}</td>
                      <td className="px-4 py-3 text-sm font-medium text-zinc-200">{item.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{item.category}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-100 text-right tabular-nums">${item.price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-zinc-400 text-right tabular-nums">${item.cost.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-emerald-400 text-right tabular-nums">{margin.toFixed(0)}%</td>
                      <td className="px-4 py-3 text-center">
                        {item.stock === 999 ? (
                          <Badge variant="success">Unlimited</Badge>
                        ) : isLowStock ? (
                          <Badge variant="destructive">{item.stock} left</Badge>
                        ) : (
                          <Badge variant="secondary">{item.stock}</Badge>
                        )}
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
  );
}
