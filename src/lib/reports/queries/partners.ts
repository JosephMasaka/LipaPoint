import { db } from "@/lib/db";
import type { ReportQuery } from "../types";
import { dateFilter, round2 } from "../helpers";

/**
 * Customer + Supplier report queries (spec §4.7 CRM, §4.6 Procurement):
 * statements (running ledger), balances, and supplier invoice views.
 */

const customerName = (o: {
  customerName: string | null;
  customer?: { name: string } | null;
}) => o.customerName || o.customer?.name || "Walk-in";

// ── Customer Statement (detailed) ───────────────────────────────────────
const customerStatement: ReportQuery = async (tenantId, params) => {
  const [orders, notes] = await Promise.all([
    db.order.findMany({
      where: { tenantId, ...dateFilter(params, "createdAt"), status: { not: "CANCELLED" } },
      include: { customer: { select: { name: true } } },
    }),
    db.creditNote.findMany({
      where: { tenantId, ...dateFilter(params, "createdAt") },
      include: { customer: { select: { name: true } } },
    }),
  ]);

  type Entry = { customer: string; date: Date; ref: string; type: string; amount: number };
  const entries: Entry[] = [
    ...orders.map((o) => ({
      customer: customerName(o),
      date: o.createdAt,
      ref: o.orderNo,
      type: "Sale",
      amount: o.total,
    })),
    ...notes.map((n) => ({
      customer: n.customer?.name ?? "",
      date: n.createdAt,
      ref: n.creditNoteNumber,
      type: "Credit",
      amount: -n.amount,
    })),
  ];

  // Running balance per customer, then flatten ordered by customer + date.
  const byCustomer = new Map<string, Entry[]>();
  for (const e of entries) {
    if (!byCustomer.has(e.customer)) byCustomer.set(e.customer, []);
    byCustomer.get(e.customer)!.push(e);
  }

  const rows: Record<string, string | number | null>[] = [];
  for (const [customer, list] of [...byCustomer.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
    let balance = 0;
    for (const e of list) {
      balance += e.amount;
      rows.push({
        date: e.date.toISOString(),
        customer,
        reference: e.ref,
        type: e.type,
        amount: round2(e.amount),
        balance: round2(balance),
      });
    }
  }

  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "customer", label: "Customer", kind: "text" },
      { key: "reference", label: "Reference", kind: "text" },
      { key: "type", label: "Type", kind: "text" },
      { key: "amount", label: "Amount", kind: "currency" },
      { key: "balance", label: "Balance", kind: "currency" },
    ],
    rows,
    summary: { entries: rows.length },
  };
};

// ── Customer Balance (detailed) ─────────────────────────────────────────
const customerBalance: ReportQuery = async (tenantId, params) => {
  const orders = await db.order.findMany({
    where: { tenantId, ...dateFilter(params, "createdAt"), status: { not: "CANCELLED" } },
    include: { customer: { select: { name: true } } },
  });

  const buckets = new Map<string, { invoiced: number; paid: number; due: number }>();
  for (const o of orders) {
    const name = customerName(o);
    const b = buckets.get(name) ?? { invoiced: 0, paid: 0, due: 0 };
    b.invoiced += o.total;
    if (o.paymentStatus === "COMPLETED") b.paid += o.total;
    else b.due += o.total;
    buckets.set(name, b);
  }

  const rows = [...buckets.entries()]
    .sort((a, b) => b[1].due - a[1].due)
    .map(([customer, b]) => ({
      customer,
      totalInvoices: round2(b.invoiced),
      totalPayments: round2(b.paid),
      balance: round2(b.due),
    }));

  return {
    columns: [
      { key: "customer", label: "Customer", kind: "text" },
      { key: "totalInvoices", label: "Invoices", kind: "currency" },
      { key: "totalPayments", label: "Payments", kind: "currency" },
      { key: "balance", label: "Balance", kind: "currency" },
    ],
    rows,
    summary: { totalDue: round2(rows.reduce((s, r) => s + (r.balance as number), 0)) },
  };
};

// ── Supplier Statement ──────────────────────────────────────────────────
const supplierStatement: ReportQuery = async (tenantId, params) => {
  const [invoices, payments] = await Promise.all([
    db.supplierInvoice.findMany({
      where: { tenantId, ...dateFilter(params, "createdAt") },
      include: { supplier: { select: { name: true } } },
    }),
    db.supplierPayment.findMany({
      where: { tenantId, ...dateFilter(params, "paidAt") },
      include: { supplier: { select: { name: true } } },
    }),
  ]);

  type Entry = { supplier: string; date: Date; ref: string; type: string; amount: number };
  const entries: Entry[] = [
    ...invoices.map((i) => ({
      supplier: i.supplier?.name ?? "",
      date: i.createdAt,
      ref: i.invoiceNumber,
      type: "Invoice",
      amount: i.amount,
    })),
    ...payments.map((p) => ({
      supplier: p.supplier?.name ?? "",
      date: p.paidAt,
      ref: p.reference ?? "",
      type: "Payment",
      amount: -p.amount,
    })),
  ];

  const bySupplier = new Map<string, Entry[]>();
  for (const e of entries) {
    if (!bySupplier.has(e.supplier)) bySupplier.set(e.supplier, []);
    bySupplier.get(e.supplier)!.push(e);
  }

  const rows: Record<string, string | number | null>[] = [];
  for (const [supplier, list] of [...bySupplier.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
    let balance = 0;
    for (const e of list) {
      balance += e.amount;
      rows.push({
        date: e.date.toISOString(),
        supplier,
        reference: e.ref,
        type: e.type,
        amount: round2(e.amount),
        balance: round2(balance),
      });
    }
  }

  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "supplier", label: "Supplier", kind: "text" },
      { key: "reference", label: "Reference", kind: "text" },
      { key: "type", label: "Type", kind: "text" },
      { key: "amount", label: "Amount", kind: "currency" },
      { key: "balance", label: "Balance", kind: "currency" },
    ],
    rows,
    summary: { entries: rows.length },
  };
};

// ── Supplier Unpaid Invoices ────────────────────────────────────────────
const supplierUnpaidInvoices: ReportQuery = async (tenantId, params) => {
  const invoices = await db.supplierInvoice.findMany({
    where: { tenantId, ...dateFilter(params, "createdAt"), status: { not: "paid" } },
    include: { supplier: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
  });

  const now = Date.now();
  const rows = invoices.map((i) => {
    const outstanding = round2(i.amount - i.paidAmount);
    const days = i.dueDate
      ? Math.max(0, Math.floor((now - i.dueDate.getTime()) / 86400000))
      : null;
    return {
      invoiceNumber: i.invoiceNumber,
      supplier: i.supplier?.name ?? "",
      dueDate: i.dueDate ? i.dueDate.toISOString() : "",
      amount: outstanding,
      daysOutstanding: days,
    };
  });

  return {
    columns: [
      { key: "invoiceNumber", label: "Invoice", kind: "text" },
      { key: "supplier", label: "Supplier", kind: "text" },
      { key: "dueDate", label: "Due Date", kind: "date" },
      { key: "amount", label: "Outstanding", kind: "currency" },
      { key: "daysOutstanding", label: "Days Outstanding", kind: "number" },
    ],
    rows,
    summary: { totalOutstanding: round2(rows.reduce((s, r) => s + (r.amount as number), 0)) },
  };
};

// ── Supplier Invoice Received ───────────────────────────────────────────
const supplierInvoiceReceived: ReportQuery = async (tenantId, params) => {
  const invoices = await db.supplierInvoice.findMany({
    where: { tenantId, ...dateFilter(params, "createdAt") },
    include: {
      supplier: { select: { name: true } },
      purchaseOrder: { include: { grns: { select: { grnNumber: true, receivedDate: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 500,
  });

  const rows = invoices.map((i) => {
    const grn = i.purchaseOrder?.grns?.[0];
    return {
      invoiceNumber: i.invoiceNumber,
      supplier: i.supplier?.name ?? "",
      grnReference: grn?.grnNumber ?? i.purchaseOrder?.poNumber ?? "",
      receivedDate: grn ? grn.receivedDate.toISOString() : "",
      amount: round2(i.amount),
      status: i.status,
    };
  });

  return {
    columns: [
      { key: "invoiceNumber", label: "Invoice", kind: "text" },
      { key: "supplier", label: "Supplier", kind: "text" },
      { key: "grnReference", label: "GRN / PO", kind: "text" },
      { key: "receivedDate", label: "Received", kind: "date" },
      { key: "amount", label: "Amount", kind: "currency" },
      { key: "status", label: "Status", kind: "text" },
    ],
    rows,
    summary: { count: rows.length },
  };
};

// ── Customer Balance by Department ─────────────────────────────────────
// Same outstanding-balance maths as customer_balance, grouped by the
// Customer.department dimension (reports-spec §3).
const customerBalanceByDepartment: ReportQuery = async (tenantId, params) => {
  const [orders, customers] = await Promise.all([
    db.order.findMany({
      where: { tenantId, ...dateFilter(params, "createdAt"), status: { not: "CANCELLED" } },
      select: {
        total: true,
        paymentStatus: true,
        customerId: true,
        customerName: true,
        customer: { select: { name: true, department: true } },
      },
    }),
    // Most POS sales carry a name rather than a customer id — fall back to
    // the name so historical orders still group under their department.
    db.customer.findMany({ where: { tenantId }, select: { name: true, department: true } }),
  ]);

  const departmentByName = new Map(
    customers.map((c) => [c.name, (c.department ?? "").trim()])
  );

  const buckets = new Map<string, { customers: Set<string>; due: number }>();
  for (const o of orders) {
    const department =
      o.customer?.department?.trim() ||
      (o.customerName ? departmentByName.get(o.customerName) : "") ||
      "Unassigned";
    const b = buckets.get(department) ?? { customers: new Set<string>(), due: 0 };
    if (o.customerId && o.customer?.name) b.customers.add(o.customer.name);
    if (o.paymentStatus !== "COMPLETED") b.due += o.total;
    buckets.set(department, b);
  }

  const rows = [...buckets.entries()]
    .map(([department, b]) => ({
      department,
      customers: b.customers.size,
      closingBalance: round2(b.due),
    }))
    .sort((a, b) => b.closingBalance - a.closingBalance);

  return {
    columns: [
      { key: "department", label: "Department", kind: "text" },
      { key: "customers", label: "Customers", kind: "number" },
      { key: "closingBalance", label: "Closing Balance", kind: "currency" },
    ],
    rows,
    summary: {
      departments: rows.length,
      totalDue: round2(rows.reduce((s, r) => s + r.closingBalance, 0)),
    },
  };
};

// ── Withholding Tax by Customer ───────────────────────────────────────
// Reads Order.whtAmount — the rate snapshotted onto the invoice when it was
// raised (from Customer.whtRate), never re-derived from today's rate.
const withholdingTaxByCustomer: ReportQuery = async (tenantId, params) => {
  const orders = await db.order.findMany({
    where: {
      tenantId,
      ...dateFilter(params, "createdAt"),
      status: { not: "CANCELLED" },
      whtAmount: { gt: 0 },
    },
    select: {
      total: true,
      whtRate: true,
      whtAmount: true,
      customerName: true,
      customer: { select: { name: true } },
    },
  });

  const buckets = new Map<string, { gross: number; wht: number; rates: number[] }>();
  for (const o of orders) {
    const name = o.customer?.name || o.customerName || "Walk-in";
    const b = buckets.get(name) ?? { gross: 0, wht: 0, rates: [] };
    b.gross += o.total;
    b.wht += o.whtAmount;
    if (!b.rates.includes(o.whtRate)) b.rates.push(o.whtRate);
    buckets.set(name, b);
  }

  const rows = [...buckets.entries()]
    .map(([customer, b]) => {
      const rates = [...b.rates].sort((x, y) => x - y);
      return {
        customer,
        grossAmount: round2(b.gross),
        whtRate:
          rates.length === 1
            ? `${rates[0]}%`
            : `${rates[0]}%–${rates[rates.length - 1]}%`,
        whtAmount: round2(b.wht),
        netPaid: round2(b.gross - b.wht),
      };
    })
    .sort((a, b) => b.whtAmount - a.whtAmount);

  return {
    columns: [
      { key: "customer", label: "Customer", kind: "text" },
      { key: "grossAmount", label: "Gross Amount", kind: "currency" },
      { key: "whtRate", label: "WHT Rate", kind: "text" },
      { key: "whtAmount", label: "WHT Withheld", kind: "currency" },
      { key: "netPaid", label: "Net Paid", kind: "currency" },
    ],
    rows,
    summary: {
      customers: rows.length,
      grossAmount: round2(rows.reduce((s, r) => s + r.grossAmount, 0)),
      whtAmount: round2(rows.reduce((s, r) => s + r.whtAmount, 0)),
    },
  };
};

export const PARTNER_QUERIES: Record<string, ReportQuery> = {
  customer_statement: customerStatement,
  customer_balance: customerBalance,
  customer_balance_by_department: customerBalanceByDepartment,
  withholding_tax_by_customer: withholdingTaxByCustomer,
  supplier_statement: supplierStatement,
  supplier_unpaid_invoices: supplierUnpaidInvoices,
  supplier_invoice_received: supplierInvoiceReceived,
};