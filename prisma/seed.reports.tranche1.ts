import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/** Map a catalog category to the human "section" label used by the report catalog. */
function sectionFor(category: string): string {
  switch (category) {
    case "finance":
      return "Finance Reports";
    case "cash-bank":
      return "Cash / Bank / Cashier Reports";
    case "maintenance":
      return "Maintenance Reports";
    case "sales":
      return "Sales Reports";
    case "customer":
      return "Customer Reports";
    case "stock":
      return "Stock Reports";
    case "supplier":
      return "Supplier Reports";
    case "payroll":
      return "Payroll Reports";
    case "asset":
      return "Asset Reports";
    case "etims":
      return "eTIMS Reports";
    default:
      return "Finance Reports";
  }
}

async function main() {
  const tenant = await db.$queryRaw<{ id: string }[]>`SELECT id FROM "public"."Tenant" ORDER BY "createdAt" DESC LIMIT 1`;
  const tenantId = tenant[0]?.id;
  if (!tenantId) {
    console.error("No tenant found to seed report definitions");
    return;
  }

  console.log("Using tenantId:", tenantId);

  const definitions = [
    {
      key: "profit_and_loss",
      name: "Profit and Loss Statement",
      module: "finance",
      category: "finance",
      description: "Income minus expenses for the period, with gross profit and net profit subtotals.",
      parameters: JSON.stringify({ dateRange: true, comparisonPeriod: true }),
      columns: JSON.stringify([
        { key: "period", label: "Period", kind: "date" },
        { key: "account", label: "Account", kind: "text" },
        { key: "debit", label: "Debit", kind: "currency" },
        { key: "credit", label: "Credit", kind: "currency" },
        { key: "balance", label: "Balance", kind: "currency" },
      ]),
    },
    {
      key: "balance_sheet",
      name: "Balance Sheet",
      module: "finance",
      category: "finance",
      description: "Assets, liabilities and equity as at a date. Assets must equal liabilities plus equity.",
      parameters: JSON.stringify({ asAt: true }),
      columns: JSON.stringify([
        { key: "group", label: "Group", kind: "text" },
        { key: "account", label: "Account", kind: "text" },
        { key: "debit", label: "Debit", kind: "currency" },
        { key: "credit", label: "Credit", kind: "currency" },
        { key: "balance", label: "Balance", kind: "currency" },
      ]),
    },
    {
      key: "trial_balance",
      name: "Trial Balance",
      module: "finance",
      category: "finance",
      description: "Chart of accounts with opening, debits, credits and closing balances for a period.",
      parameters: JSON.stringify({ dateRange: true }),
      columns: JSON.stringify([
        { key: "account", label: "Account", kind: "text" },
        { key: "opening", label: "Opening", kind: "currency" },
        { key: "debit", label: "Debit", kind: "currency" },
        { key: "credit", label: "Credit", kind: "currency" },
        { key: "closing", label: "Closing", kind: "currency" },
      ]),
    },
    {
      key: "cash_bank_statement",
      name: "Cash / Bank Statement",
      module: "finance",
      category: "cash-bank",
      description: "Bank account transactions, with summary and detailed views.",
      parameters: JSON.stringify({ bankAccountId: true, dateRange: true }),
      columns: JSON.stringify([
        { key: "date", label: "Date", kind: "date" },
        { key: "description", label: "Description", kind: "text" },
        { key: "debit", label: "Debit", kind: "currency" },
        { key: "credit", label: "Credit", kind: "currency" },
        { key: "balance", label: "Balance", kind: "currency" },
      ]),
    },
    {
      key: "audit_trail",
      name: "Audit Trail Report",
      module: "platform",
      category: "maintenance",
      description: "Platform-wide activity log for compliance and internal review.",
      parameters: JSON.stringify({ search: true, action: true, from: true, to: true, limit: true }),
      columns: JSON.stringify([
        { key: "timestamp", label: "Timestamp", kind: "date" },
        { key: "actor", label: "Actor", kind: "text" },
        { key: "tenant", label: "Tenant", kind: "text" },
        { key: "action", label: "Action", kind: "text" },
        { key: "entity", label: "Entity", kind: "text" },
        { key: "details", label: "Details", kind: "text" },
      ]),
    },
  ];

  for (const def of definitions) {
    await db.reportDefinition.upsert({
      where: { tenantId_key: { tenantId, key: def.key } },
      create: {
        tenantId,
        key: def.key,
        title: def.name,
        description: def.description,
        category: def.category,
        section: sectionFor(def.category),
        module: def.module,
        parameters: def.parameters,
        columns: def.columns,
        isSystem: true,
        isEnabled: true,
      },
      update: {
        title: def.name,
        description: def.description,
        category: def.category,
        section: sectionFor(def.category),
        module: def.module,
        parameters: def.parameters,
        columns: def.columns,
        isEnabled: true,
      },
    });
  }

  const count = await db.reportDefinition.count();
  console.log("ReportDefinition rows now:", count);
}

main()
  .then(() => db.$disconnect())
  .catch((err) => {
    console.error(err);
    db.$disconnect().finally(() => process.exit(1));
  });