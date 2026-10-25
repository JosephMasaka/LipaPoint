import { db } from "@/lib/db";
import { buildReportDefinitions } from "../../prisma/seed.reports";

/**
 * Report catalog provisioning (LipaPoint ERP spec §5 / reports-spec §1).
 *
 * A report only shows up if the tenant has its own `ReportDefinition` rows —
 * the list and run routes both read the caller's tenant. Signup calls this
 * once the tenant exists so a new account starts with the full catalog
 * instead of an empty Reports page.
 *
 * Idempotent: it only ever adds keys the tenant is missing, so running it at
 * signup, on an existing tenant, or alongside `npx tsx prisma/seed.reports.ts`
 * can never duplicate a row or diverge on column definitions — both build
 * their rows from the same `buildReportDefinitions`.
 *
 * @returns how many definitions were created.
 */
export async function ensureReportCatalog(tenantId: string): Promise<number> {
  const existing = await db.reportDefinition.findMany({
    where: { tenantId },
    select: { key: true },
  });
  const rows = buildReportDefinitions(tenantId, new Set(existing.map((r) => r.key)));
  if (rows.length === 0) return 0;

  await db.reportDefinition.createMany({ data: rows });
  return rows.length;
}
