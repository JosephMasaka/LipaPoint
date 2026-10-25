import { db } from "./db";
import { postJournalEntry } from "./journal";
import { writeAuditLog, AUDIT_ACTIONS } from "./audit";

/**
 * Bank & cash accounts (LipaPoint ERP spec §4.3).
 *
 * A BankAccount is a real-world wallet (bank account, M-Pesa till/paybill,
 * cash drawer) linked to a GL account in the chart. Recording a transaction
 * here posts the matching journal entry so the GL and the cash book never
 * drift apart. Reconciliation matches imported/recorded bank lines against
 * existing journal lines (e.g. POS sale income) and flags the rest for
 * manual review — feeding the cashier-shortage report.
 */

export class BankError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "BankError";
  }
}

/** Default GL account code by wallet type — matches the seeded COA. */
const TYPE_TO_ACCOUNT_CODE: Record<string, string> = {
  cash: "1010",
  mpesa_till: "1020",
  mpesa_paybill: "1030",
  bank: "1040",
};

export interface CreateBankAccountInput {
  tenantId: string;
  name: string;
  type: string;
  accountNumber?: string | null;
  openingBalance?: number;
  coaAccountCode?: string | null;
}

export async function createBankAccount(input: CreateBankAccountInput) {
  const accountCode =
    input.coaAccountCode ?? TYPE_TO_ACCOUNT_CODE[input.type] ?? "1010";

  const coa = await db.chartOfAccount.findFirst({
    where: {
      tenantId: input.tenantId,
      code: accountCode,
      type: "asset",
      isActive: true,
    },
    select: { id: true, code: true },
  });
  if (!coa) {
    throw new BankError(`GL account ${accountCode} not found for this tenant`);
  }

  const bank = await db.bankAccount.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      type: input.type,
      accountNumber: input.accountNumber ?? null,
      openingBalance: input.openingBalance ?? 0,
      coaAccountId: coa.id,
    },
  });

  // Opening balance is a real GL fact: DR wallet / CR owner's equity.
  if (input.openingBalance && input.openingBalance > 0) {
    await postJournalEntry({
      tenantId: input.tenantId,
      reference: `OPEN-${bank.id.slice(-6).toUpperCase()}`,
      sourceModule: "finance",
      sourceId: bank.id,
      description: `Opening balance — ${input.name}`,
      lines: [
        { accountCode: coa.code, debit: input.openingBalance },
        { accountCode: "3000", credit: input.openingBalance, description: "Opening balance equity" },
      ],
    });
  }

  await writeAuditLog({
    tenantId: input.tenantId,
    action: AUDIT_ACTIONS.FINANCE.BANK_TRANSACTION_RECORDED,
    module: "finance",
    entity: "bankAccount",
    entityId: bank.id,
    after: { name: bank.name, type: bank.type, openingBalance: bank.openingBalance },
  });

  return bank;
}

export interface RecordBankTransactionInput {
  tenantId: string;
  bankAccountId: string;
  date?: Date;
  amount: number;
  direction: "in" | "out";
  description?: string | null;
  reference?: string | null;
  /**
   * GL account on the other side of the entry. Defaults: money in →
   * owner's equity/capital (4200 other income is wrong for generic
   * transfers); callers should pass the real counter-account (e.g. 4000
   * sales for cash takings, 1010 for transfers).
   */
  counterAccountCode?: string | null;
  /**
   * Reporting classification (reports-spec §4): `general` | `cheque` |
   * `transfer`. Omit it and a movement whose counter-account is another
   * cash/bank wallet is classified as a transfer automatically, so the
   * Transfer Report and Cheques Received Report stay populated from the
   * existing Record Transaction form.
   */
  category?: "general" | "cheque" | "transfer";
  chequeNumber?: string | null;
  counterparty?: string | null;
}

/**
 * Records a bank/cash movement and posts the mirrored journal entry:
 * in → DR wallet / CR counter-account; out → DR counter-account / CR wallet.
 */
export async function recordBankTransaction(input: RecordBankTransactionInput) {
  if (input.amount <= 0) {
    throw new BankError("Amount must be > 0");
  }

  const bank = await db.bankAccount.findFirst({
    where: { id: input.bankAccountId, tenantId: input.tenantId, isActive: true },
    include: { coaAccount: { select: { code: true, name: true } } },
  });
  if (!bank) throw new BankError("Bank account not found", 404);
  const walletCode = bank.coaAccount?.code;
  if (!walletCode) {
    throw new BankError(`Bank account ${bank.name} has no linked GL account`);
  }

  const counterCode = input.counterAccountCode ?? "4200";

  // A journal entry whose counter-account is a *different* wallet is a
  // transfer between cash/bank accounts — the exact fact the Transfer
  // Report reads back out.
  const isWallet = (code: string) => Object.values(TYPE_TO_ACCOUNT_CODE).includes(code);
  const category =
    input.category ??
    (isWallet(counterCode) && counterCode !== walletCode ? "transfer" : "general");

  const txn = await db.$transaction(async (tx) => {
    const created = await tx.bankTransaction.create({
      data: {
        tenantId: input.tenantId,
        bankAccountId: input.bankAccountId,
        date: input.date ?? new Date(),
        amount: input.amount,
        direction: input.direction,
        description: input.description ?? null,
        reference: input.reference ?? null,
        category,
        chequeNumber: input.chequeNumber ?? null,
        counterparty: input.counterparty ?? null,
        counterAccountCode: counterCode,
      },
    });

    const entry = await postJournalEntry(
      {
        tenantId: input.tenantId,
        date: input.date ?? new Date(),
        reference: `BNK-${created.id.slice(-6).toUpperCase()}`,
        sourceModule: "finance",
        sourceId: created.id,
        description:
          input.description ??
          `${input.direction === "in" ? "Inflow" : "Outflow"} — ${bank.name}`,
        lines:
          input.direction === "in"
            ? [
                { accountCode: walletCode, debit: input.amount, description: bank.name },
                { accountCode: counterCode, credit: input.amount },
              ]
            : [
                { accountCode: counterCode, debit: input.amount },
                { accountCode: walletCode, credit: input.amount, description: bank.name },
              ],
      },
      tx
    );

    return { ...created, journalEntryId: entry.id };
    },
    { timeout: 20000 }
  );

  await writeAuditLog({
    tenantId: input.tenantId,
    action: AUDIT_ACTIONS.FINANCE.BANK_TRANSACTION_RECORDED,
    module: "finance",
    entity: "bankTransaction",
    entityId: txn.id,
    after: {
      amount: input.amount,
      direction: input.direction,
      walletCode,
      counterCode,
    },
  });

  return txn;
}

/**
 * Marks a bank transaction reconciled, optionally matched to a journal
 * line (e.g. an individual POS sale's income line) so the cashier report
 * can surface unmatched gaps.
 */
export async function reconcileBankTransaction(
  tenantId: string,
  bankTransactionId: string,
  matchedJournalLineId?: string | null
) {
  const txn = await db.bankTransaction.findFirst({
    where: { id: bankTransactionId, tenantId },
  });
  if (!txn) throw new BankError("Bank transaction not found", 404);

  if (matchedJournalLineId) {
    const line = await db.journalLine.findFirst({
      where: {
        id: matchedJournalLineId,
        journalEntry: { tenantId },
      },
      select: { id: true },
    });
    if (!line) throw new BankError("Journal line not found for this tenant", 404);
  }

  const updated = await db.bankTransaction.update({
    where: { id: bankTransactionId },
    data: {
      reconciled: true,
      reconciledAt: new Date(),
      matchedJournalLineId: matchedJournalLineId ?? null,
    },
  });

  await writeAuditLog({
    tenantId,
    action: AUDIT_ACTIONS.FINANCE.BANK_RECONCILED,
    module: "finance",
    entity: "bankTransaction",
    entityId: bankTransactionId,
    after: { reconciled: true, matchedJournalLineId: matchedJournalLineId ?? null },
  });

  return updated;
}
