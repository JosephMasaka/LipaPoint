import { db } from "@/lib/db";
import type { ReportQuery } from "../types";
import { dateFilter, round2 } from "../helpers";

/**
 * Stock report queries (spec §5). Reads Product/Stock (on-hand), StockMovement
 * (adjustments), GRN (receipts) and OrderItem (what sold).
 *
 * Stock queries are wired against StockMovement / StockRecord / GRN /
 * ProductPriceHistory, which are the spec's data models for this section.
 */

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  price: number;
  cost: number;
  lowStockAlert: number;
  trackStock: boolean;
  isActive: boolean;
  category: { name: string } | null;
  stocks: { quantity: number }[];
};

function loadProducts(tenantId: string): Promise<ProductRow[]> {
  return db.product.findMany({
    where: { tenantId },
    include: {
      category: { select: { name: true } },
      stocks: { select: { quantity: true } },
    },
  }) as unknown as Promise<ProductRow[]>;
}

const onHand = (p: ProductRow) => p.stocks.reduce((s, x) => s + x.quantity, 0);

// ── Stock Report (detailed & summary) ───────────────────────────────────
const stockReport: ReportQuery = async (tenantId) => {
  const products = await loadProducts(tenantId);
  const rows = products.map((p) => {
    const qty = onHand(p);
    return {
      sku: p.sku,
      name: p.name,
      category: p.category?.name ?? "",
      onHand: qty,
      costPrice: round2(p.cost),
      sellingPrice: round2(p.price),
      stockValue: round2(qty * p.cost),
    };
  });
  return {
    columns: [
      { key: "sku", label: "SKU", kind: "text" },
      { key: "name", label: "Item", kind: "text" },
      { key: "category", label: "Category", kind: "text" },
      { key: "onHand", label: "On Hand", kind: "number" },
      { key: "costPrice", label: "Cost Price", kind: "currency" },
      { key: "sellingPrice", label: "Selling Price", kind: "currency" },
      { key: "stockValue", label: "Stock Value", kind: "currency" },
    ],
    rows,
    summary: { items: rows.length, totalValue: round2(rows.reduce((s, r) => s + (r.stockValue as number), 0)) },
  };
};

// ── Stock Report by Department ──────────────────────────────────────────
const stockByDepartment: ReportQuery = async (tenantId) => {
  const products = await loadProducts(tenantId);
  const buckets = new Map<string, { items: number; qty: number; value: number }>();
  for (const p of products) {
    const dept = p.category?.name ?? "Uncategorised";
    const b = buckets.get(dept) ?? { items: 0, qty: 0, value: 0 };
    const qty = onHand(p);
    b.items += 1;
    b.qty += qty;
    b.value += qty * p.cost;
    buckets.set(dept, b);
  }
  const rows = [...buckets.entries()]
    .sort((a, b) => b[1].value - a[1].value)
    .map(([department, b]) => ({
      department,
      itemCount: b.items,
      totalQuantity: b.qty,
      totalValue: round2(b.value),
    }));
  return {
    columns: [
      { key: "department", label: "Department", kind: "text" },
      { key: "itemCount", label: "Items", kind: "number" },
      { key: "totalQuantity", label: "Total Qty", kind: "number" },
      { key: "totalValue", label: "Total Value", kind: "currency" },
    ],
    rows,
  };
};

// ── Stock Valuation (cost & selling price) ──────────────────────────────
const stockValuation: ReportQuery = async (tenantId) => {
  const products = await loadProducts(tenantId);
  const rows = products.map((p) => {
    const qty = onHand(p);
    const totalCost = round2(qty * p.cost);
    const totalSelling = round2(qty * p.price);
    return {
      item: p.name,
      onHand: qty,
      totalCost,
      totalSelling,
      margin: round2(totalSelling - totalCost),
    };
  });
  return {
    columns: [
      { key: "item", label: "Item", kind: "text" },
      { key: "onHand", label: "On Hand", kind: "number" },
      { key: "totalCost", label: "Total Cost", kind: "currency" },
      { key: "totalSelling", label: "Total Selling", kind: "currency" },
      { key: "margin", label: "Margin", kind: "currency" },
    ],
    rows,
    summary: {
      totalCost: round2(rows.reduce((s, r) => s + (r.totalCost as number), 0)),
      totalSelling: round2(rows.reduce((s, r) => s + (r.totalSelling as number), 0)),
    },
  };
};

// ── Re-order Points ─────────────────────────────────────────────────────
const reorderPoints: ReportQuery = async (tenantId) => {
  const products = await loadProducts(tenantId);
  const rows = products
    .filter((p) => p.trackStock && p.isActive && onHand(p) <= p.lowStockAlert)
    .map((p) => {
      const qty = onHand(p);
      return {
        sku: p.sku,
        name: p.name,
        onHand: qty,
        reorderLevel: p.lowStockAlert,
        reorderQty: Math.max(p.lowStockAlert - qty, 0),
      };
    })
    .sort((a, b) => a.onHand - b.onHand);
  return {
    columns: [
      { key: "sku", label: "SKU", kind: "text" },
      { key: "name", label: "Item", kind: "text" },
      { key: "onHand", label: "On Hand", kind: "number" },
      { key: "reorderLevel", label: "Reorder Level", kind: "number" },
      { key: "reorderQty", label: "Suggested Qty", kind: "number" },
    ],
    rows,
    summary: { belowReorder: rows.length },
  };
};

// ── Stock Received (GRN) ────────────────────────────────────────────────
const stockReceived: ReportQuery = async (tenantId, params) => {
  const grns = await db.goodsReceivedNote.findMany({
    where: { tenantId, ...dateFilter(params, "receivedDate") },
    include: {
      items: { include: { product: { select: { name: true } } } },
      purchaseOrder: { include: { supplier: { select: { name: true } } } },
    },
    orderBy: { receivedDate: "desc" },
    take: params.limit ?? 500,
  });
  const rows: Record<string, string | number | null>[] = [];
  for (const g of grns) {
    for (const it of g.items) {
      rows.push({
        grnNumber: g.grnNumber,
        supplier: g.purchaseOrder?.supplier?.name ?? "",
        item: it.product?.name ?? it.description,
        receivedDate: g.receivedDate.toISOString(),
        quantity: it.quantity,
        unitCost: round2(it.unitCost),
        totalCost: round2(it.quantity * it.unitCost),
      });
    }
  }
  return {
    columns: [
      { key: "grnNumber", label: "GRN", kind: "text" },
      { key: "supplier", label: "Supplier", kind: "text" },
      { key: "item", label: "Item", kind: "text" },
      { key: "receivedDate", label: "Received", kind: "date" },
      { key: "quantity", label: "Qty", kind: "number" },
      { key: "unitCost", label: "Unit Cost", kind: "currency" },
      { key: "totalCost", label: "Total Cost", kind: "currency" },
    ],
    rows,
    summary: { grns: grns.length },
  };
};

// ── Items Not Sold ──────────────────────────────────────────────────────
const itemsNotSold: ReportQuery = async (tenantId, params) => {
  const sold = await db.orderItem.findMany({
    where: { order: { tenantId, ...dateFilter(params, "createdAt") } },
    select: { productId: true },
  });
  const soldIds = new Set(sold.map((s) => s.productId));
  const products = await loadProducts(tenantId);
  const rows = products
    .filter((p) => p.isActive && p.trackStock && !soldIds.has(p.id))
    .map((p) => ({
      sku: p.sku,
      name: p.name,
      category: p.category?.name ?? "",
      stockOnHand: onHand(p),
      lastCost: round2(p.cost),
    }));
  return {
    columns: [
      { key: "sku", label: "SKU", kind: "text" },
      { key: "name", label: "Item", kind: "text" },
      { key: "category", label: "Category", kind: "text" },
      { key: "stockOnHand", label: "On Hand", kind: "number" },
      { key: "lastCost", label: "Last Cost", kind: "currency" },
    ],
    rows,
    summary: { count: rows.length },
  };
};

// ── Stock Adjustment ────────────────────────────────────────────────────
const stockAdjustment: ReportQuery = async (tenantId, params) => {
  const moves = await db.stockMovement.findMany({
    where: { tenantId, type: "ADJUSTMENT", ...dateFilter(params, "createdAt") },
    include: {
      product: { select: { name: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 500,
  });
  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "item", label: "Item", kind: "text" },
      { key: "reason", label: "Reason", kind: "text" },
      { key: "quantity", label: "Qty Change", kind: "number" },
      { key: "adjustedBy", label: "Adjusted By", kind: "text" },
    ],
    rows: moves.map((m) => ({
      date: m.createdAt.toISOString(),
      item: m.product?.name ?? "",
      reason: m.notes ?? m.reference ?? "",
      quantity: m.quantity,
      adjustedBy: m.user?.name ?? "system",
    })),
    summary: { count: moves.length },
  };
};

// ── Stock Transferred ──────────────────────────────────────────────────
// A transfer is recorded as paired StockMovement rows sharing one reference:
// out at the source location, in at the destination. A single-row reference
// has no matching leg yet, so its destination shows as "—".
const stockTransferred: ReportQuery = async (tenantId, params) => {
  const moves = await db.stockMovement.findMany({
    where: { tenantId, type: "TRANSFER", ...dateFilter(params, "createdAt") },
    select: {
      quantity: true,
      createdAt: true,
      reference: true,
      location: { select: { name: true } },
      product: { select: { name: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
    take: params.limit ?? 500,
  });

  const groups: (typeof moves)[] = [];
  const byReference = new Map<string, number>();
  moves.forEach((m, i) => {
    const key = m.reference || `row-${i}`;
    const idx = byReference.get(key);
    if (idx === undefined) {
      byReference.set(key, groups.length);
      groups.push([m]);
    } else {
      groups[idx].push(m);
    }
  });

  const rows = groups.map((g) => {
    const first = g[0];
    const last = g[g.length - 1];
    return {
      date: first.createdAt.toISOString(),
      item: first.product?.name || "—",
      fromLocation: first.location?.name || "—",
      toLocation: g.length > 1 ? last.location?.name || "—" : "—",
      quantity: first.quantity,
      reference: first.reference || "",
      transferredBy: first.user?.name || "system",
    };
  });

  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "item", label: "Item", kind: "text" },
      { key: "fromLocation", label: "From", kind: "text" },
      { key: "toLocation", label: "To", kind: "text" },
      { key: "quantity", label: "Quantity", kind: "number" },
      { key: "reference", label: "Reference", kind: "text" },
      { key: "transferredBy", label: "Transferred By", kind: "text" },
    ],
    rows,
    summary: { transfers: rows.length, movements: moves.length },
  };
};

// ── Physical Stock-Take ────────────────────────────────────────────────
// `StockRecord.closingStock` holds the counted figure and `variance` is
// counted − book, so a count is any record where the variance or a manual
// adjustment was written.
const physicalStockTake: ReportQuery = async (tenantId, params) => {
  const records = await db.stockRecord.findMany({
    where: {
      tenantId,
      ...dateFilter(params, "date"),
      // Only lines the stock-take flow actually counted — the whole count
      // sheet, not just the rows that happened to drift.
      countedAt: { not: null },
    },
    select: {
      date: true,
      openingStock: true,
      addedStock: true,
      soldStock: true,
      closingStock: true,
      notes: true,
      product: { select: { name: true } },
      location: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: params.limit ?? 500,
  });

  const rows = records.map((r) => {
    const book = r.openingStock + r.addedStock - r.soldStock;
    // closingStock holds the counted figure, exactly as /api/stock derives
    // its on-the-fly variance — so counted and book agree with the sheet.
    const counted = r.closingStock;
    return {
      countDate: r.date.toISOString(),
      item: r.product?.name || "—",
      bookQuantity: book,
      countedQuantity: counted,
      variance: counted - book,
      location: r.location?.name || "—",
      notes: r.notes || "",
    };
  });

  return {
    columns: [
      { key: "countDate", label: "Count Date", kind: "date" },
      { key: "item", label: "Item", kind: "text" },
      { key: "bookQuantity", label: "Book Qty", kind: "number" },
      { key: "countedQuantity", label: "Counted Qty", kind: "number" },
      { key: "variance", label: "Variance", kind: "number" },
      { key: "location", label: "Location", kind: "text" },
      { key: "notes", label: "Notes", kind: "text" },
    ],
    rows,
    summary: {
      lines: rows.length,
      variance: rows.reduce((s, r) => s + (r.variance as number), 0),
    },
  };
};

// ── Purchased by Item ──────────────────────────────────────────────────
const purchasedByItem: ReportQuery = async (tenantId, params) => {
  const grns = await db.goodsReceivedNote.findMany({
    where: { tenantId, ...dateFilter(params, "receivedDate") },
    select: {
      receivedDate: true,
      purchaseOrder: { select: { supplier: { select: { name: true } } } },
      items: {
        select: {
          quantity: true,
          unitCost: true,
          description: true,
          product: { select: { id: true, name: true, sku: true } },
        },
      },
    },
    take: params.limit ?? 500,
  });

  const buckets = new Map<
    string,
    {
      item: string;
      sku: string;
      suppliers: Set<string>;
      qty: number;
      cost: number;
      last: Date;
    }
  >();

  for (const g of grns) {
    const supplier = g.purchaseOrder?.supplier?.name || "Unknown";
    for (const li of g.items) {
      const key = li.product?.id || `desc:${li.description}`;
      const b = buckets.get(key) ?? {
        item: li.product?.name || li.description,
        sku: li.product?.sku || "",
        suppliers: new Set<string>(),
        qty: 0,
        cost: 0,
        last: new Date(0),
      };
      b.suppliers.add(supplier);
      b.qty += li.quantity;
      b.cost += li.quantity * li.unitCost;
      if (g.receivedDate > b.last) b.last = g.receivedDate;
      buckets.set(key, b);
    }
  }

  const rows = [...buckets.values()]
    .map((b) => ({
      item: b.item,
      sku: b.sku,
      supplier: b.suppliers.size === 1 ? [...b.suppliers][0] : "Multiple",
      quantityPurchased: b.qty,
      totalCost: round2(b.cost),
      lastPurchased: b.last.toISOString(),
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  return {
    columns: [
      { key: "item", label: "Item", kind: "text" },
      { key: "sku", label: "SKU", kind: "text" },
      { key: "supplier", label: "Supplier", kind: "text" },
      { key: "quantityPurchased", label: "Qty Purchased", kind: "number" },
      { key: "totalCost", label: "Total Cost", kind: "currency" },
      { key: "lastPurchased", label: "Last Purchased", kind: "date" },
    ],
    rows,
    summary: {
      items: rows.length,
      totalCost: round2(rows.reduce((s, r) => s + r.totalCost, 0)),
    },
  };
};

// ── Price Change ──────────────────────────────────────────────────────────
// Reads the append-only ProductPriceHistory log written by the product
// update route whenever a product's selling price moves.
const priceChange: ReportQuery = async (tenantId, params) => {
  const history = await db.productPriceHistory.findMany({
    where: { tenantId, ...dateFilter(params, "createdAt") },
    select: {
      createdAt: true,
      previousPrice: true,
      newPrice: true,
      changedById: true,
      product: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 500,
  });

  const userIds = [
    ...new Set(history.map((h) => h.changedById).filter((v): v is string => !!v)),
  ];
  const users = userIds.length
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "item", label: "Item", kind: "text" },
      { key: "previousPrice", label: "Previous Price", kind: "currency" },
      { key: "newPrice", label: "New Price", kind: "currency" },
      { key: "changedBy", label: "Changed By", kind: "text" },
    ],
    rows: history.map((h) => ({
      date: h.createdAt.toISOString(),
      item: h.product?.name || "—",
      previousPrice: round2(h.previousPrice),
      newPrice: round2(h.newPrice),
      changedBy: (h.changedById && nameById.get(h.changedById)) || "system",
    })),
    summary: { changes: history.length },
  };
};

// ── Stock Expiry ──────────────────────────────────────────────────────
// Reads StockBatch lots written by the GRN receive flow. daysToExpiry goes
// negative for stock already past its date.
const stockExpiry: ReportQuery = async (tenantId, params) => {
  const batches = await db.stockBatch.findMany({
    where: { tenantId, ...dateFilter(params, "expiryDate") },
    select: {
      batchNumber: true,
      expiryDate: true,
      quantity: true,
      product: { select: { name: true } },
      location: { select: { name: true } },
    },
    orderBy: { expiryDate: "asc" },
    take: params.limit ?? 500,
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const DAY = 86_400_000;

  const rows = batches.map((b) => ({
    item: b.product?.name || "—",
    batch: b.batchNumber || "—",
    expiryDate: b.expiryDate.toISOString().slice(0, 10),
    quantityOnHand: b.quantity,
    daysToExpiry: Math.round((b.expiryDate.getTime() - today.getTime()) / DAY),
    location: b.location?.name || "—",
  }));

  const expired = rows.filter((r) => (r.daysToExpiry as number) < 0).length;
  const expiringSoon = rows.filter((r) => {
    const d = r.daysToExpiry as number;
    return d >= 0 && d <= 30;
  }).length;

  return {
    columns: [
      { key: "item", label: "Item", kind: "text" },
      { key: "batch", label: "Batch", kind: "text" },
      { key: "expiryDate", label: "Expiry Date", kind: "date" },
      { key: "quantityOnHand", label: "On Hand", kind: "number" },
      { key: "daysToExpiry", label: "Days to Expiry", kind: "number" },
      { key: "location", label: "Location", kind: "text" },
    ],
    rows,
    summary: { lots: rows.length, expired, expiringSoon },
  };
};

export const STOCK_QUERIES: Record<string, ReportQuery> = {
  stock_report: stockReport,
  stock_by_department: stockByDepartment,
  stock_valuation: stockValuation,
  reorder_points: reorderPoints,
  stock_received: stockReceived,
  items_not_sold: itemsNotSold,
  stock_adjustment: stockAdjustment,
  stock_transferred: stockTransferred,
  physical_stock_take: physicalStockTake,
  purchased_by_item: purchasedByItem,
  price_change: priceChange,
  stock_expiry: stockExpiry,
};