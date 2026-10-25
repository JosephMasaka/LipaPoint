import { getReportQuery } from "../src/lib/reports/queries";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const norm = (k: string) => k.trim().toLowerCase().replace(/-/g, "_");

async function main() {
  const t = await db.$queryRaw<{ id: string }[]>`SELECT id FROM "public"."Tenant" ORDER BY "createdAt" DESC LIMIT 1`;
  const tenantId = t[0]?.id;
  if (!tenantId) { console.error("No tenant"); process.exit(1); }

  const defs = await db.reportDefinition.findMany({ select: { key: true, category: true } });
  const seen = new Set<string>();
  const keys: { nk: string; category: string }[] = [];
  for (const d of defs) {
    const nk = norm(d.key);
    if (seen.has(nk)) continue;
    seen.add(nk);
    keys.push({ nk, category: d.category });
  }

  const wired: string[] = [];
  const notImplemented: string[] = [];
  const errored: { key: string; msg: string }[] = [];

  for (const { nk, category } of keys) {
    const q = getReportQuery(nk);
    if (!q) { notImplemented.push(`${nk} [${category}]`); continue; }
    try {
      const r = await q(tenantId, {});
      if (!r.columns.length) errored.push({ key: nk, msg: "no columns" });
      else wired.push(`${nk} [${category}] rows=${r.rows.length}`);
    } catch (e) {
      errored.push({ key: nk, msg: (e as Error).message });
    }
  }

  console.log(`Catalog keys: ${keys.length}`);
  console.log(`Wired & ran OK: ${wired.length}`);
  for (const w of wired) console.log(`  OK   ${w}`);
  console.log(`Not implemented (501): ${notImplemented.length}`);
  for (const n of notImplemented) console.log(`  --   ${n}`);
  console.log(`Errors: ${errored.length}`);
  for (const e of errored) console.log(`  XX   ${e.key}: ${e.msg}`);

  process.exitCode = errored.length > 0 ? 1 : 0;
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());