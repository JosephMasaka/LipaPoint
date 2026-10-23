"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { Pagination } from "@/components/pagination";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Plus, X, CheckCircle, AlertCircle, ArrowLeft, FileText,
  Send, Ban, Check, PackageCheck, Receipt, CreditCard, Trash2, ChevronDown,
} from "lucide-react";

interface SupplierOption {
  id: string;
  name: string;
}

interface POItem {
  id: string;
  description: string;
  quantity: number;
  unitCost: number;
  receivedQty: number;
}

interface GRNLine {
  id: string;
  description: string;
  quantity: number;
  unitCost: number;
}

interface GRN {
  id: string;
  grnNumber: string;
  receivedDate: string;
  notes: string | null;
  items: GRNLine[];
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: string;
  subtotal: number;
  total: number;
  expectedDate: string | null;
  notes: string | null;
  createdAt: string;
  supplier: { id: string; name: string };
  items: POItem[];
}

interface PurchaseOrderDetail extends PurchaseOrder {
  supplier: { id: string; name: string; phone: string | null; balance: number; paymentTerms: string | null };
  grns: GRN[];
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  paidAmount: number;
  status: string;
  dueDate: string | null;
  poId: string | null;
  supplierId: string;
  payments: { id: string; amount: number; paidAt: string; method: string }[];
}

interface BankOption {
  id: string;
  name: string;
  type: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  draft: "secondary",
  sent: "default",
  partially_received: "warning",
  received: "success",
  closed: "secondary",
  cancelled: "destructive",
};

const INVOICE_STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  unpaid: "warning",
  partial: "default",
  paid: "success",
};

const STATUS_FILTERS = ["all", "draft", "sent", "partially_received", "received", "closed", "cancelled"];

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankOption[]>([]);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ supplierId: "", expectedDate: "", notes: "" });
  const [formItems, setFormItems] = useState([{ description: "", quantity: 1, unitCost: 0 }]);
  const [error, setError] = useState("");

  // Detail
  const [detail, setDetail] = useState<PurchaseOrderDetail | null>(null);
  const [detailInvoices, setDetailInvoices] = useState<Invoice[]>([]);
  const [showReceive, setShowReceive] = useState(false);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({});
  const [receiveNotes, setReceiveNotes] = useState("");
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ invoiceNumber: "", amount: 0, dueDate: "" });
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [payForm, setPayForm] = useState({ amount: 0, method: "bank", bankAccountId: "", reference: "" });

  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const openedFromUrl = useRef(false);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchOrders = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/purchase-orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.purchaseOrders);
        setPagination(data.pagination);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => fetchOrders(1), statusFilter === "all" ? 0 : 200);
    return () => clearTimeout(timer);
  }, [fetchOrders, statusFilter]);

  // Supplier + wallet options, plus deep link from the Suppliers screen.
  useEffect(() => {
    fetch("/api/suppliers?limit=100")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSuppliers(d.suppliers))
      .catch(() => {});
    fetch("/api/bank-accounts")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => Array.isArray(d) && setBankAccounts(d))
      .catch(() => {});
    const deepLinkId = new URLSearchParams(window.location.search).get("id");
    if (deepLinkId && !openedFromUrl.current) {
      openedFromUrl.current = true;
      openDetail(deepLinkId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/purchase-orders/${id}`);
      if (!res.ok) {
        notify("error", "Purchase order not found");
        return;
      }
      const po: PurchaseOrderDetail = await res.json();
      setDetail(po);
      setShowReceive(false);
      setShowInvoice(false);
      setPayTarget(null);
      const invRes = await fetch(`/api/supplier-invoices?supplierId=${po.supplier.id}&limit=100`);
      if (invRes.ok) {
        const invData = await invRes.json();
        setDetailInvoices(invData.invoices.filter((inv: Invoice) => inv.poId === po.id));
      } else {
        setDetailInvoices([]);
      }
    } catch {
      notify("error", "Failed to load purchase order");
    }
  };

  const refreshDetail = () => detail && openDetail(detail.id);

  // ── Create ──
  const formTotal = formItems.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitCost || 0), 0);

  const setFormItem = (index: number, patch: Partial<(typeof formItems)[number]>) => {
    setFormItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const items = formItems
      .filter((item) => item.description.trim())
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
      }));
    if (!form.supplierId) {
      setError("Choose a supplier");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one line item");
      return;
    }
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: form.supplierId,
          expectedDate: form.expectedDate ? new Date(form.expectedDate).toISOString() : null,
          notes: form.notes || null,
          items,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Error");
        return;
      }
      const po = await res.json();
      setShowForm(false);
      setForm({ supplierId: "", expectedDate: "", notes: "" });
      setFormItems([{ description: "", quantity: 1, unitCost: 0 }]);
      fetchOrders(1);
      notify("success", `${po.poNumber} created`);
      openDetail(po.id);
    } catch {
      setError("Network error");
    }
  };

  // ── Lifecycle actions ──
  const changeStatus = async (status: string) => {
    if (!detail) return;
    try {
      const res = await fetch(`/api/purchase-orders/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json();
        notify("error", d.error || "Action failed");
        return;
      }
      notify("success", `PO ${status.replace(/_/g, " ")}`);
      refreshDetail();
      fetchOrders(pagination.page);
    } catch {
      notify("error", "Network error");
    }
  };

  // ── Receive ──
  const openReceive = () => {
    if (!detail) return;
    const qtys: Record<string, number> = {};
    for (const item of detail.items) {
      const remaining = item.quantity - item.receivedQty;
      if (remaining > 0) qtys[item.id] = remaining;
    }
    setReceiveQtys(qtys);
    setReceiveNotes("");
    setShowReceive(true);
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    const items = Object.entries(receiveQtys)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([poItemId, quantity]) => ({ poItemId, quantity: Number(quantity) }));
    if (items.length === 0) {
      notify("error", "Enter a quantity for at least one line");
      return;
    }
    try {
      const res = await fetch(`/api/purchase-orders/${detail.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, notes: receiveNotes || null }),
      });
      if (!res.ok) {
        const d = await res.json();
        notify("error", d.error || "Receipt failed");
        return;
      }
      setShowReceive(false);
      notify("success", "Goods received — stock updated");
      refreshDetail();
      fetchOrders(pagination.page);
    } catch {
      notify("error", "Network error");
    }
  };

  // ── Invoice ──
  const handleRecordInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    try {
      const res = await fetch("/api/supplier-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: detail.supplier.id,
          poId: detail.id,
          invoiceNumber: invoiceForm.invoiceNumber,
          amount: Number(invoiceForm.amount),
          dueDate: invoiceForm.dueDate ? new Date(invoiceForm.dueDate).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        notify("error", d.error || "Failed to record invoice");
        return;
      }
      setShowInvoice(false);
      setInvoiceForm({ invoiceNumber: "", amount: 0, dueDate: "" });
      notify("success", "Invoice recorded — GL posted");
      refreshDetail();
    } catch {
      notify("error", "Network error");
    }
  };

  // ── Pay ──
  const openPay = (inv: Invoice) => {
    setPayForm({
      amount: Number((inv.amount - inv.paidAmount).toFixed(2)),
      method: "bank",
      bankAccountId: "",
      reference: "",
    });
    setPayTarget(inv);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    try {
      const res = await fetch(`/api/supplier-invoices/${payTarget.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(payForm.amount),
          method: payForm.method,
          bankAccountId: payForm.bankAccountId || undefined,
          reference: payForm.reference || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        notify("error", d.error || "Payment failed");
        return;
      }
      setPayTarget(null);
      notify("success", "Payment recorded — AP settled");
      refreshDetail();
    } catch {
      notify("error", "Network error");
    }
  };

  // ── Detail view ──
  if (detail) {
    const canSend = detail.status === "draft";
    const canReceive = ["sent", "partially_received"].includes(detail.status);
    const canClose = ["sent", "partially_received", "received"].includes(detail.status);
    const canCancel = ["draft", "sent"].includes(detail.status);

    return (
      <div className="min-h-screen bg-surface">
        <Header title="Purchase Order" subtitle={detail.poNumber} />
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          <Button variant="outline" onClick={() => { setDetail(null); setDetailInvoices([]); fetchOrders(pagination.page); }} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Purchase Orders
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[detail.status] ?? "secondary"} className="text-sm">
              {detail.status.replace(/_/g, " ")}
            </Badge>
            <span className="text-xs text-text-muted">Created {fmtDate(detail.createdAt)}</span>
            {detail.expectedDate && (
              <span className="text-xs text-text-muted">· Expected {fmtDate(detail.expectedDate)}</span>
            )}
            <div className="flex-1" />
            {canSend && (
              <Button size="sm" onClick={() => changeStatus("sent")} className="gap-1.5">
                <Send className="h-3.5 w-3.5" /> Mark Sent
              </Button>
            )}
            {canReceive && (
              <Button size="sm" variant="outline" onClick={openReceive} className="gap-1.5">
                <PackageCheck className="h-3.5 w-3.5" /> Receive Goods
              </Button>
            )}
            {detail.status !== "closed" && detail.status !== "draft" && canClose && (
              <Button size="sm" variant="outline" onClick={() => changeStatus("closed")} className="gap-1.5">
                <Check className="h-3.5 w-3.5" /> Close PO
              </Button>
            )}
            {canCancel && (
              <Button size="sm" variant="outline" onClick={() => changeStatus("cancelled")} className="gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10">
                <Ban className="h-3.5 w-3.5" /> Cancel
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-gold/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-text-primary">{detail.poNumber}</h3>
                    <p className="text-xs text-text-muted">{detail.supplier.name}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-border space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Subtotal</span>
                    <span className="font-medium text-text-primary">{formatCurrency(detail.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Total</span>
                    <span className="font-bold text-text-primary">{formatCurrency(detail.total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Supplier balance</span>
                    <span className={cn("font-medium", detail.supplier.balance > 0 ? "text-red-400" : "text-emerald-400")}>
                      {formatCurrency(detail.supplier.balance)}
                    </span>
                  </div>
                </div>
                {detail.notes && <p className="text-xs text-text-muted italic pt-2 border-t border-border">{detail.notes}</p>}

                {showReceive && (
                  <form onSubmit={handleReceive} className="pt-3 border-t border-border space-y-3">
                    <p className="text-xs font-semibold text-text-secondary uppercase">Receive goods</p>
                    {detail.items.map((item) => {
                      const remaining = item.quantity - item.receivedQty;
                      if (remaining <= 0) return null;
                      return (
                        <div key={item.id} className="flex items-center justify-between gap-2">
                          <span className="text-xs text-text-secondary truncate">{item.description}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              min={0}
                              max={remaining}
                              className="w-16 h-8 rounded-lg bg-surface-elevated border border-border px-2 text-xs text-text-primary"
                              value={receiveQtys[item.id] ?? 0}
                              onChange={(e) =>
                                setReceiveQtys((q) => ({ ...q, [item.id]: Math.max(0, Math.min(remaining, Number(e.target.value))) }))
                              }
                            />
                            <span className="text-[10px] text-text-muted">/ {remaining}</span>
                          </div>
                        </div>
                      );
                    })}
                    <Input
                      label="Notes"
                      placeholder="Delivery note reference..."
                      value={receiveNotes}
                      onChange={(e) => setReceiveNotes(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setShowReceive(false)}>Cancel</Button>
                      <Button type="submit" className="flex-1 gap-1.5">
                        <PackageCheck className="h-4 w-4" /> Receive
                      </Button>
                    </div>
                  </form>
                )}

                {showInvoice && (
                  <form onSubmit={handleRecordInvoice} className="pt-3 border-t border-border space-y-3">
                    <p className="text-xs font-semibold text-text-secondary uppercase">Record supplier invoice</p>
                    <Input
                      label="Invoice Number"
                      placeholder="INV-Coke-001"
                      value={invoiceForm.invoiceNumber}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                      required
                    />
                    <Input
                      label="Amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={invoiceForm.amount || ""}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: Number(e.target.value) })}
                      required
                    />
                    <Input
                      label="Due date"
                      type="date"
                      value={invoiceForm.dueDate}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setShowInvoice(false)}>Cancel</Button>
                      <Button type="submit" className="flex-1 gap-1.5">
                        <Receipt className="h-4 w-4" /> Record
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardContent className="p-0">
                  <div className="px-4 py-3 border-b border-border">
                    <h4 className="text-sm font-semibold text-text-primary">Line Items</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[500px]">
                      <thead>
                        <tr className="border-b border-border bg-surface-elevated/50">
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Item</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase">Ordered</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase">Received</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase">Unit Cost</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {detail.items.map((item) => (
                          <tr key={item.id} className="hover:bg-surface-hover/50">
                            <td className="px-4 py-2.5 text-text-primary">{item.description}</td>
                            <td className="px-4 py-2.5 text-right text-text-secondary">{item.quantity}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={cn(item.receivedQty >= item.quantity ? "text-emerald-400" : item.receivedQty > 0 ? "text-amber-400" : "text-text-muted")}>
                                {item.receivedQty}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-text-secondary">{formatCurrency(item.unitCost)}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-text-primary">
                              {formatCurrency(item.quantity * item.unitCost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-0">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-text-primary">Supplier Invoices for this PO</h4>
                    {["received", "partially_received", "closed"].includes(detail.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => {
                          setInvoiceForm({ invoiceNumber: "", amount: detail.total, dueDate: "" });
                          setShowInvoice(true);
                          setShowReceive(false);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" /> Record Invoice
                      </Button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[550px]">
                      <thead>
                        <tr className="border-b border-border bg-surface-elevated/50">
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Invoice</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase">Amount</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase">Outstanding</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {detailInvoices.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-6 text-center text-text-muted">No invoices recorded against this PO yet.</td></tr>
                        ) : detailInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-surface-hover/50">
                            <td className="px-4 py-2.5 font-mono text-xs text-text-primary">{inv.invoiceNumber}</td>
                            <td className="px-4 py-2.5 text-right text-text-primary">{formatCurrency(inv.amount)}</td>
                            <td className="px-4 py-2.5 text-right text-text-secondary">
                              {formatCurrency(Math.max(0, inv.amount - inv.paidAmount))}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant={INVOICE_STATUS_VARIANT[inv.status] ?? "secondary"}>{inv.status}</Badge>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {inv.status !== "paid" ? (
                                <Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => openPay(inv)}>
                                  <CreditCard className="h-3 w-3" /> Pay
                                </Button>
                              ) : (
                                <span className="text-xs text-emerald-400">Settled</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-0">
                  <div className="px-4 py-3 border-b border-border">
                    <h4 className="text-sm font-semibold text-text-primary">Goods Received ({detail.grns.length})</h4>
                  </div>
                  <div className="divide-y divide-border">
                    {detail.grns.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-text-muted">Nothing received yet.</p>
                    ) : detail.grns.map((grn) => (
                      <div key={grn.id} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-text-primary">{grn.grnNumber}</span>
                          <span className="text-xs text-text-muted">{fmtDate(grn.receivedDate)}</span>
                        </div>
                        <p className="text-xs text-text-secondary mt-1">
                          {grn.items.map((l) => `${l.quantity} × ${l.description}`).join(", ")}
                        </p>
                        {grn.notes && <p className="text-[11px] text-text-muted italic mt-0.5">{grn.notes}</p>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Pay modal */}
          {payTarget && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPayTarget(null)} />
              <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <h3 className="text-lg font-bold text-text-primary">Pay {payTarget.invoiceNumber}</h3>
                  <button onClick={() => setPayTarget(null)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <form onSubmit={handlePay} className="p-4 space-y-4">
                  <p className="text-xs text-text-muted">
                    Outstanding: <span className="font-semibold text-text-secondary">{formatCurrency(Math.max(0, payTarget.amount - payTarget.paidAmount))}</span>
                  </p>
                  <Input
                    label="Amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={payForm.amount || ""}
                    onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })}
                    required
                  />
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1.5 block">Method</label>
                    <div className="grid grid-cols-4 gap-2">
                      {["bank", "cash", "mpesa", "cheque"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPayForm({ ...payForm, method: m })}
                          className={cn(
                            "h-9 rounded-lg border text-xs capitalize transition-colors",
                            payForm.method === m
                              ? "border-gold/50 bg-gold/10 text-gold"
                              : "border-border bg-surface-elevated text-text-secondary hover:text-text-primary"
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                      Wallet {payForm.method !== "cash" && <span className="text-text-muted">(optional — defaults per method)</span>}
                    </label>
                    <select
                      className="w-full h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                      value={payForm.bankAccountId}
                      onChange={(e) => setPayForm({ ...payForm, bankAccountId: e.target.value })}
                    >
                      <option value="">Default account for {payForm.method}</option>
                      {bankAccounts.map((acct) => (
                        <option key={acct.id} value={acct.id}>{acct.name}</option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="Reference"
                    placeholder="Cheque no. / M-Pesa ref"
                    value={payForm.reference}
                    onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
                  />
                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setPayTarget(null)}>Cancel</Button>
                    <Button type="submit" className="flex-1 gap-1.5">
                      <CreditCard className="h-4 w-4" /> Record Payment
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="min-h-screen bg-surface relative overflow-x-hidden">
      {notification && (
        <div className={cn("fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm", notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400")}>
          {notification.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <Header title="Purchase Orders" subtitle="PO → goods received → supplier invoice → payment" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize",
                  statusFilter === status
                    ? "bg-gold/10 text-gold border border-gold/30"
                    : "bg-surface-elevated text-text-secondary border border-border hover:text-text-primary"
                )}
              >
                {status.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2 w-fit">
            <Plus className="h-4 w-4" /> New Purchase Order
          </Button>
        </div>

        {showForm && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
            <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface z-10">
                <h3 className="text-lg font-bold text-text-primary">New Purchase Order</h3>
                <button onClick={() => setShowForm(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-surface-hover text-text-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="p-4 space-y-4">
                {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Supplier</label>
                  <select
                    className="w-full h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                    value={form.supplierId}
                    onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                    required
                  >
                    <option value="">Select supplier…</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-text-secondary">Line items</label>
                    <button
                      type="button"
                      onClick={() => setFormItems((items) => [...items, { description: "", quantity: 1, unitCost: 0 }])}
                      className="text-xs text-gold hover:underline flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add line
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formItems.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          className="col-span-12 sm:col-span-6 h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary placeholder:text-text-muted"
                          placeholder="Description (e.g. 500ml Coke crate)"
                          value={item.description}
                          onChange={(e) => setFormItem(index, { description: e.target.value })}
                        />
                        <input
                          type="number"
                          min="1"
                          className="col-span-4 sm:col-span-2 h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                          value={item.quantity}
                          onChange={(e) => setFormItem(index, { quantity: Number(e.target.value) })}
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="col-span-5 sm:col-span-3 h-10 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-text-primary"
                          value={item.unitCost}
                          onChange={(e) => setFormItem(index, { unitCost: Number(e.target.value) })}
                        />
                        <button
                          type="button"
                          onClick={() => setFormItems((items) => (items.length > 1 ? items.filter((_, i) => i !== index) : items))}
                          className="col-span-3 sm:col-span-1 h-10 rounded-xl flex items-center justify-center text-text-muted hover:text-red-400"
                          title="Remove line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-4 mt-3 pt-3 border-t border-border text-sm">
                    <span className="text-text-secondary">PO total</span>
                    <span className="font-bold text-text-primary">{formatCurrency(formTotal)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Expected delivery"
                    type="date"
                    value={form.expectedDate}
                    onChange={(e) => setForm({ ...form, expectedDate: e.target.value })}
                  />
                  <Input
                    label="Notes"
                    placeholder="Anything the supplier should know"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1 gap-1.5">
                    <FileText className="h-4 w-4" /> Create PO
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-border bg-surface-elevated/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">PO</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Supplier</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Progress</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-12"><Loader label="Loading purchase orders..." className="py-4" /></td></tr>
                  ) : orders.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-text-muted">
                      {statusFilter !== "all" ? `No ${statusFilter.replace(/_/g, " ")} purchase orders.` : "No purchase orders yet. Create your first PO to buy stock from a supplier."}
                    </td></tr>
                  ) : orders.map((po) => {
                    const received = po.items.reduce((sum, item) => sum + item.receivedQty, 0);
                    const ordered = po.items.reduce((sum, item) => sum + item.quantity, 0);
                    return (
                      <tr key={po.id} className="hover:bg-surface-hover/50 transition-colors cursor-pointer" onClick={() => openDetail(po.id)}>
                        <td className="px-4 py-3 font-mono text-xs font-medium text-text-primary">{po.poNumber}</td>
                        <td className="px-4 py-3 font-medium text-text-primary">{po.supplier.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 rounded-full bg-surface-elevated overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", received >= ordered ? "bg-emerald-500" : "bg-gold")}
                                style={{ width: `${ordered > 0 ? Math.round((received / ordered) * 100) : 0}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-text-muted">{received}/{ordered}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-text-primary">{formatCurrency(po.total)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_VARIANT[po.status] ?? "secondary"}>{po.status.replace(/_/g, " ")}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-muted">{fmtDate(po.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-text-muted">
                            <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              pageSize={pagination.limit}
              onPageChange={(page) => fetchOrders(page)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
