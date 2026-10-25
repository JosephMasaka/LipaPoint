import { db } from "@/lib/db";
import type { ReportQuery } from "../types";
import { dateFilter, round2 } from "../helpers";

/**
 * Cash / Bank / Cashier report queries (spec §4). Reads BankAccount/
 * BankTransaction, gateway Transaction, and DailySummary (cashier tills).
 *
 * `cheques_received` and `transfer_report` read BankTransaction's reporting
 * `category` column (`cheque` / `transfer`), recorded from the Banking
 * page's Record Transaction form.
 */

// ── Cash / Bank Statement (detailed) ────────────────────────────────────
const cashBankStatement: ReportQuery = async (tenantId, params) => {
  const txns = await db.bankTransaction.findMany({
    where: { tenantId, ...dateFilter(params, "date") },
    include: { bankAccount: { select: { name: true } } },
    orderBy: { date: "asc" },
    take: params.limit ?? 1000,
  });
  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "bankAccount", label: "Account", kind: "text" },
      { key: "reference", label: "Reference", kind: "text" },
      { key: "description", label: "Description", kind: "text" },
      { key: "direction", label: "Direction", kind: "text" },
      { key: "amount", label: "Amount", kind: "currency" },
      { key: "reconciled", label: "Reconciled", kind: "text" },
    ],
    rows: txns.map((t) => ({
      date: t.date.toISOString(),
      bankAccount: t.bankAccount?.name ?? "",
      reference: t.reference ?? "",
      description: t.description ?? "",
      direction: t.direction,
      amount: round2(t.amount),
      reconciled: t.reconciled ? "Yes" : "No",
    })),
    summary: { transactions: txns.length },
  };
};

// ── Cash / Bank Summary ─────────────────────────────────────────────────
const cashBankSummary: ReportQuery = async (tenantId, params) => {
  const accounts = await db.bankAccount.findMany({
    where: { tenantId, isActive: true },
    include: {
      transactions: {
        where: { ...dateFilter(params, "date") },
        select: { amount: true, direction: true },
      },
    },
  });

  const rows = accounts.map((a) => {
    let receipts = 0;
    let payments = 0;
    for (const t of a.transactions) {
      if (t.direction === "in") receipts += t.amount;
      else payments += t.amount;
    }
    const closing = a.openingBalance + receipts - payments;
    return {
      bankAccount: a.name,
      openingBalance: round2(a.openingBalance),
      totalReceipts: round2(receipts),
      totalPayments: round2(payments),
      closingBalance: round2(closing),
    };
  });

  return {
    columns: [
      { key: "bankAccount", label: "Account", kind: "text" },
      { key: "openingBalance", label: "Opening", kind: "currency" },
      { key: "totalReceipts", label: "Receipts", kind: "currency" },
      { key: "totalPayments", label: "Payments", kind: "currency" },
      { key: "closingBalance", label: "Closing", kind: "currency" },
    ],
    rows,
    summary: {
      closingTotal: round2(rows.reduce((s, r) => s + (r.closingBalance as number), 0)),
    },
  };
};

// ── M-Pesa / Card / PDQ Report ──────────────────────────────────────────
const mpesaCardPdq: ReportQuery = async (tenantId, params) => {
  const txns = await db.transaction.findMany({
    where: {
      tenantId,
      method: { in: ["MPESA_STK", "MPESA_MANUAL", "CARD", "PDQ"] },
      ...dateFilter(params, "createdAt"),
    },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 1000,
  });
  const totalAmount = round2(txns.reduce((s, t) => s + t.amount, 0));

  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "paymentMethod", label: "Method", kind: "text" },
      { key: "reference", label: "Reference", kind: "text" },
      { key: "amount", label: "Amount", kind: "currency" },
      { key: "status", label: "Status", kind: "text" },
    ],
    rows: txns.map((t) => ({
      date: t.createdAt.toISOString(),
      paymentMethod: t.method,
      reference: t.reference ?? "",
      amount: round2(t.amount),
      status: t.status,
    })),
    summary: { count: txns.length, totalAmount },
  };
};

/** Shared DailySummary loader for the three cashier reports. */
async function loadDailySummaries(tenantId: string, params: { from?: string; to?: string; limit?: number }) {
  return db.dailySummary.findMany({
    where: { tenantId, ...dateFilter(params as never, "date") },
    include: {
      user: { select: { name: true } },
      location: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: params.limit ?? 500,
  });
}

// ── Cashier Cash / Prints Report ────────────────────────────────────────
const cashierCashPrint: ReportQuery = async (tenantId, params) => {
  const sums = await loadDailySummaries(tenantId, params);
  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "cashier", label: "Cashier", kind: "text" },
      { key: "openingFloat", label: "Opening Float", kind: "currency" },
      { key: "closingCash", label: "Closing Cash", kind: "currency" },
    ],
    rows: sums.map((s) => ({
      date: s.date.toISOString(),
      cashier: s.user?.name ?? "—",
      openingFloat: round2(s.cashBroughtForward),
      closingCash: round2(s.cashCarriedForward),
    })),
    summary: { shifts: sums.length },
  };
};

// ── Cashier Shortage / Over Report ──────────────────────────────────────
const cashierShortage: ReportQuery = async (tenantId, params) => {
  const sums = await loadDailySummaries(tenantId, params);
  const shortages = sums.filter((s) => s.shortExcess !== 0);
  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "cashier", label: "Cashier", kind: "text" },
      { key: "expectedCash", label: "Expected", kind: "currency" },
      { key: "actualCash", label: "Actual", kind: "currency" },
      { key: "variance", label: "Variance", kind: "currency" },
    ],
    rows: shortages.map((s) => ({
      date: s.date.toISOString(),
      cashier: s.user?.name ?? "—",
      expectedCash: round2(s.totalCash),
      actualCash: round2(s.cashSurrendered),
      variance: round2(s.shortExcess),
    })),
    summary: {
      shortages: shortages.length,
      netVariance: round2(shortages.reduce((sum, s) => sum + s.shortExcess, 0)),
    },
  };
};

// ── Cash Collection from Cashiers ───────────────────────────────────────
const cashCollection: ReportQuery = async (tenantId, params) => {
  const sums = await loadDailySummaries(tenantId, params).then((list) =>
    list.filter((s) => s.cashSurrendered !== 0)
  );
  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "cashier", label: "Cashier", kind: "text" },
      { key: "amountCollected", label: "Amount Collected", kind: "currency" },
      { key: "reference", label: "Location", kind: "text" },
    ],
    rows: sums.map((s) => ({
      date: s.date.toISOString(),
      cashier: s.user?.name ?? "—",
      amountCollected: round2(s.cashSurrendered),
      reference: s.location?.name ?? "",
    })),
    summary: { totalCollected: round2(sums.reduce((sum, s) => sum + s.cashSurrendered, 0)) },
  };
};

// ── Cheques Received ──────────────────────────────────────────────────────
const chequesReceived: ReportQuery = async (tenantId, params) => {
  const txns = await db.bankTransaction.findMany({
    where: {
      tenantId,
      category: "cheque",
      direction: "in",
      ...dateFilter(params, "date"),
    },
    include: { bankAccount: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: params.limit ?? 500,
  });
  return {
    columns: [
      { key: "chequeNumber", label: "Cheque No.", kind: "text" },
      { key: "customer", label: "Customer", kind: "text" },
      { key: "date", label: "Date", kind: "date" },
      { key: "amount", label: "Amount", kind: "currency" },
      { key: "bank", label: "Bank", kind: "text" },
      { key: "status", label: "Status", kind: "text" },
    ],
    rows: txns.map((t) => ({
      chequeNumber: t.chequeNumber || t.reference || "—",
      customer: t.counterparty || t.description || "—",
      date: t.date.toISOString(),
      amount: round2(t.amount),
      bank: t.bankAccount.name,
      status: t.reconciled ? "Reconciled" : "Pending",
    })),
    summary: {
      cheques: txns.length,
      totalAmount: round2(txns.reduce((s, t) => s + t.amount, 0)),
      unreconciled: txns.filter((t) => !t.reconciled).length,
    },
  };
};

// ── Transfer Report ──────────────────────────────────────────────────────
const transferReport: ReportQuery = async (tenantId, params) => {
  const [txns, wallets] = await Promise.all([
    db.bankTransaction.findMany({
      where: { tenantId, category: "transfer", ...dateFilter(params, "date") },
      include: { bankAccount: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: params.limit ?? 500,
    }),
    db.bankAccount.findMany({
      where: { tenantId },
      select: { name: true, coaAccount: { select: { code: true } } },
    }),
  ]);

  const walletByCode = new Map<string, string>();
  for (const w of wallets) {
    if (w.coaAccount?.code) walletByCode.set(w.coaAccount.code, w.name);
  }
  const accountName = (code: string | null) =>
    !code ? "—" : walletByCode.get(code) ?? code;

  const rows = txns.map((t) => ({
    date: t.date.toISOString(),
    // Outward leg: this wallet is the source. Inward leg: it is the destination.
    fromAccount:
      t.direction === "out" ? t.bankAccount.name : accountName(t.counterAccountCode),
    toAccount:
      t.direction === "out" ? accountName(t.counterAccountCode) : t.bankAccount.name,
    amount: round2(t.amount),
    reference: t.reference || "",
  }));

  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "fromAccount", label: "From", kind: "text" },
      { key: "toAccount", label: "To", kind: "text" },
      { key: "amount", label: "Amount", kind: "currency" },
      { key: "reference", label: "Reference", kind: "text" },
    ],
    rows,
    summary: {
      transfers: rows.length,
      totalAmount: round2(rows.reduce((s, r) => s + r.amount, 0)),
    },
  };
};

export const CASHBANK_QUERIES: Record<string, ReportQuery> = {
  cash_bank_statement: cashBankStatement,
  cash_bank_summary: cashBankSummary,
  mpesa_card_pdq_report: mpesaCardPdq,
  cashier_cash_print_report: cashierCashPrint,
  cashier_shortage_report: cashierShortage,
  cash_collection_from_cashiers: cashCollection,
  cheques_received: chequesReceived,
  transfer_report: transferReport,
};