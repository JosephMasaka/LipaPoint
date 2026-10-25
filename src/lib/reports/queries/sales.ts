import { db } from "@/lib/db";
import type { ReportQuery, ReportParams } from "../types";
import { dateFilter, round2, dayKey, monthKey } from "../helpers";

/**
 * Sales report queries (spec §2 — 18 reports off one Order/OrderItem layer).
 *
 * Every query is tenant-scoped, date-range filterable and excludes cancelled
 * orders from sales totals (refunds are surfaced separately). Register keys
 * here must match the normalized ReportDefinition keys in the catalog.
 */

/** Tenant-scoped order filter: date range on createdAt, minus cancelled. */
function salesWhere(tenantId: string, params: ReportParams) {
  return {
    tenantId,
    ...dateFilter(params, "createdAt"),
    status: { not: "CANCELLED" as const },
  };
}

const customerName = (o: {
  customerName: string | null;
  customer?: { name: string } | null;
}) => o.customerName || o.customer?.name || "Walk-in";

/** Monday of the ISO week containing `d` (UTC). */
function weekStart(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  x.setUTCDate(x.getUTCDate() - day);
  return x;
}

type Bucket = { invoices: number; gross: number; returns: number; discounts: number; tax: number };

function emptyBucket(): Bucket {
  return { invoices: 0, gross: 0, returns: 0, discounts: 0, tax: 0 };
}

// ── Invoice Report ──────────────────────────────────────────────────────
const invoiceReport: ReportQuery = async (tenantId, params) => {
  const orders = await db.order.findMany({
    where: salesWhere(tenantId, params),
    include: { items: true, customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 500,
  });
  return {
    columns: [
      { key: "invoice", label: "Invoice No.", kind: "text" },
      { key: "date", label: "Date", kind: "date" },
      { key: "customer", label: "Customer", kind: "text" },
      { key: "items", label: "Items", kind: "number" },
      { key: "subtotal", label: "Subtotal", kind: "currency" },
      { key: "tax", label: "Tax", kind: "currency" },
      { key: "total", label: "Total", kind: "currency" },
      { key: "payment", label: "Payment", kind: "text" },
      { key: "status", label: "Status", kind: "text" },
    ],
    rows: orders.map((o) => ({
      invoice: o.orderNo,
      date: o.createdAt.toISOString(),
      customer: customerName(o),
      items: o.items.length,
      subtotal: round2(o.subtotal),
      tax: round2(o.taxAmount),
      total: round2(o.total),
      payment: o.paymentMethod,
      status: o.status,
    })),
  };
};

// ── Sales Detailed ──────────────────────────────────────────────────────
const salesDetailed: ReportQuery = async (tenantId, params) => {
  const orders = await db.order.findMany({
    where: salesWhere(tenantId, params),
    include: {
      items: { include: { product: { select: { name: true, sku: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 2000,
  });
  const rows: Record<string, string | number | null>[] = [];
  for (const o of orders) {
    for (const it of o.items) {
      rows.push({
        invoice: o.orderNo,
        date: o.createdAt.toISOString(),
        item: it.product?.name ?? "Item",
        qty: it.quantity,
        unitPrice: round2(it.unitPrice),
        lineTotal: round2(it.total),
        payment: o.paymentMethod,
      });
    }
  }
  return {
    columns: [
      { key: "invoice", label: "Invoice", kind: "text" },
      { key: "date", label: "Date", kind: "date" },
      { key: "item", label: "Item", kind: "text" },
      { key: "qty", label: "Qty", kind: "number" },
      { key: "unitPrice", label: "Unit Price", kind: "currency" },
      { key: "lineTotal", label: "Line Total", kind: "currency" },
      { key: "payment", label: "Payment", kind: "text" },
    ],
    rows,
    summary: { lines: rows.length },
  };
};

// ── Sales Summary (grouped by day) ──────────────────────────────────────
const salesSummary: ReportQuery = async (tenantId, params) => {
  const orders = await db.order.findMany({
    where: salesWhere(tenantId, params),
    select: { createdAt: true, total: true, discount: true, taxAmount: true, status: true },
  });
  const buckets = new Map<string, Bucket>();
  for (const o of orders) {
    const key = dayKey(o.createdAt);
    const b = buckets.get(key) ?? emptyBucket();
    if (o.status === "REFUNDED") {
      b.returns += o.total;
    } else {
      b.invoices += 1;
      b.gross += o.total;
      b.tax += o.taxAmount;
    }
    b.discounts += o.discount;
    buckets.set(key, b);
  }
  const rows = [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, b]) => ({
      period: day,
      invoices: b.invoices,
      grossSales: round2(b.gross),
      returns: round2(b.returns),
      discounts: round2(b.discounts),
      tax: round2(b.tax),
      netSales: round2(b.gross - b.returns),
    }));
  return {
    columns: [
      { key: "period", label: "Date", kind: "date" },
      { key: "invoices", label: "Invoices", kind: "number" },
      { key: "grossSales", label: "Gross Sales", kind: "currency" },
      { key: "returns", label: "Returns", kind: "currency" },
      { key: "discounts", label: "Discounts", kind: "currency" },
      { key: "tax", label: "Tax", kind: "currency" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
    ],
    rows,
  };
};

// ── Sales by Day ────────────────────────────────────────────────────────
const salesByDay: ReportQuery = async (tenantId, params) => {
  const orders = await db.order.findMany({
    where: salesWhere(tenantId, params),
    select: { createdAt: true, total: true, status: true, paymentMethod: true },
  });
  const buckets = new Map<string, { invoices: number; net: number; methods: Map<string, number> }>();
  for (const o of orders) {
    if (o.status === "REFUNDED") continue;
    const key = dayKey(o.createdAt);
    const b = buckets.get(key) ?? { invoices: 0, net: 0, methods: new Map<string, number>() };
    b.invoices += 1;
    b.net += o.total;
    b.methods.set(o.paymentMethod, (b.methods.get(o.paymentMethod) ?? 0) + 1);
    buckets.set(key, b);
  }
  const rows = [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, b]) => ({
      date: day,
      invoices: b.invoices,
      netSales: round2(b.net),
      paymentBreakdown: [...b.methods.entries()].map(([m, c]) => `${m}:${c}`).join(", "),
    }));
  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "invoices", label: "Invoices", kind: "number" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
      { key: "paymentBreakdown", label: "Payment Breakdown", kind: "text" },
    ],
    rows,
  };
};

// ── Sales by Week ───────────────────────────────────────────────────────
const salesByWeek: ReportQuery = async (tenantId, params) => {
  const orders = await db.order.findMany({
    where: salesWhere(tenantId, params),
    select: { createdAt: true, total: true, status: true },
  });
  const buckets = new Map<string, { invoices: number; net: number; ending: Date }>();
  for (const o of orders) {
    if (o.status === "REFUNDED") continue;
    const ws = weekStart(o.createdAt);
    const key = ws.toISOString().slice(0, 10);
    const b = buckets.get(key) ?? { invoices: 0, net: 0, ending: ws };
    b.invoices += 1;
    b.net += o.total;
    const ending = new Date(ws);
    ending.setUTCDate(ending.getUTCDate() + 6);
    b.ending = ending;
    buckets.set(key, b);
  }
  const rows = [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, b]) => ({
      weekEnding: b.ending.toISOString().slice(0, 10),
      invoices: b.invoices,
      netSales: round2(b.net),
    }));
  return {
    columns: [
      { key: "weekEnding", label: "Week Ending", kind: "date" },
      { key: "invoices", label: "Invoices", kind: "number" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
    ],
    rows,
  };
};

// ── Sales by Month ──────────────────────────────────────────────────────
const salesByMonth: ReportQuery = async (tenantId, params) => {
  const orders = await db.order.findMany({
    where: salesWhere(tenantId, params),
    select: { createdAt: true, total: true, status: true },
  });
  const buckets = new Map<string, { invoices: number; net: number }>();
  for (const o of orders) {
    if (o.status === "REFUNDED") continue;
    const key = monthKey(o.createdAt);
    const b = buckets.get(key) ?? { invoices: 0, net: 0 };
    b.invoices += 1;
    b.net += o.total;
    buckets.set(key, b);
  }
  const rows = [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, b]) => ({ month, invoices: b.invoices, netSales: round2(b.net) }));
  return {
    columns: [
      { key: "month", label: "Month", kind: "date" },
      { key: "invoices", label: "Invoices", kind: "number" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
    ],
    rows,
  };
};

// ── Sales by Hour ───────────────────────────────────────────────────────
const salesByHour: ReportQuery = async (tenantId, params) => {
  const orders = await db.order.findMany({
    where: salesWhere(tenantId, params),
    select: { createdAt: true, total: true, status: true },
  });
  const buckets = new Map<number, { invoices: number; net: number }>();
  for (const o of orders) {
    if (o.status === "REFUNDED") continue;
    const hour = o.createdAt.getUTCHours();
    const b = buckets.get(hour) ?? { invoices: 0, net: 0 };
    b.invoices += 1;
    b.net += o.total;
    buckets.set(hour, b);
  }
  const rows = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, b]) => ({
      hour: `${String(hour).padStart(2, "0")}:00`,
      invoices: b.invoices,
      netSales: round2(b.net),
    }));
  return {
    columns: [
      { key: "hour", label: "Hour", kind: "text" },
      { key: "invoices", label: "Invoices", kind: "number" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
    ],
    rows,
  };
};

// ── Sales by Item ───────────────────────────────────────────────────────
const salesByItem: ReportQuery = async (tenantId, params) => {
  const orderRows = await db.order.findMany({
    where: salesWhere(tenantId, params),
    include: { items: { include: { product: { select: { name: true } } } } },
  });
  const buckets = new Map<string, { qty: number; net: number }>();
  for (const o of orderRows) {
    if (o.status === "REFUNDED") continue;
    for (const it of o.items) {
      const name = it.product?.name ?? "Item";
      const b = buckets.get(name) ?? { qty: 0, net: 0 };
      b.qty += it.quantity;
      b.net += it.total;
      buckets.set(name, b);
    }
  }
  const rows = [...buckets.entries()]
    .sort((a, b) => b[1].net - a[1].net)
    .map(([item, b]) => ({ item, qty: b.qty, netSales: round2(b.net) }));
  return {
    columns: [
      { key: "item", label: "Item", kind: "text" },
      { key: "qty", label: "Qty Sold", kind: "number" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
    ],
    rows,
  };
};

// ── Sales by Customer ───────────────────────────────────────────────────
const salesByCustomer: ReportQuery = async (tenantId, params) => {
  const orders = await db.order.findMany({
    where: salesWhere(tenantId, params),
    include: { customer: { select: { name: true } } },
  });
  const buckets = new Map<string, { invoices: number; net: number; returns: number }>();
  for (const o of orders) {
    const name = customerName(o);
    const b = buckets.get(name) ?? { invoices: 0, net: 0, returns: 0 };
    if (o.status === "REFUNDED") b.returns += o.total;
    else {
      b.invoices += 1;
      b.net += o.total;
    }
    buckets.set(name, b);
  }
  const rows = [...buckets.entries()]
    .sort((a, b) => b[1].net - a[1].net)
    .map(([customer, b]) => ({
      customer,
      invoices: b.invoices,
      netSales: round2(b.net),
      returns: round2(b.returns),
    }));
  return {
    columns: [
      { key: "customer", label: "Customer", kind: "text" },
      { key: "invoices", label: "Invoices", kind: "number" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
      { key: "returns", label: "Returns", kind: "currency" },
    ],
    rows,
  };
};

// ── Sales by Payment Method ─────────────────────────────────────────────
const salesByPaymentMethod: ReportQuery = async (tenantId, params) => {
  const orders = await db.order.findMany({
    where: salesWhere(tenantId, params),
    select: { paymentMethod: true, total: true, status: true },
  });
  const buckets = new Map<string, { invoices: number; net: number }>();
  for (const o of orders) {
    if (o.status === "REFUNDED") continue;
    const b = buckets.get(o.paymentMethod) ?? { invoices: 0, net: 0 };
    b.invoices += 1;
    b.net += o.total;
    buckets.set(o.paymentMethod, b);
  }
  const rows = [...buckets.entries()]
    .sort((a, b) => b[1].net - a[1].net)
    .map(([paymentMethod, b]) => ({ paymentMethod, invoices: b.invoices, netSales: round2(b.net) }));
  return {
    columns: [
      { key: "paymentMethod", label: "Payment Method", kind: "text" },
      { key: "invoices", label: "Invoices", kind: "number" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
    ],
    rows,
  };
};

// ── Sales by Tax ────────────────────────────────────────────────────────
const salesByTax: ReportQuery = async (tenantId, params) => {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { taxRate: true } });
  const orders = await db.order.findMany({
    where: salesWhere(tenantId, params),
    select: { subtotal: true, taxAmount: true, status: true },
  });
  let taxable = 0;
  let collected = 0;
  for (const o of orders) {
    if (o.status === "REFUNDED") continue;
    taxable += o.subtotal;
    collected += o.taxAmount;
  }
  return {
    columns: [
      { key: "taxType", label: "Tax Type", kind: "text" },
      { key: "taxRate", label: "Tax Rate", kind: "text" },
      { key: "taxableSales", label: "Taxable Sales", kind: "currency" },
      { key: "taxCollected", label: "Tax Collected", kind: "currency" },
    ],
    rows: [
      {
        taxType: "VAT",
        taxRate: `${tenant?.taxRate ?? 16}%`,
        taxableSales: round2(taxable),
        taxCollected: round2(collected),
      },
    ],
  };
};

// ── Discount Report ─────────────────────────────────────────────────────
const discountReport: ReportQuery = async (tenantId, params) => {
  const orders = await db.order.findMany({
    where: { ...salesWhere(tenantId, params), discount: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 500,
  });
  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "description", label: "Invoice", kind: "text" },
      { key: "discountAmount", label: "Discount", kind: "currency" },
    ],
    rows: orders.map((o) => ({
      date: o.createdAt.toISOString(),
      description: o.orderNo,
      discountAmount: round2(o.discount),
    })),
    summary: { totalDiscount: round2(orders.reduce((s, o) => s + o.discount, 0)) },
  };
};

// ── Sales Return / Credit Sales Report ──────────────────────────────────
const salesReturnReport: ReportQuery = async (tenantId, params) => {
  const notes = await db.creditNote.findMany({
    where: { tenantId, ...dateFilter(params, "createdAt") },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 500,
  });
  return {
    columns: [
      { key: "creditNote", label: "Credit Note", kind: "text" },
      { key: "date", label: "Date", kind: "date" },
      { key: "customer", label: "Customer", kind: "text" },
      { key: "reason", label: "Reason", kind: "text" },
      { key: "amount", label: "Amount", kind: "currency" },
      { key: "status", label: "Status", kind: "text" },
    ],
    rows: notes.map((n) => ({
      creditNote: n.creditNoteNumber,
      date: n.createdAt.toISOString(),
      customer: n.customer?.name ?? "",
      reason: n.reason,
      amount: round2(n.amount),
      status: n.status,
    })),
    summary: { total: round2(notes.reduce((s, n) => s + n.amount, 0)) },
  };
};

// ── Unpaid Bills Report ─────────────────────────────────────────────────
const unpaidBills: ReportQuery = async (tenantId, params) => {
  const orders = await db.order.findMany({
    where: {
      tenantId,
      ...dateFilter(params, "createdAt"),
      status: { not: "CANCELLED" },
      paymentStatus: { not: "COMPLETED" },
      total: { gt: 0 },
    },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 500,
  });
  return {
    columns: [
      { key: "invoice", label: "Invoice", kind: "text" },
      { key: "customer", label: "Customer", kind: "text" },
      { key: "date", label: "Date", kind: "date" },
      { key: "amount", label: "Amount Due", kind: "currency" },
      { key: "status", label: "Status", kind: "text" },
    ],
    rows: orders.map((o) => ({
      invoice: o.orderNo,
      customer: customerName(o),
      date: o.createdAt.toISOString(),
      amount: round2(o.total),
      status: o.paymentStatus,
    })),
    summary: { totalDue: round2(orders.reduce((s, o) => s + o.total, 0)), count: orders.length },
  };
};

// ── Sales by Sales Rep ────────────────────────────────────────────────
const salesBySalesRep: ReportQuery = async (tenantId, params) => {
  const orders = await db.order.findMany({
    where: salesWhere(tenantId, params),
    select: {
      total: true,
      discount: true,
      user: { select: { name: true } },
    },
  });

  const buckets = new Map<string, { invoices: number; net: number; discounts: number }>();
  for (const o of orders) {
    const rep = o.user?.name || "Unknown";
    const b = buckets.get(rep) ?? { invoices: 0, net: 0, discounts: 0 };
    b.invoices += 1;
    b.net += o.total;
    b.discounts += o.discount;
    buckets.set(rep, b);
  }

  const rows = [...buckets.entries()]
    .map(([rep, b]) => ({
      rep,
      invoices: b.invoices,
      netSales: round2(b.net),
      discounts: round2(b.discounts),
    }))
    .sort((a, b) => b.netSales - a.netSales);

  return {
    columns: [
      { key: "rep", label: "Sales Rep", kind: "text" },
      { key: "invoices", label: "Invoices", kind: "number" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
      { key: "discounts", label: "Discounts", kind: "currency" },
    ],
    rows,
    summary: {
      reps: rows.length,
      invoices: rows.reduce((s, r) => s + r.invoices, 0),
      netSales: round2(rows.reduce((s, r) => s + r.netSales, 0)),
    },
  };
};

// ── Sales by Sales Rep per Day ─────────────────────────────────────────
const salesBySalesRepPerDay: ReportQuery = async (tenantId, params) => {
  const orders = await db.order.findMany({
    where: salesWhere(tenantId, params),
    select: {
      createdAt: true,
      total: true,
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const buckets = new Map<
    string,
    { date: string; rep: string; invoices: number; net: number }
  >();
  for (const o of orders) {
    const date = dayKey(o.createdAt);
    const rep = o.user?.name || "Unknown";
    const k = `${date}|${rep}`;
    const b = buckets.get(k) ?? { date, rep, invoices: 0, net: 0 };
    b.invoices += 1;
    b.net += o.total;
    buckets.set(k, b);
  }

  const rows = [...buckets.values()]
    .map((b) => ({
      date: b.date,
      rep: b.rep,
      invoices: b.invoices,
      netSales: round2(b.net),
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.rep.localeCompare(b.rep));

  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "rep", label: "Sales Rep", kind: "text" },
      { key: "invoices", label: "Invoices", kind: "number" },
      { key: "netSales", label: "Net Sales", kind: "currency" },
    ],
    rows,
    summary: {
      days: new Set(rows.map((r) => r.date)).size,
      netSales: round2(rows.reduce((s, r) => s + r.netSales, 0)),
    },
  };
};

// ── Items Sold Out of Set Price ────────────────────────────────────────
// There is no `overridePrice` column, so an override is derived by comparing
// the price actually charged on the line against the product's (or its
// selling UoM's) set price. Any line-level deviation — the "bargain pricing"
// feature — surfaces here.
const itemsSoldOutOfSetPrice: ReportQuery = async (tenantId, params) => {
  const orders = await db.order.findMany({
    where: salesWhere(tenantId, params),
    select: {
      orderNo: true,
      createdAt: true,
      user: { select: { name: true } },
      items: {
        select: {
          unitPrice: true,
          product: { select: { name: true, price: true } },
          productUom: { select: { price: true } },
        },
      },
    },
    take: params.limit ?? 2000,
  });

  const rows: Record<string, string | number | null>[] = [];
  for (const o of orders) {
    for (const item of o.items) {
      if (!item.product) continue;
      const setPrice = item.productUom?.price ?? item.product.price;
      const variance = round2(item.unitPrice - setPrice);
      if (variance === 0) continue;
      rows.push({
        date: o.createdAt.toISOString(),
        invoiceNumber: o.orderNo,
        item: item.product.name,
        setPrice: round2(setPrice),
        soldPrice: round2(item.unitPrice),
        variance,
        cashier: o.user?.name || "Unknown",
      });
    }
  }
  rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "invoiceNumber", label: "Invoice", kind: "text" },
      { key: "item", label: "Item", kind: "text" },
      { key: "setPrice", label: "Set Price", kind: "currency" },
      { key: "soldPrice", label: "Sold At", kind: "currency" },
      { key: "variance", label: "Variance", kind: "currency" },
      { key: "cashier", label: "Cashier", kind: "text" },
    ],
    rows,
    summary: { lines: rows.length, orders: orders.length },
  };
};

// ── Sales Complementary ──────────────────────────────────────────────
// Comped sales carry an explicit COMPLIMENTARY payment method — never
// inferred from a zero price (reports-spec §2).
const salesComplementary: ReportQuery = async (tenantId, params) => {
  const orders = await db.order.findMany({
    where: { ...salesWhere(tenantId, params), paymentMethod: "COMPLIMENTARY" },
    select: {
      orderNo: true,
      createdAt: true,
      subtotal: true,
      taxAmount: true,
      items: { select: { quantity: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 500,
  });

  const rows = orders.map((o) => ({
    date: o.createdAt.toISOString(),
    invoiceNumber: o.orderNo,
    items: o.items.reduce((s, i) => s + i.quantity, 0),
    // Value given away: subtotal at list price plus the tax on it.
    listValue: round2(o.subtotal + o.taxAmount),
    cashier: o.user?.name || "Unknown",
  }));

  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "invoiceNumber", label: "Invoice", kind: "text" },
      { key: "items", label: "Items", kind: "number" },
      { key: "listValue", label: "List Value", kind: "currency" },
      { key: "cashier", label: "Cashier", kind: "text" },
    ],
    rows,
    summary: {
      compedOrders: rows.length,
      listValue: round2(rows.reduce((s, r) => s + r.listValue, 0)),
    },
  };
};

/** Sales reports keyed by normalized report key. */
export const SALES_QUERIES: Record<string, ReportQuery> = {
  sales_by_sales_rep: salesBySalesRep,
  sales_by_sales_rep_per_day: salesBySalesRepPerDay,
  items_sold_out_of_set_price: itemsSoldOutOfSetPrice,
  sales_complementary: salesComplementary,
  invoice_report: invoiceReport,
  sales_detailed: salesDetailed,
  sales_summary: salesSummary,
  sales_by_day: salesByDay,
  sales_by_week: salesByWeek,
  sales_by_month: salesByMonth,
  sales_by_hour: salesByHour,
  sales_by_item: salesByItem,
  sales_by_customer: salesByCustomer,
  sales_by_payment_method: salesByPaymentMethod,
  sales_by_tax: salesByTax,
  discount_report: discountReport,
  sales_return_report: salesReturnReport,
  unpaid_bills: unpaidBills,
};