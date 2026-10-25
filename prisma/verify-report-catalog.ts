import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // Confirm tables exist by reading system catalogs
  const tables = await db.$queryRawUnsafe<
    { table_name: string }[]
  >(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('ReportDefinition','ReportRun') ORDER BY table_name`);

  console.log("Tables present:", tables.map((t) => t.table_name));

  const hasTenantIdColumn = await db.$queryRawUnsafe<{ ok: boolean }[]>(`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ReportDefinition' AND column_name='tenantId') AS ok`);
  console.log("ReportDefinition has tenantId column:", hasTenantIdColumn[0]?.ok === true);

  console.log("Tables present:", tables.map((t) => t.table_name));

  const existing = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT COUNT(*) AS count FROM "public"."ReportDefinition"`);
  const beforeCount = Number(existing[0]?.count ?? 0);
  console.log("ReportDefinition rows before seed:", beforeCount);

  if (beforeCount === 0) {
    const tenant = await db.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM "public"."Tenant" ORDER BY "createdAt" DESC LIMIT 1`);
    const tenantId = tenant[0]?.id;
    if (!tenantId) {
      console.error("No tenant found to seed report definitions");
      return;
    }
    console.log("Using tenantId:", tenantId);

    await db.$executeRawUnsafe(`INSERT INTO "public"."ReportDefinition" ("tenantId", "key", "title", "description", "category", "section", "isVisible", "defaultParams", "isBuiltIn") VALUES ('${tenantId}','profit_and_loss','Profit and Loss Statement','Income minus expenses for the period, with gross profit and net profit subtotals.','finance','Finance Reports',true,'{"format":"pdf","includeComparison":false}',true)`);
    await db.$executeRawUnsafe(`INSERT INTO "public"."ReportDefinition" ("tenantId", "key", "title", "description", "category", "section", "isVisible", "defaultParams", "isBuiltIn") VALUES ('${tenantId}','balance_sheet','Balance Sheet','Assets, liabilities and equity as at a date. Assets must equal liabilities plus equity.','finance','Finance Reports',true,'{"format":"pdf","asAt":"latest"}',true)`);
    await db.$executeRawUnsafe(`INSERT INTO "public"."ReportDefinition" ("tenantId", "key", "title", "description", "category", "section", "isVisible", "defaultParams", "isBuiltIn") VALUES ('${tenantId}','trial_balance','Trial Balance','Chart of accounts with opening, debits, credits and closing balances for a period.','finance','Finance Reports',true,'{"format":"csv"}',true)`);
    await db.$executeRawUnsafe(`INSERT INTO "public"."ReportDefinition" ("tenantId", "key", "title", "description", "category", "section", "isVisible", "defaultParams", "isBuiltIn") VALUES ('${tenantId}','cash_bank_statement','Cash / Bank Statement','Bank account transactions, with summary and detailed views.','bank','Cash / Bank / Cashier Reports',true,'{"format":"csv","includeSummary":true}',true)`);
    await db.$executeRawUnsafe(`INSERT INTO "public"."ReportDefinition" ("tenantId", "key", "title", "description", "category", "section", "isVisible", "defaultParams", "isBuiltIn") VALUES ('${tenantId}','audit_trail','Audit Trail Report','Platform-wide activity log for compliance and internal review.','maintenance','Maintenance Reports',true,'{"format":"csv","limit":500}',true)`);

    console.log("Inserted sample report definitions.");
  }
}

main()
  .then(() => db.$disconnect())
  .catch((err) => {
    console.error(err);
    db.$disconnect().finally(() => process.exit(1));
  });
