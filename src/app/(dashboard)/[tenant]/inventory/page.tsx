"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  sku: string;
  image: string | null;
  price: number;
  cost: number;
  isActive: boolean;
  lowStockAlert: number;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  stock: number;
  createdAt: string;
}

interface ProductForm {
  name: string;
  sku: string;
  price: string;
  cost: string;
  categoryId: string;
  image: string;
  lowStockAlert: string;
}

const emptyForm: ProductForm = {
  name: "",
  sku: "",
  price: "",
  cost: "",
  categoryId: "",
  image: "",
  lowStockAlert: "10",
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [error, setError] = useState("");

  const fetchProducts = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter) params.set("category", categoryFilter);
      const res = await fetch(`/api/products?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch {
      console.error("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/products/${editingId}` : "/api/products";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        return;
      }

      setForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
      fetchProducts();
    } catch {
      setError("Network error");
    }
  };

  const handleEdit = (product: Product) => {
    setForm({
      name: product.name,
      sku: product.sku,
      price: product.price.toString(),
      cost: product.cost.toString(),
      categoryId: product.categoryId || "",
      image: product.image || "",
      lowStockAlert: product.lowStockAlert.toString(),
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchProducts();
      }
    } catch {
      console.error("Failed to delete product");
    }
  };

  const categories = Array.from(
    new Map(
      products
        .filter((p) => p.category)
        .map((p) => [p.category!.id, p.category!])
    ).values()
  );

  return (
    <div className="min-h-screen bg-surface">
      <Header title="Inventory" subtitle="Manage your products and stock levels" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3 flex-1">
            <div className="max-w-xs flex-1">
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-gold/50"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={() => {
              setForm(emptyForm);
              setEditingId(null);
              setShowForm(!showForm);
            }}
          >
            {showForm ? "Cancel" : "Add Product"}
          </Button>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingId ? "Edit Product" : "Add New Product"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Input
                    label="Product Name"
                    placeholder="e.g. Tusker Lager 500ml"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                  <Input
                    label="SKU"
                    placeholder="e.g. TUS-500"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    required
                  />
                  <Input
                    label="Price (KES)"
                    type="number"
                    placeholder="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    required
                  />
                  <Input
                    label="Cost (KES)"
                    type="number"
                    placeholder="0"
                    value={form.cost}
                    onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  />
                  <Input
                    label="Image URL"
                    placeholder="https://..."
                    value={form.image}
                    onChange={(e) => setForm({ ...form, image: e.target.value })}
                  />
                  <Input
                    label="Low Stock Alert"
                    type="number"
                    placeholder="10"
                    value={form.lowStockAlert}
                    onChange={(e) =>
                      setForm({ ...form, lowStockAlert: e.target.value })
                    }
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit">
                    {editingId ? "Update Product" : "Create Product"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Products Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                        Loading products...
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                        No products found. Add your first product above.
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr
                        key={product.id}
                        className="hover:bg-surface-hover transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="h-10 w-10 rounded-lg object-cover border border-border"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-surface-elevated border border-border flex items-center justify-center">
                                <span className="text-xs text-text-muted">N/A</span>
                              </div>
                            )}
                            <span className="font-medium text-text-primary">
                              {product.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-text-secondary font-mono text-xs">
                          {product.sku}
                        </td>
                        <td className="px-6 py-4 text-text-secondary">
                          {product.category?.name || "Uncategorized"}
                        </td>
                        <td className="px-6 py-4 text-text-primary">
                          {formatCurrency(product.price)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={
                              product.stock <= product.lowStockAlert
                                ? "text-red-400 font-medium"
                                : "text-emerald-400 font-medium"
                            }
                          >
                            {product.stock}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={product.isActive ? "success" : "secondary"}
                          >
                            {product.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(product)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300"
                              onClick={() => handleDelete(product.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
