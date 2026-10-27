import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserWithModule, routeError } from "@/lib/api-guards";
import { canAccessFeature } from "@/lib/plans";
import { isFeatureEnabled } from "@/lib/features";
import { reportFeature, normalizeReportKey } from "@/lib/reports/types";
import { reportFeatureKey, reportFeatureLabel } from "@/lib/reports/feature-map";
import { getReportQuery } from "@/lib/reports/queries";

/**
 * Run a report by key (spec §5/§1): load the tenant's ReportDefinition,
 * re-check entitlement (spec §10), then dispatch to the registered query.
 *
 * Returns `{ definition, columns, rows, summary }` for the shared renderer.
 * Definitions without a registered query return 501 `not_implemented` so the
 * catalog stays browsable while individual reports land incrementally.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const auth = await requireUserWithModule();
    if (auth.response) return auth.response;
    const { user } = auth;

    const def = await db.reportDefinition.findUnique({
      where: { tenantId_key: { tenantId: user.tenantId, key } },
    });
    if (!def) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const flag = reportFeature(def.category);
    if (flag && !canAccessFeature(user.tenant.tier, flag, user.tenant.type)) {
      return NextResponse.json(
        { error: `This report requires the "${flag}" feature on your plan` },
        { status: 403 }
      );
    }

    // Sub-feature gate (handoff D2/R1): the catalog list stays complete, so a
    // report the tenant's features don't cover is listed but answers with a
    // friendly 403 naming the feature to switch on — never a silent removal.
    const featureKey = reportFeatureKey(def.key);
    if (featureKey && !(await isFeatureEnabled(user.tenantId, featureKey))) {
      return NextResponse.json(
        {
          error: `Enable "${reportFeatureLabel(def.key)}" to run this report`,
          feature: featureKey,
        },
        { status: 403 }
      );
    }

    const query = getReportQuery(normalizeReportKey(def.key));
    if (!query) {
      return NextResponse.json(
        { error: "not_implemented", message: "This report's query has not been built yet." },
        { status: 501 }
      );
    }

    const { searchParams } = request.nextUrl;
    const params_ = {
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined,
    };

    const result = await query(user.tenantId, params_);

    return NextResponse.json({
      definition: {
        key: def.key,
        title: def.title,
        description: def.description,
        category: def.category,
        section: def.section,
      },
      ...result,
    });
  } catch (error) {
    return routeError("GET /api/reports/[key]", error);
  }
}