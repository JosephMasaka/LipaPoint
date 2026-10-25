import { db } from "@/lib/db";
import type { ReportQuery } from "../types";
import { dateFilter, asNum, round2 } from "../helpers";

/**
 * Finance report queries (spec §7): Balance Sheet + General Journal Register.
 * Both read the double-entry GL (JournalEntry/JournalLine → ChartOfAccount).
 */

// ── Balance Sheet ───────────────────────────────────────────────────────
const balanceSheet: ReportQuery = async (tenantId, params) => {
  // "As at" a date: cumulative balances up to end-of-day `to` (or all time).
  const lte = params.to ? new Date(params.to) : undefined;
  if (lte) lte.setUTCHours(23, 59, 59, 999);

  const lines = await db.journalLine.findMany({
    where: {
      journalEntry: { tenantId, ...(lte ? { date: { lte } } : {}) },
      account: { type: { in: ["asset", "liability", "equity"] } },
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

  const sectionLabel: Record<string, string> = {
    asset: "Assets",
    liability: "Liabilities",
    equity: "Equity",
  };
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  const rows = [...agg.values()]
    .map((a) => {
      // Assets are debit-normal; liabilities & equity are credit-normal.
      const balance =
        a.type === "asset" ? a.debit - a.credit : a.credit - a.debit;
      const rounded = round2(balance);
      if (a.type === "asset") totalAssets += rounded;
      else if (a.type === "liability") totalLiabilities += rounded;
      else totalEquity += rounded;
      return { section: sectionLabel[a.type] ?? a.type, account: `${a.code} ${a.name}`, balance: rounded };
    })
    .filter((r) => r.balance !== 0)
    .sort((x, y) => x.section.localeCompare(y.section) || x.account.localeCompare(y.account));

  totalAssets = round2(totalAssets);
  totalLiabilities = round2(totalLiabilities);
  totalEquity = round2(totalEquity);

  return {
    columns: [
      { key: "section", label: "Section", kind: "text" },
      { key: "account", label: "Account", kind: "text" },
      { key: "balance", label: "Balance", kind: "currency" },
    ],
    rows,
    summary: {
      totalAssets,
      totalLiabilities,
      totalEquity,
      // Accounting equation check: Assets − (Liabilities + Equity) should be 0.
      difference: round2(totalAssets - (totalLiabilities + totalEquity)),
    },
  };
};

// ── General Journal Register ────────────────────────────────────────────
const glJournalRegister: ReportQuery = async (tenantId, params) => {
  const entries = await db.journalEntry.findMany({
    where: { tenantId, ...dateFilter(params, "date") },
    include: {
      lines: { include: { account: { select: { code: true, name: true } } }, orderBy: { id: "asc" } },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    take: params.limit ?? 1000,
  });

  const rows: Record<string, string | number | null>[] = [];
  for (const e of entries) {
    for (const line of e.lines) {
      rows.push({
        date: e.date.toISOString(),
        reference: e.reference,
        description: line.description ?? e.description ?? "",
        account: `${line.account.code} ${line.account.name}`,
        debit: round2(asNum(line.debit)),
        credit: round2(asNum(line.credit)),
      });
    }
  }

  const totalDebit = round2(rows.reduce((s, r) => s + (r.debit as number), 0));
  const totalCredit = round2(rows.reduce((s, r) => s + (r.credit as number), 0));

  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "reference", label: "Reference", kind: "text" },
      { key: "description", label: "Description", kind: "text" },
      { key: "account", label: "Account", kind: "text" },
      { key: "debit", label: "Debit", kind: "currency" },
      { key: "credit", label: "Credit", kind: "currency" },
    ],
    rows,
    summary: { lines: rows.length, totalDebit, totalCredit },
  };
};

export const FINANCE_QUERIES: Record<string, ReportQuery> = {
  balance_sheet: balanceSheet,
  gl_journal_register: glJournalRegister,
};