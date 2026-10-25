import { db } from "@/lib/db";
import type { ReportParams, ReportResult, ReportQuery } from "./types";
import { dateFilter, asNum, round2 } from "./helpers";
import { SALES_QUERIES } from "./queries/sales";
import { FINANCE_QUERIES } from "./queries/finance";
import { STOCK_QUERIES } from "./queries/stock";
import { PARTNER_QUERIES } from "./queries/partners";
import { BACKOFFICE_QUERIES } from "./queries/backoffice";
import { CASHBANK_QUERIES } from "./queries/cashbank";

/**
 * Report queries (LipaPoint ERP spec §5 / reports-spec).
 *
 * Each function is tenant-scoped and returns `{ columns, rows }` for the
 * shared renderer. Register a new report by adding its query here and a
 * ReportDefinition row — no bespoke page needed.
 */

// ── Trial Balance ───────────────────────────────────────────────────────
const trialBalance: ReportQuery = async (tenantId, params) => {
  const lines = await db.journalLine.findMany({
    where: { journalEntry: { tenantId, ...dateFilter(params, "date") } },
    include: { account: { select: { code: true, name: true, type: true } } },
  });

  const agg = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>();
  for (const line of lines) {
    const a = line.account;
    const cur = agg.get(a.code) ?? { code: a.code, name: a.name, type: a.type, debit: 0, credit: 0 };
    cur.debit += asNum(line.debit);
    cur.credit += asNum(line.credit);
    agg.set(a.code, cur);
  }

  const rows = [...agg.values()]
    .sort((x, y) => x.code.localeCompare(y.code))
    .map((a) => ({
      code: a.code,
      name: a.name,
      type: a.type,
      debit: Math.round(a.debit * 100) / 100,
      credit: Math.round(a.credit * 100) / 100,
      balance: Math.round((a.debit - a.credit) * 100) / 100,
    }));

  const totalDebit = Math.round(rows.reduce((s, r) => s + (r.debit as number), 0) * 100) / 100;
  const totalCredit = Math.round(rows.reduce((s, r) => s + (r.credit as number), 0) * 100) / 100;

  return {
    columns: [
      { key: "code", label: "Code", kind: "text" },
      { key: "name", label: "Account", kind: "text" },
      { key: "type", label: "Type", kind: "text" },
      { key: "debit", label: "Debit", kind: "currency" },
      { key: "credit", label: "Credit", kind: "currency" },
      { key: "balance", label: "Balance", kind: "currency" },
    ],
    rows,
    summary: { totalDebit, totalCredit, difference: Math.round((totalDebit - totalCredit) * 100) / 100 },
  };
};

// ── Profit and Loss ─────────────────────────────────────────────────────
const profitAndLoss: ReportQuery = async (tenantId, params) => {
  const lines = await db.journalLine.findMany({
    where: {
      journalEntry: { tenantId, ...dateFilter(params, "date") },
      account: { type: { in: ["income", "expense"] } },
    },
    include: { account: { select: { code: true, name: true, type: true } } },
  });

  const agg = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>();
  for (const line of lines) {
    const a = line.account;
    const cur = agg.get(a.code) ?? { code: a.code, name: a.name, type: a.type, debit: 0, credit: 0 };
    cur.debit += asNum(line.debit);
    cur.credit += asNum(line.credit);
    agg.set(a.code, cur);
  }

  let totalIncome = 0;
  let totalExpense = 0;
  const rows = [...agg.values()]
    .sort((x, y) => x.code.localeCompare(y.code))
    .map((a) => {
      // Income sits on the credit side, expense on the debit side.
      const amount = a.type === "income" ? a.credit - a.debit : a.debit - a.credit;
      const rounded = Math.round(amount * 100) / 100;
      if (a.type === "income") totalIncome += rounded;
      else totalExpense += rounded;
      return { code: a.code, name: a.name, type: a.type, amount: rounded };
    });

  totalIncome = Math.round(totalIncome * 100) / 100;
  totalExpense = Math.round(totalExpense * 100) / 100;

  return {
    columns: [
      { key: "code", label: "Code", kind: "text" },
      { key: "name", label: "Account", kind: "text" },
      { key: "type", label: "Type", kind: "text" },
      { key: "amount", label: "Amount", kind: "currency" },
    ],
    rows,
    summary: {
      totalIncome,
      totalExpense,
      netProfit: Math.round((totalIncome - totalExpense) * 100) / 100,
    },
  };
};

// ── Audit Trail ─────────────────────────────────────────────────────────
const auditTrail: ReportQuery = async (tenantId, params) => {
  const search = params.search?.trim();

  const logs = await db.activityLog.findMany({
    where: {
      tenantId,
      ...dateFilter(params, "createdAt"),
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: "insensitive" as const } },
              { entity: { contains: search, mode: "insensitive" as const } },
              { details: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 200,
  });

  return {
    columns: [
      { key: "timestamp", label: "Timestamp", kind: "date" },
      { key: "actor", label: "Actor", kind: "text" },
      { key: "module", label: "Module", kind: "text" },
      { key: "action", label: "Action", kind: "text" },
      { key: "entity", label: "Entity", kind: "text" },
      { key: "details", label: "Details", kind: "text" },
    ],
    rows: logs.map((l) => ({
      timestamp: l.createdAt.toISOString(),
      actor: l.user?.name ?? "system",
      module: l.module ?? "",
      action: l.action,
      entity: l.entity,
      details: l.details ?? "",
    })),
    summary: { total: logs.length },
  };
};

/** Query registry keyed by normalized report key (see types.ts). */
const QUERIES: Record<string, ReportQuery> = {
  trial_balance: trialBalance,
  profit_and_loss: profitAndLoss,
  audit_trail: auditTrail,
  ...SALES_QUERIES,
  ...FINANCE_QUERIES,
  ...STOCK_QUERIES,
  ...PARTNER_QUERIES,
  ...BACKOFFICE_QUERIES,
  ...CASHBANK_QUERIES,
};

export function getReportQuery(normalizedKey: string): ReportQuery | null {
  return QUERIES[normalizedKey] ?? null;
}