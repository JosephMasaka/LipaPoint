import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main(): Promise<void> {
  try {
    const tableList = await db.$queryRaw<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('ReportDefinition','ReportRun','TenantPaymentGateway') ORDER BY table_name`;
    console.log("tables present:", tableList.map((t) => t.table_name).join(", ") || "NONE");
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