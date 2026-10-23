import { db } from "./db";
import type { Prisma } from "@prisma/client";

/**
 * General ledger posting (LipaPoint ERP spec §3/§4.3).
 *
 * JournalEntry is the single source of truth every other module posts to —
 * POS sales, payroll runs, asset depreciation and supplier payments all
 * create journal entries rather than mutating balances directly. This is
 * the Phase 0 skeleton: validate → balance-check → write entry + lines
 * atomically, scoped to one tenant.
 */

export interface JournalLineInput {
  accountCode: string; // resolved to ChartOfAccount.id within the tenant
  debit?: number;
  credit?: number;
  description?: string;
}

export interface PostJournalEntryInput {
  tenantId: string;
  locationId?: string | null;
  date?: Date;
  reference: string; // e.g. SALE-0001, PAY-0003, PO-0002
  sourceModule: string; // pos | payroll | procurement | assets | manual | ...
  sourceId?: string | null;
  description?: string;
  postedBy?: string | null; // userId; null for system jobs (depreciation, etc.)
  lines: JournalLineInput[];
}

/** Round to 2dp — source amounts come from Float columns and drift. */
function toCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Any Prisma client — the standalone db or an interactive-transaction
 * client, so multi-step services (GRN + stock + journal) commit atomically.
 */
type Db = typeof db | Prisma.TransactionClient;

/**
 * Posts a balanced journal entry. Throws before writing anything if the
 * entry doesn't balance or references an unknown/inactive account, so a
 * buggy caller can never half-write the GL. Pass `tx` to run inside an
 * existing interactive transaction.
 */
export async function postJournalEntry(input: PostJournalEntryInput, tx: Db = db) {
  if (input.lines.length < 2) {
    throw new Error(
      `Journal entry ${input.reference}: needs at least 2 lines (got ${input.lines.length})`
    );
  }

  const lines = input.lines.map((line) => ({
    ...line,
    debit: toCents(line.debit ?? 0),
    credit: toCents(line.credit ?? 0),
  }));

  let totalDebit = 0;
  let totalCredit = 0;
  for (const [i, line] of lines.entries()) {
    if (line.debit < 0 || line.credit < 0) {
      throw new Error(
        `Journal entry ${input.reference}: line ${i + 1} has a negative amount`
      );
    }
    if ((line.debit === 0) === (line.credit === 0)) {
      throw new Error(
        `Journal entry ${input.reference}: line ${i + 1} (${line.accountCode}) must have either a debit or a credit, not both/neither`
      );
    }
    totalDebit += line.debit;
    totalCredit += line.credit;
  }
  if (toCents(totalDebit) !== toCents(totalCredit)) {
    throw new Error(
      `Journal entry ${input.reference}: unbalanced — debits ${toCents(totalDebit)} vs credits ${toCents(totalCredit)}`
    );
  }

  const codes = [...new Set(lines.map((l) => l.accountCode))];
  const accounts = await tx.chartOfAccount.findMany({
    where: { tenantId: input.tenantId, code: { in: codes }, isActive: true },
    select: { id: true, code: true },
  });
  const byCode = new Map(accounts.map((a) => [a.code, a.id]));
  for (const code of codes) {
    if (!byCode.has(code)) {
      throw new Error(
        `Journal entry ${input.reference}: account ${code} not found or inactive for tenant`
      );
    }
  }

  return tx.journalEntry.create({
    data: {
      tenantId: input.tenantId,
      locationId: input.locationId ?? null,
      date: input.date ?? new Date(),
      reference: input.reference,
      sourceModule: input.sourceModule,
      sourceId: input.sourceId ?? null,
      description: input.description ?? null,
      postedBy: input.postedBy ?? null,
      lines: {
        create: lines.map((line) => ({
          accountId: byCode.get(line.accountCode)!,
          debit: line.debit,
          credit: line.credit,
          description: line.description ?? null,
        })),
      },
    },
    include: { lines: true },
  });
}

export type JournalEntryWithLines = Prisma.JournalEntryGetPayload<{
  include: { lines: true };
}>;
