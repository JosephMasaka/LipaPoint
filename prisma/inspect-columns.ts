import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const baseQuery =
  "SELECT a.attname, a.atttypid, a.attlen, a.attnotnull FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid WHERE c.relname=$1 AND n.nspname=$2 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum";

interface ColumnRow {
  attname: string;
  atttypid: number;
  attlen: number;
  attnotnull: boolean;
}

async function columns(tableName: string): Promise<ColumnRow[]> {
  const tableNamePar = tableName;
  const schemaPar = "public" as const;
  const r = await db.$queryRawUnsafe<ColumnRow[]>(baseQuery, [tableNamePar, schemaPar]);
  return Array.isArray(r) ? r : [];
}

async function main(): Promise<void> {
  try {
    const tableList = await db.$queryRaw<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('ReportDefinition','ReportRun','TenantPaymentGateway') ORDER BY table_name`;
    console.log("tables present:", tableList.map((t) => t.table_name).join(", ") || "NONE");

    const reportDef = await columns("ReportDefinition");
    console.log("ReportDefinition columns:");
    for (const c of reportDef) console.log(`  ${c.attname}  typid=${c.atttypid}  len=${c.attlen}  notnull=${c.attnotnull}`);

    const reportRun = await columns("ReportRun");
    console.log("ReportRun columns:");
    for (const c of reportRun) console.log(`  ${c.attname}  typid=${c.atttypid}  len=${c.attlen}  notnull=${c.attnotnull}`);

    const tenantGateway = await columns("TenantPaymentGateway");
    console.log("TenantPaymentGateway columns:");
    for (const c of tenantGateway) console.log(`  ${c.attname}  typid=${c.atttypid}  len=${c.attlen}  notnull=${c.attnotnull}`);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    console.log("ERROR", err.code, (err.message || "").slice(0, 800));
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  db.$disconnect().finally(() => process.exit(1));
});