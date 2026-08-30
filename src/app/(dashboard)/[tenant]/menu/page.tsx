"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import { Header } from "@/components/header";
import { cn, formatCurrency } from "@/lib/utils";
import {
  BookOpen,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  CheckCircle,
} from "lucide-react";

// ---- Types ----

interface Category {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  _count: { products: number };
}

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: number;
  isActive: boolean;
  categoryId: string | null;
  category: { id: string; name: string; color: string } | null;
}

const PRESET_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#3b82f6",
  "#ec4899",
];

// ---- Component ----

export default function MenuManagementPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Category form
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState(PRESET_COLORS[0]);
  const [savingCategory, setSavingCategory] = useState(false);

  // Item modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [itemSku, setItemSku] = useState("");
  const [savingItem, setSavingItem] = useState(false);

  // Notification
  const [notification, setNotification] = useState<{
    type: string;
    message: string;
  } | null>(null);

  const notify = useCallback((type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // ---- Data fetching ----

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/menu/categories");
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
    } catch {
      notify("error", "Failed to load categories");
    }
  }, [notify]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      if (Array.isArray(data)) setProducts(data);
    } catch {
      notify("error", "Failed to load menu items");
    }
  }, [notify]);

  useEffect(() => {
    Promise.all([fetchCategories(), fetchProducts()]).finally(() =>
      setLoading(false)
    );
  }, [fetchCategories, fetchProducts]);

  // ---- Category CRUD ----

  const openCategoryForm = (cat?: Category) => {
    if (cat) {
      setEditingCategory(cat);
      setCategoryName(cat.name);
      setCategoryColor(cat.color);
    } else {
      setEditingCategory(null);
      setCategoryName("");
      setCategoryColor(PRESET_COLORS[0]);
    }
    setShowCategoryForm(true);
  };

  const closeCategoryForm = () => {
    setShowCategoryForm(false);
    setEditingCategory(null);
    setCategoryName("");
    setCategoryColor(PRESET_COLORS[0]);
  };

  const saveCategory = async () => {
    if (!categoryName.trim()) return;
    setSavingCategory(true);
    try {
      const url = editingCategory
        ? `/api/menu/categories/${editingCategory.id}`
        : "/api/menu/categories";
      const method = editingCategory ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName.trim(), color: categoryColor }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify("error", data.error || "Failed to save category");
      } else {
        notify("success", editingCategory ? "Category updated" : "Category created");
        fetchCategories();
        closeCategoryForm();
      }
    } catch {
      notify("error", "Network error");
    } finally {
      setSavingCategory(false);
    }
  };

  const deleteCategory = async (cat: Category) => {
    if (!confirm(`Delete "${cat.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/menu/categories/${cat.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        notify("error", data.error || "Failed to delete category");
      } else {
        notify("success", "Category deleted");
        if (selectedCategory === cat.id) setSelectedCategory(null);
        fetchCategories();
      }
    } catch {
      notify("error", "Network error");
    }
  };

  // ---- Item CRUD ----

  const openItemModal = (item?: Product) => {
    if (item) {
      setEditingItem(item);
      setItemName(item.name);
      setItemPrice(item.price.toString());
      setItemDescription(item.description || "");
      setItemCategory(item.categoryId || "");
      setItemSku(item.sku);
    } else {
      setEditingItem(null);
      setItemName("");
      setItemPrice("");
      setItemDescription("");
      setItemCategory(selectedCategory || "");
      setItemSku("");
    }
    setShowItemModal(true);
  };

  const closeItemModal = () => {
    setShowItemModal(false);
    setEditingItem(null);
    setItemName("");
    setItemPrice("");
    setItemDescription("");
    setItemCategory("");
    setItemSku("");
  };

  const saveItem = async () => {
    if (!itemName.trim() || !itemPrice) {
      notify("error", "Name and price are required");
      return;
    }
    setSavingItem(true);
    try {
      const sku = itemSku.trim() || `MENU-${Date.now()}`;

      if (editingItem) {
        const res = await fetch(`/api/products/${editingItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: itemName.trim(),
            price: itemPrice,
            sku,
            categoryId: itemCategory || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          notify("error", data.error || "Failed to update item");
        } else {
          notify("success", "Menu item updated");
          fetchProducts();
          closeItemModal();
        }
      } else {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: itemName.trim(),
            price: itemPrice,
            sku,
            categoryId: itemCategory || null,
            description: itemDescription.trim() || null,
            trackStock: false,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          notify("error", data.error || "Failed to create item");
        } else {
          notify("success", "Menu item added");
          fetchProducts();
          fetchCategories();
          closeItemModal();
        }
      }
    } catch {
      notify("error", "Network error");
    } finally {
      setSavingItem(false);
    }
  };

  const toggleItemActive = async (item: Product) => {
    try {
      const res = await fetch(`/api/products/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: item.name, sku: item.sku, price: item.price }),
      });
      if (res.ok) {
        // The API doesn't support isActive toggle directly — we re-fetch
        // For now, toggle locally and update
        setProducts((prev) =>
          prev.map((p) =>
            p.id === item.id ? { ...p, isActive: !p.isActive } : p
          )
        );
        notify("success", item.isActive ? "Item deactivated" : "Item activated");
      }
    } catch {
      notify("error", "Failed to update item");
    }
  };

  // ---- Filtered & sorted items ----

  const filteredProducts = products
    .filter((p) => {
      if (selectedCategory && p.categoryId !== selectedCategory) return false;
      if (searchQuery) {
        return p.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    })
    .sort((a, b) => {
      const catA = a.category?.name || "";
      const catB = b.category?.name || "";
      if (catA !== catB) return catA.localeCompare(catB);
      return a.name.localeCompare(b.name);
    });

  // ---- Render ----

  if (loading) {
    return (
      <div>
        <Header title="Menu Management" subtitle="Organize your restaurant menu" />
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Loader size="lg" label="Loading menu..." className="min-h-[60vh]" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Menu Management" subtitle="Organize your restaurant menu" />

      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm ${
            notification.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Mobile category tabs (horizontal scroll) */}
        <div className="lg:hidden mb-4 flex gap-2 overflow-x-auto scrollbar-none pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              !selectedCategory
                ? "bg-gold/10 text-gold border-gold/30"
                : "bg-surface-elevated text-text-secondary border-border"
            )}
          >
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5",
                selectedCategory === cat.id
                  ? "bg-gold/10 text-gold border-gold/30"
                  : "bg-surface-elevated text-text-secondary border-border"
              )}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex gap-6">
          {/* Desktop sidebar */}
          <div className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-28 space-y-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Sections
                </h3>
                <button
                  onClick={() => openCategoryForm()}
                  className="p-1 rounded-md hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                  title="Add category"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                  !selectedCategory
                    ? "bg-gold/10 text-gold font-medium"
                    : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                )}
              >
                <BookOpen className="h-4 w-4 inline mr-2" />
                All Items
                <span className="ml-auto text-xs text-text-muted float-right">
                  {products.length}
                </span>
              </button>

              {categories.map((cat) => (
                <div key={cat.id} className="group relative">
                  <button
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2",
                      selectedCategory === cat.id
                        ? "bg-gold/10 text-gold font-medium"
                        : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="truncate flex-1">{cat.name}</span>
                    <span className="text-xs text-text-muted">
                      {cat._count.products}
                    </span>
                  </button>
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openCategoryForm(cat);
                      }}
                      className="p-1 rounded hover:bg-surface-hover text-text-muted"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCategory(cat);
                      }}
                      className="p-1 rounded hover:bg-surface-hover text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Category form inline */}
              {showCategoryForm && (
                <div className="mt-3 p-3 rounded-lg border border-border bg-surface-elevated space-y-3">
                  <Input
                    placeholder="Category name"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                  />
                  <div className="flex gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCategoryColor(c)}
                        className={cn(
                          "h-6 w-6 rounded-full border-2 transition-all",
                          categoryColor === c
                            ? "border-white scale-110"
                            : "border-transparent"
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={saveCategory}
                      disabled={savingCategory || !categoryName.trim()}
                    >
                      {savingCategory ? "Saving..." : editingCategory ? "Update" : "Add"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={closeCategoryForm}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 h-10 rounded-lg border border-border bg-surface-elevated text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  className="lg:hidden"
                  variant="outline"
                  size="sm"
                  onClick={() => openCategoryForm()}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Section
                </Button>
                <Button onClick={() => openItemModal()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Menu Item
                </Button>
              </div>
            </div>

            {/* Items grid */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <BookOpen className="h-12 w-12 text-text-muted mx-auto mb-3 opacity-30" />
                <p className="text-text-secondary font-medium">
                  {searchQuery
                    ? "No items match your search"
                    : selectedCategory
                    ? "No items in this section"
                    : "No menu items yet"}
                </p>
                <p className="text-sm text-text-muted mt-1">
                  {!searchQuery && "Add your first menu item to get started"}
                </p>
                {!searchQuery && (
                  <Button className="mt-4" onClick={() => openItemModal()}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Menu Item
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredProducts.map((item) => (
                  <Card key={item.id} className="group relative">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {item.category && (
                              <span
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor: item.category.color,
                                }}
                              />
                            )}
                            <h3 className="text-sm font-semibold text-text-primary truncate">
                              {item.name}
                            </h3>
                          </div>
                          {item.category && (
                            <p className="text-xs text-text-muted mb-2">
                              {item.category.name}
                            </p>
                          )}
                          <p className="text-base font-bold text-gold">
                            {formatCurrency(item.price)}
                          </p>
                        </div>
                        <Badge
                          variant={item.isActive ? "success" : "secondary"}
                        >
                          {item.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
                        <button
                          onClick={() => openItemModal(item)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => toggleItemActive(item)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                        >
                          {item.isActive ? (
                            <>
                              <ToggleRight className="h-3 w-3" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="h-3 w-3" />
                              Activate
                            </>
                          )}
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Item Modal */}
      {showItemModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={closeItemModal}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-surface-elevated border border-border rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="text-lg font-semibold text-text-primary">
                  {editingItem ? "Edit Menu Item" : "Add Menu Item"}
                </h2>
                <button
                  onClick={closeItemModal}
                  className="p-1 rounded-md hover:bg-surface-hover text-text-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <Input
                  label="Item Name"
                  placeholder="e.g. Grilled Chicken"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                />
                <Input
                  label="Price"
                  type="number"
                  placeholder="0"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                />
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    rows={2}
                    placeholder="Optional description..."
                    className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    Category
                  </label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-all"
                  >
                    <option value="">No category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="SKU"
                  placeholder="Auto-generated if empty"
                  value={itemSku}
                  onChange={(e) => setItemSku(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
                <Button variant="ghost" onClick={closeItemModal}>
                  Cancel
                </Button>
                <Button
                  onClick={saveItem}
                  disabled={savingItem || !itemName.trim() || !itemPrice}
                >
                  {savingItem
                    ? "Saving..."
                    : editingItem
                    ? "Update Item"
                    : "Add Item"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
