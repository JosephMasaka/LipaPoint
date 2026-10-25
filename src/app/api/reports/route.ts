import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserWithModule, routeError } from "@/lib/api-guards";
import { canAccessFeature } from "@/lib/plans";
import { reportFeature, normalizeReportKey } from "@/lib/reports/types";

/**
 * List the tenant's visible report definitions (spec §5 — one catalog),
 * entitlement-gated per spec §10 so report visibility always tracks
 * `canAccessFeature()` rather than a hand-maintained permissions list.
 *
 * Duplicates (same report seeded under two key conventions) collapse to one
 * entry via `normalizeReportKey`.
 */
export async function GET() {
  try {
    const auth = await requireUserWithModule();
    if (auth.response) return auth.response;
    const { user } = auth;

    const defs = await db.reportDefinition.findMany({
      where: { tenantId: user.tenantId, isVisible: true, isEnabled: { not: false } },
      orderBy: [{ section: "asc" }, { key: "asc" }],
    });

    const tier = user.tenant.tier;
    const tenantType = user.tenant.type;
    const seen = new Set<string>();
    const reports: Array<{
      key: string;
      normalizedKey: string;
      title: string;
      description: string | null;
      category: string;
      section: string;
    }> = [];

    for (const d of defs) {
      const nk = normalizeReportKey(d.key);
      if (seen.has(nk)) continue;
      const flag = reportFeature(d.category);
      if (flag && !canAccessFeature(tier, flag, tenantType)) continue;
      seen.add(nk);
      reports.push({
        key: d.key,
        normalizedKey: nk,
        title: d.title,
        description: d.description,
        category: d.category,
        section: d.section,
      });
    }

    return NextResponse.json({ reports });
  } catch (error) {
    return routeError("GET /api/reports", error);
  }
}