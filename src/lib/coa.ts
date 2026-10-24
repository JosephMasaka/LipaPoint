import { db } from "./db";

/**
 * Default chart of accounts seeded onto every tenant at creation
 * (LipaPoint ERP spec §4.3). A Kenyan SME/restaurant-oriented skeleton —
 * editable by the tenant, but seeded rows carry isSystem=true so the
 * accounts other modules post into can't be deleted out from under the GL.
 */

export interface SeedAccount {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  children?: SeedAccount[];
}

export const DEFAULT_CHART_OF_ACCOUNTS: SeedAccount[] = [
  {
    code: "1000",
    name: "Cash & Cash Equivalents",
    type: "asset",
    children: [
      { code: "1010", name: "Cash on Hand", type: "asset" },
      { code: "1020", name: "M-Pesa Till", type: "asset" },
      { code: "1030", name: "M-Pesa Paybill", type: "asset" },
      { code: "1040", name: "Bank Account", type: "asset" },
    ],
  },
  { code: "1100", name: "Accounts Receivable", type: "asset" },
  { code: "1200", name: "Inventory", type: "asset" },
  { code: "1300", name: "Prepaid Expenses", type: "asset" },
  // Phase 3: staff loan/advance balances recoverable via payroll deductions.
  { code: "1400", name: "Staff Loans & Advances", type: "asset" },
  {
    code: "1500",
    name: "Fixed Assets",
    type: "asset",
    children: [
      { code: "1510", name: "Accumulated Depreciation", type: "asset" },
    ],
  },
  { code: "2000", name: "Accounts Payable", type: "liability" },
  { code: "2100", name: "VAT Output Tax Payable", type: "liability" },
  { code: "2200", name: "PAYE Payable", type: "liability" },
  { code: "2300", name: "NSSF Payable", type: "liability" },
  { code: "2400", name: "SHIF Payable", type: "liability" },
  { code: "2500", name: "Housing Levy Payable", type: "liability" },
  { code: "2600", name: "Customer Deposits & Advances", type: "liability" },
  // Phase 3: payroll withholdings (see src/lib/payroll.ts JE on run payment)
  { code: "2700", name: "NITA Training Levy Payable", type: "liability" },
  { code: "2710", name: "Other Deductions Payable", type: "liability" },
  { code: "3000", name: "Owner's Equity", type: "equity" },
  { code: "3100", name: "Retained Earnings", type: "equity" },
  { code: "4000", name: "Sales Revenue", type: "income" },
  { code: "4100", name: "Service Revenue", type: "income" },
  { code: "4200", name: "Other Income", type: "income" },
  { code: "5000", name: "Cost of Goods Sold", type: "expense" },
  { code: "6000", name: "Salaries & Wages", type: "expense" },
  { code: "6100", name: "Statutory Contributions (Employer)", type: "expense" },
  { code: "6200", name: "Rent Expense", type: "expense" },
  { code: "6300", name: "Utilities Expense", type: "expense" },
  { code: "6400", name: "Repairs & Maintenance", type: "expense" },
  { code: "6500", name: "Depreciation Expense", type: "expense" },
  { code: "6600", name: "Bank & M-Pesa Charges", type: "expense" },
  { code: "6700", name: "Marketing & Advertising", type: "expense" },
  { code: "6800", name: "Loss on Asset Disposal", type: "expense" },
];

/**
 * Upserts the default COA for a tenant. Idempotent — safe to call on every
 * signup and from the seed script; existing rows (including tenant edits
 * to name/type) are left untouched.
 *
 * Writes breadth-first, one round trip per tree level instead of one per
 * account: parents resolve before children (each level waits for the one
 * above), but accounts within a level go concurrently. Against a remote
 * database this is the difference between ~40 serial queries and ~2 per
 * call — it runs on every signup and on the tenant backfill.
 */
export async function seedChartOfAccounts(tenantId: string): Promise<void> {
  let level = DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({ account, parentId: null as string | null }));

  while (level.length > 0) {
    const created = await Promise.all(
      level.map(({ account, parentId }) => upsertAccount(tenantId, account, parentId))
    );
    const next: typeof level = [];
    created.forEach((row, i) => {
      for (const child of level[i].account.children ?? []) {
        next.push({ account: child, parentId: row.id });
      }
    });
    level = next;
  }
}

async function upsertAccount(
  tenantId: string,
  account: SeedAccount,
  parentId: string | null
) {
  const data = {
    name: account.name,
    type: account.type,
    parentId,
    isSystem: true,
  };
  return db.chartOfAccount.upsert({
    where: { tenantId_code: { tenantId, code: account.code } },
    create: { tenantId, code: account.code, ...data },
    // Only fill gaps: never overwrite a tenant's edit to a seeded account.
    update: { parentId },
  });
}
