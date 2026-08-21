"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Package, Ruler, BarChart3, DollarSign, Plus, Edit3,
  ArrowUpDown, Save, Upload, Search,
} from "lucide-react";
import { Pagination } from "@/components/pagination";

// Types
interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  image: string | null;
  price: number;
  cost: number;
  isActive: boolean;
  lowStockAlert: number;
  trackStock: boolean;
  baseUnitId: string | null;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  baseUnit: { id: string; name: string; abbreviation: string } | null;
  stock: number;
}

interface UnitOfMeasure {
  id: string;
  name: string;
  abbreviation: string;
  conversionsFrom: { id: string; toUnit: { id: string; name: string; abbreviation: string }; factor: number }[];
}

interface StockRecord {
  id: string;
  date: string;
  openingStock: number;
  addedStock: number;
  soldStock: number;
  closingStock: number;
  variance: number;
  notes: string | null;
  product: { id: string; name: string; sku: string; price: number; cost: number; baseUnit?: { abbreviation: string } | null };
  location: { id: string; name: string };
}

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  user: { name: string } | null;
}

interface LocationOption {
  id: string;
  name: string;
}

// Tabs
const tabs = [
  { id: "products", label: "Products", icon: Package },
  { id: "stock", label: "Stock Sheet", icon: BarChart3 },
  { id: "units", label: "Units", icon: Ruler },
  { id: "expenses", label: "Expenses", icon: DollarSign },
];

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState("products");

  return (
    <div className="min-h-screen bg-surface overflow-x-hidden">
      <Header title="Inventory" subtitle="Manage products, stock, units of measure, and expenses" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex gap-1 overflow-x-auto border-b border-border pb-px scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-surface-elevated text-gold border-b-2 border-gold"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "products" && <ProductsTab />}
        {activeTab === "stock" && <StockSheetTab />}
        {activeTab === "units" && <UnitsTab />}
        {activeTab === "expenses" && <ExpensesTab />}
      </div>
    </div>
  );
}

// ========== PRODUCTS TAB ==========
const PRODUCTS_PAGE_SIZE = 20;

function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", sku: "", barcode: "", price: "", cost: "", categoryId: "", unitId: "", image: "", lowStockAlert: "10" });
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchProducts = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/products?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
        if (!search) {
          try { localStorage.setItem("lipapoint-cached-inventory", JSON.stringify(data)); } catch {}
        }
      }
    } catch {
      if (products.length === 0) {
        try {
          const cached = localStorage.getItem("lipapoint-cached-inventory");
          if (cached) setProducts(JSON.parse(cached));
        } catch {}
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); setCurrentPage(1); }, [search]);
  useEffect(() => {
    fetch("/api/units").then(r => r.json()).then(d => { if (Array.isArray(d)) { setUnits(d); try { localStorage.setItem("lipapoint-oc-units", JSON.stringify({ data: d, timestamp: Date.now() })); } catch {} } }).catch(() => { try { const raw = localStorage.getItem("lipapoint-oc-units"); if (raw) { const { data } = JSON.parse(raw); setUnits(data); } } catch {} });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/products/${editingId}` : "/api/products";
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Error"); return; }
      setForm({ name: "", sku: "", barcode: "", price: "", cost: "", categoryId: "", unitId: "", image: "", lowStockAlert: "10" });
      setShowForm(false); setEditingId(null); fetchProducts();
    } catch {
      if (!navigator.onLine) {
        const { saveOfflineAction, requestBackgroundSync } = await import("@/lib/offline-db");
        if (editingId) {
          await saveOfflineAction("product_update", { ...form, _productId: editingId });
        } else {
          await saveOfflineAction("product_create", form);
        }
        requestBackgroundSync();
        setForm({ name: "", sku: "", barcode: "", price: "", cost: "", categoryId: "", unitId: "", image: "", lowStockAlert: "10" });
        setShowForm(false); setEditingId(null);
        setError("");
      } else {
        setError("Network error");
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); }}>
          {showForm ? "Cancel" : <><Plus className="h-4 w-4 mr-1" /> Add Product</>}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
                <Input label="Barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Scan or enter" />
                <Input label="Price (KES)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                <Input label="Cost (KES)" type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Unit of Measure</label>
                  <select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} className="w-full h-10 rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary">
                    <option value="">None</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                  </select>
                </div>
                <Input label="Low Stock Alert" type="number" value={form.lowStockAlert} onChange={(e) => setForm({ ...form, lowStockAlert: e.target.value })} />
                <Input label="Image URL" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
              </div>
              <Button type="submit">{editingId ? "Update" : "Create"} Product</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Unit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-12"><Loader label="Loading..." className="py-4" /></td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-text-muted">No products found.</td></tr>
                ) : products.slice((currentPage - 1) * PRODUCTS_PAGE_SIZE, currentPage * PRODUCTS_PAGE_SIZE).map((p) => (
                  <tr key={p.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary">{p.name}</td>
                    <td className="px-4 py-3 text-text-secondary font-mono text-xs">{p.sku}</td>
                    <td className="px-4 py-3 text-text-secondary text-xs">{p.baseUnit?.abbreviation || "-"}</td>
                    <td className="px-4 py-3 text-text-primary">{formatCurrency(p.price)}</td>
                    <td className="px-4 py-3">
                      <span className={p.stock <= p.lowStockAlert ? "text-red-400 font-medium" : "text-emerald-400 font-medium"}>
                        {p.stock}{p.baseUnit ? ` ${p.baseUnit.abbreviation}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3"><Badge variant={p.isActive ? "success" : "secondary"}>{p.isActive ? "Active" : "Off"}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => {
                        setForm({ name: p.name, sku: p.sku, barcode: p.barcode || "", price: p.price.toString(), cost: p.cost.toString(), categoryId: p.categoryId || "", unitId: p.baseUnitId || "", image: p.image || "", lowStockAlert: p.lowStockAlert.toString() });
                        setEditingId(p.id); setShowForm(true);
                      }}><Edit3 className="h-3 w-3" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(products.length / PRODUCTS_PAGE_SIZE)}
            onPageChange={setCurrentPage}
            totalItems={products.length}
            pageSize={PRODUCTS_PAGE_SIZE}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ========== STOCK SHEET TAB ==========
const STOCK_PAGE_SIZE = 25;

function StockSheetTab() {
  const [records, setRecords] = useState<StockRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationId, setLocationId] = useState("");
  const [editing, setEditing] = useState<Record<string, { addedStock?: number }>>({});
  const [addStockModal, setAddStockModal] = useState<{ productId: string; productName: string } | null>(null);
  const [addStockQty, setAddStockQty] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState<{ name: string; sku: string; price: string; cost: string; quantity: string; category: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; total: number } | null>(null);
  const [stockSearch, setStockSearch] = useState("");
  const [stockPage, setStockPage] = useState(1);

  useEffect(() => {
    fetch("/api/locations").then(r => r.json()).then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setLocations(data);
        setLocationId(data[0].id);
        try { localStorage.setItem("lipapoint-oc-stock-locations", JSON.stringify(data)); } catch {}
      }
      setLoading(false);
    }).catch(() => {
      try {
        const raw = localStorage.getItem("lipapoint-oc-stock-locations");
        if (raw) { const data = JSON.parse(raw); setLocations(data); if (data.length > 0) setLocationId(data[0].id); }
      } catch {}
      setLoading(false);
    });
  }, []);

  const fetchRecords = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stock?date=${date}&locationId=${locationId}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
        try { localStorage.setItem(`lipapoint-oc-stock-${date}-${locationId}`, JSON.stringify(data)); } catch {}
      }
    } catch {
      try {
        const raw = localStorage.getItem(`lipapoint-oc-stock-${date}-${locationId}`);
        if (raw) setRecords(JSON.parse(raw));
      } catch {}
    } finally { setLoading(false); }
  };

  useEffect(() => { if (locationId) fetchRecords(); }, [date, locationId]);

  const handleInitialize = async () => {
    if (!locationId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initialize", date, locationId }),
      });
      if (res.ok) {
        await fetchRecords();
      } else {
        throw new Error("offline");
      }
    } catch {
      if (!navigator.onLine) {
        const { saveOfflineAction, requestBackgroundSync } = await import("@/lib/offline-db");
        await saveOfflineAction("stock_initialize", { date, locationId });
        requestBackgroundSync();
      }
    }
    setSaving(false);
  };

  const handleSave = async () => {
    const updates = Object.entries(editing).map(([productId, vals]) => ({ productId, ...vals }));
    if (updates.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", date, locationId, records: updates }),
      });
      if (res.ok) {
        setEditing({});
        await fetchRecords();
      } else {
        throw new Error("offline");
      }
    } catch {
      if (!navigator.onLine) {
        const { saveOfflineAction, requestBackgroundSync } = await import("@/lib/offline-db");
        for (const update of updates) {
          await saveOfflineAction("stock_add", { date, locationId, productId: update.productId, quantity: update.addedStock || 0 });
        }
        requestBackgroundSync();
        setEditing({});
      }
    }
    setSaving(false);
  };

  const handleAddStock = async () => {
    if (!addStockModal || !addStockQty || isNaN(Number(addStockQty))) return;
    setSaving(true);
    const quantity = parseInt(addStockQty);
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addStock", date, locationId, productId: addStockModal.productId, quantity }),
      });
      if (res.ok) {
        setAddStockModal(null);
        setAddStockQty("");
        await fetchRecords();
      } else {
        throw new Error("offline");
      }
    } catch {
      if (!navigator.onLine) {
        const { saveOfflineAction, requestBackgroundSync } = await import("@/lib/offline-db");
        await saveOfflineAction("stock_add", { date, locationId, productId: addStockModal.productId, quantity });
        requestBackgroundSync();
        setAddStockModal(null);
        setAddStockQty("");
      }
    }
    setSaving(false);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return;

      // Parse headers (first row)
      const sep = lines[0].includes("\t") ? "\t" : ",";
      const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ""));

      const nameIdx = headers.findIndex(h => h.includes("name") || h.includes("product") || h.includes("item"));
      const skuIdx = headers.findIndex(h => h.includes("sku") || h.includes("code") || h.includes("barcode"));
      const priceIdx = headers.findIndex(h => h.includes("price") || h.includes("selling"));
      const costIdx = headers.findIndex(h => h.includes("cost") || h.includes("buying"));
      const qtyIdx = headers.findIndex(h => h.includes("qty") || h.includes("quantity") || h.includes("stock") || h.includes("opening"));
      const catIdx = headers.findIndex(h => h.includes("category") || h.includes("cat") || h.includes("group"));

      const parsed = lines.slice(1).map(line => {
        const cols = line.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ""));
        return {
          name: cols[nameIdx] || "",
          sku: skuIdx >= 0 ? cols[skuIdx] || "" : "",
          price: priceIdx >= 0 ? cols[priceIdx] || "0" : "0",
          cost: costIdx >= 0 ? cols[costIdx] || "0" : "0",
          quantity: qtyIdx >= 0 ? cols[qtyIdx] || "0" : "0",
          category: catIdx >= 0 ? cols[catIdx] || "" : "",
        };
      }).filter(r => r.name);

      setImportData(parsed);
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (importData.length === 0 || !locationId) return;
    setImporting(true);
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", date, locationId, items: importData }),
      });
      if (res.ok) {
        const result = await res.json();
        setImportResult(result);
        await fetchRecords();
      }
    } catch { /* ignore */ } finally { setImporting(false); }
  };

  const getCalculatedClosing = (r: StockRecord) => {
    const added = editing[r.product.id]?.addedStock ?? r.addedStock;
    return r.openingStock + added - r.soldStock;
  };

  const filteredRecords = records.filter((r) => {
    if (!stockSearch) return true;
    const q = stockSearch.toLowerCase();
    return r.product.name.toLowerCase().includes(q) || r.product.sku.toLowerCase().includes(q);
  });

  const stockTotalPages = Math.ceil(filteredRecords.length / STOCK_PAGE_SIZE);
  const paginatedRecords = filteredRecords.slice((stockPage - 1) * STOCK_PAGE_SIZE, stockPage * STOCK_PAGE_SIZE);

  const totalOpening = records.reduce((s, r) => s + r.openingStock * (r.product.cost || 0), 0);
  const totalClosing = records.reduce((s, r) => s + getCalculatedClosing(r) * (r.product.cost || 0), 0);
  const totalSold = records.reduce((s, r) => s + r.soldStock * (r.product.price || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3 items-center flex-wrap">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          {locations.length > 0 && (
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="h-10 rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary">
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input placeholder="Search product..." value={stockSearch} onChange={(e) => { setStockSearch(e.target.value); setStockPage(1); }} className="pl-9 w-48" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          {locationId && records.length === 0 && !loading && (
            <Button onClick={handleInitialize} disabled={saving}>
              <Plus className="h-4 w-4 mr-1" /> Initialize Day
            </Button>
          )}
          {Object.keys(editing).length > 0 && (
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-text-muted">Opening Stock Value</p>
            <p className="text-xl font-bold text-text-primary">{formatCurrency(totalOpening)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-text-muted">Sales (at selling price)</p>
            <p className="text-xl font-bold text-gold">{formatCurrency(totalSold)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-text-muted">Closing Stock Value</p>
            <p className="text-xl font-bold text-text-primary">{formatCurrency(totalClosing)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-surface-elevated/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">UoM</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase">Opening</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase">Added</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase">Sold</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase">Closing</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-12"><Loader label="Loading..." className="py-4" /></td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-text-muted">
                    No stock records for this date. Click &quot;Initialize Day&quot; to start.
                  </td></tr>
                ) : paginatedRecords.map((r) => {
                  const closing = getCalculatedClosing(r);
                  return (
                    <tr key={r.id} className="hover:bg-surface-hover transition-colors">
                      <td className="px-4 py-2">
                        <p className="font-medium text-text-primary text-xs">{r.product.name}</p>
                        <p className="text-[10px] text-text-muted font-mono">{r.product.sku}</p>
                      </td>
                      <td className="px-4 py-2 text-text-muted text-xs">{r.product.baseUnit?.abbreviation || "-"}</td>
                      <td className="px-4 py-2 text-center text-text-secondary">{r.openingStock}</td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="number"
                          className="w-16 text-center rounded border border-border bg-surface-elevated px-1 py-0.5 text-xs text-text-primary focus:ring-1 focus:ring-gold focus:border-gold"
                          value={editing[r.product.id]?.addedStock ?? r.addedStock}
                          onChange={(e) => setEditing({ ...editing, [r.product.id]: { addedStock: parseInt(e.target.value) || 0 } })}
                        />
                      </td>
                      <td className="px-4 py-2 text-center text-text-secondary">{r.soldStock}</td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-xs font-semibold text-text-primary">{closing}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Button variant="ghost" size="sm" onClick={() => { setAddStockModal({ productId: r.product.id, productName: r.product.name }); setAddStockQty(""); }}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={stockPage}
            totalPages={stockTotalPages}
            onPageChange={setStockPage}
            totalItems={filteredRecords.length}
            pageSize={STOCK_PAGE_SIZE}
          />
        </CardContent>
      </Card>

      {/* Add Stock Modal */}
      {addStockModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAddStockModal(null)} />
          <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-base font-bold text-text-primary">Add Stock</h3>
                <p className="text-xs text-text-muted mt-0.5">{addStockModal.productName}</p>
              </div>
              <Input
                label="Quantity to add"
                type="number"
                min="1"
                value={addStockQty}
                onChange={(e) => setAddStockQty(e.target.value)}
                autoFocus
                placeholder="Enter quantity"
              />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setAddStockModal(null)}>Cancel</Button>
                <Button className="flex-1" onClick={handleAddStock} disabled={!addStockQty || isNaN(Number(addStockQty)) || saving}>
                  {saving ? "Adding..." : "Add"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowImport(false); setImportData([]); setImportResult(null); }} />
          <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[80vh] flex flex-col">
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <h3 className="text-base font-bold text-text-primary">Import Stock Sheet</h3>
                <p className="text-xs text-text-muted mt-1">
                  Upload a CSV file to import products and stock. This will create new products (or update existing ones) and set their stock levels.
                </p>
              </div>

              <div className="bg-surface-elevated border border-border rounded-lg p-3">
                <p className="text-xs font-medium text-text-secondary mb-1">Expected CSV columns:</p>
                <p className="text-[11px] text-text-muted font-mono">Name, SKU, Price, Cost, Quantity, Category</p>
                <p className="text-[11px] text-text-muted mt-1">Only &quot;Name&quot; is required. Headers are auto-detected.</p>
              </div>

              <input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileImport}
                className="block w-full text-xs text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gold/10 file:text-gold hover:file:bg-gold/20 cursor-pointer"
              />

              {importData.length > 0 && !importResult && (
                <div className="space-y-3">
                  <p className="text-xs text-text-secondary">{importData.length} items found in file:</p>
                  <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-border bg-surface-elevated/50 sticky top-0">
                          <th className="px-2 py-1.5 text-left text-text-secondary">Name</th>
                          <th className="px-2 py-1.5 text-left text-text-secondary">SKU</th>
                          <th className="px-2 py-1.5 text-right text-text-secondary">Price</th>
                          <th className="px-2 py-1.5 text-right text-text-secondary">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {importData.slice(0, 20).map((item, i) => (
                          <tr key={i}>
                            <td className="px-2 py-1 text-text-primary">{item.name}</td>
                            <td className="px-2 py-1 text-text-muted">{item.sku || "-"}</td>
                            <td className="px-2 py-1 text-right text-text-secondary">{item.price}</td>
                            <td className="px-2 py-1 text-right text-text-secondary">{item.quantity}</td>
                          </tr>
                        ))}
                        {importData.length > 20 && (
                          <tr><td colSpan={4} className="px-2 py-1 text-center text-text-muted">...and {importData.length - 20} more</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <Button className="w-full" onClick={handleImportSubmit} disabled={importing}>
                    {importing ? "Importing..." : `Import ${importData.length} Items`}
                  </Button>
                </div>
              )}

              {importResult && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-sm text-emerald-400">
                  <p className="font-medium">Import Complete!</p>
                  <p className="text-xs mt-1">{importResult.created} products created, {importResult.updated} updated. Stock sheet and inventory populated.</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { setShowImport(false); setImportData([]); setImportResult(null); }}>
                  {importResult ? "Done" : "Cancel"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== UNITS OF MEASURE TAB ==========
function UnitsTab() {
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [showConversion, setShowConversion] = useState(false);
  const [fromUnitId, setFromUnitId] = useState("");
  const [toUnitId, setToUnitId] = useState("");
  const [factor, setFactor] = useState("");

  const fetchUnits = async () => {
    try {
      const res = await fetch("/api/units");
      if (res.ok) {
        const data = await res.json();
        setUnits(data);
        try { localStorage.setItem("lipapoint-oc-units", JSON.stringify({ data, timestamp: Date.now() })); } catch {}
      }
    } catch {
      try {
        const raw = localStorage.getItem("lipapoint-oc-units");
        if (raw) { const { data } = JSON.parse(raw); setUnits(data); }
      } catch {}
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchUnits(); }, []);

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !abbreviation) return;
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, abbreviation }),
      });
      if (res.ok) {
        setName(""); setAbbreviation(""); setShowForm(false); fetchUnits();
      }
    } catch {
      if (!navigator.onLine) {
        const { saveOfflineAction, requestBackgroundSync } = await import("@/lib/offline-db");
        await saveOfflineAction("unit_create", { name, abbreviation });
        requestBackgroundSync();
        setName(""); setAbbreviation(""); setShowForm(false);
      }
    }
  };

  const handleCreateConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromUnitId || !toUnitId || !factor) return;
    const payload = { fromUnitId, toUnitId, factor: parseFloat(factor) };
    try {
      const res = await fetch("/api/units", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setFromUnitId(""); setToUnitId(""); setFactor(""); setShowConversion(false); fetchUnits();
      }
    } catch {
      if (!navigator.onLine) {
        const { saveOfflineAction, requestBackgroundSync } = await import("@/lib/offline-db");
        await saveOfflineAction("unit_conversion", payload);
        requestBackgroundSync();
        setFromUnitId(""); setToUnitId(""); setFactor(""); setShowConversion(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => setShowConversion(!showConversion)}>
          <ArrowUpDown className="h-4 w-4 mr-1" /> {showConversion ? "Cancel" : "Add Conversion"}
        </Button>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> {showForm ? "Cancel" : "Add Unit"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New Unit of Measure</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUnit} className="flex gap-3 items-end">
              <Input label="Name" placeholder="e.g. Packet" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input label="Abbreviation" placeholder="e.g. pkt" value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)} required />
              <Button type="submit">Create</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {showConversion && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unit Conversion</CardTitle>
            <CardDescription>Define how one unit converts to another (e.g., 1 Pack = 12 Packets)</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateConversion} className="flex gap-3 items-end flex-wrap">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">From Unit</label>
                <select value={fromUnitId} onChange={(e) => setFromUnitId(e.target.value)} className="h-10 rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary" required>
                  <option value="">Select...</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">= (factor) x</label>
                <Input type="number" step="any" placeholder="12" value={factor} onChange={(e) => setFactor(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">To Unit</label>
                <select value={toUnitId} onChange={(e) => setToUnitId(e.target.value)} className="h-10 rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary" required>
                  <option value="">Select...</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <Button type="submit">Save Conversion</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12"><Loader label="Loading..." className="py-4" /></div>
        ) : units.length === 0 ? (
          <p className="col-span-full text-center text-text-muted py-12">No units defined yet. Create your first unit above.</p>
        ) : units.map((unit) => (
          <Card key={unit.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-text-primary">{unit.name}</h3>
                  <p className="text-xs text-text-muted">{unit.abbreviation}</p>
                </div>
                <Badge variant="secondary">{unit.conversionsFrom.length} conversion{unit.conversionsFrom.length !== 1 ? "s" : ""}</Badge>
              </div>
              {unit.conversionsFrom.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-border pt-2">
                  {unit.conversionsFrom.map((c) => (
                    <p key={c.id} className="text-xs text-text-secondary">
                      1 {unit.abbreviation} = {c.factor} {c.toUnit.abbreviation}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ========== EXPENSES TAB ==========
const EXPENSES_PAGE_SIZE = 20;

function ExpensesTab() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split("T")[0], category: "", description: "", amount: "" });
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expensePage, setExpensePage] = useState(1);

  const categories = ["Rent", "Utilities", "Salaries", "Supplies", "Maintenance", "Transport", "Marketing", "Other"];

  const fetchExpenses = async () => {
    try {
      const res = await fetch("/api/expenses");
      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
        try { localStorage.setItem("lipapoint-oc-expenses", JSON.stringify({ data, timestamp: Date.now() })); } catch {}
      }
    } catch {
      try {
        const raw = localStorage.getItem("lipapoint-oc-expenses");
        if (raw) { const { data } = JSON.parse(raw); setExpenses(data); }
      } catch {}
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchExpenses(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ date: new Date().toISOString().split("T")[0], category: "", description: "", amount: "" });
        setShowForm(false); fetchExpenses();
      }
    } catch {
      if (!navigator.onLine) {
        const { saveOfflineAction, requestBackgroundSync } = await import("@/lib/offline-db");
        await saveOfflineAction("expense_add", form);
        requestBackgroundSync();
        setExpenses([...expenses, { id: `offline-${Date.now()}`, date: form.date, category: form.category, description: form.description, amount: parseFloat(form.amount) || 0, user: null }]);
        setForm({ date: new Date().toISOString().split("T")[0], category: "", description: "", amount: "" });
        setShowForm(false);
      }
    }
  };

  const filteredExpenses = expenses.filter((e) => {
    if (!expenseSearch) return true;
    const q = expenseSearch.toLowerCase();
    return e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
  });

  const expenseTotalPages = Math.ceil(filteredExpenses.length / EXPENSES_PAGE_SIZE);
  const paginatedExpenses = filteredExpenses.slice((expensePage - 1) * EXPENSES_PAGE_SIZE, expensePage * EXPENSES_PAGE_SIZE);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3 items-center flex-wrap">
          <Card className="max-w-xs">
            <CardContent className="p-4">
              <p className="text-xs text-text-muted">Total Expenses</p>
              <p className="text-xl font-bold text-red-400">{formatCurrency(totalExpenses)}</p>
            </CardContent>
          </Card>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input placeholder="Search expenses..." value={expenseSearch} onChange={(e) => { setExpenseSearch(e.target.value); setExpensePage(1); }} className="pl-9 w-48" />
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> {showForm ? "Cancel" : "Add Expense"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
              <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full h-10 rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary" required>
                  <option value="">Select...</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
              <div className="flex gap-2 items-end">
                <Input label="Amount (KES)" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                <Button type="submit" className="shrink-0">Add</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">By</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-12"><Loader label="Loading..." className="py-4" /></td></tr>
                ) : filteredExpenses.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-text-muted">No expenses recorded.</td></tr>
                ) : paginatedExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3 text-text-secondary text-xs">{new Date(exp.date).toLocaleDateString("en-KE")}</td>
                    <td className="px-4 py-3"><Badge variant="secondary">{exp.category}</Badge></td>
                    <td className="px-4 py-3 text-text-primary">{exp.description}</td>
                    <td className="px-4 py-3 text-text-secondary text-xs">{exp.user?.name || "-"}</td>
                    <td className="px-4 py-3 text-right font-medium text-red-400">{formatCurrency(exp.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={expensePage}
            totalPages={expenseTotalPages}
            onPageChange={setExpensePage}
            totalItems={filteredExpenses.length}
            pageSize={EXPENSES_PAGE_SIZE}
          />
        </CardContent>
      </Card>
    </div>
  );
}
