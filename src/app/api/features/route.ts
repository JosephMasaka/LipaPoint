import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { routeError, parseBody } from "@/lib/api-guards";
import {
  FEATURE_REGISTRY,
  MODULE_REGISTRY,
  featuresForCategory,
} from "@/lib/module-registry";
import type { FeatureKey } from "@/lib/module-registry";
import {
  getEffectiveEnabledFeatures,
  grantFeature,
  revokeFeature,
} from "@/lib/features";
import { getBusinessCategory } from "@/lib/plans";
import { APPS } from "@/lib/apps";
import { db } from "@/lib/db";

/**
 * Sub-feature management API for the Odoo-style Apps screen (sub-feature
 * spec §3/§8).
 *
 * Mirrors /api/modules: this page must never import src/lib/features'
 * server functions directly — they pull Prisma into the browser bundle.
 *
 *   GET  /api/features → App → Module → Feature tree for the tenant,
 *                        vertically filtered (spec §7) to the tenant's
 *                        business category.
 *   POST { featureKey, action } → grant or revoke a billable feature
 *                        (OWNER/ADMIN only, like module management).
 *
 * GET is session-only (the sidebar reads it for every role); only mutations
 * are admin-gated.
 */

const ADMIN_ROLES = new Set(["OWNER", "ADMIN"]);

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const enabled = await getEffectiveEnabledFeatures(user.tenantId);
    const category = getBusinessCategory(user.tenant.type);
    const applicable = new Set(featuresForCategory(category));

    const rows = await db.tenantFeature.findMany({
      where: { tenantId: user.tenantId },
      select: { featureKey: true, source: true, enabled: true },
    });
    const byKey = new Map(rows.map((row) => [row.featureKey, row]));

    const moduleRows = await db.tenantModule.findMany({
      where: { tenantId: user.tenantId },
      select: { moduleKey: true, enabled: true },
    });
    const modulesOn = new Set(moduleRows.filter((m) => m.enabled).map((m) => m.moduleKey));

    const featureKeys = Object.keys(FEATURE_REGISTRY) as FeatureKey[];

    const apps = APPS.map((app) => ({
      id: app.id,
      label: app.label,
      tagline: app.tagline,
      group: app.group,
      modules: app.modules.map((moduleKey) => ({
        key: moduleKey,
        label: MODULE_REGISTRY[moduleKey].label,
        description: MODULE_REGISTRY[moduleKey].description,
        enabled: modulesOn.has(moduleKey),
        features: featureKeys
          .filter((key) => FEATURE_REGISTRY[key].moduleKey === moduleKey)
          .filter((key) => applicable.has(key))
          .map((key) => ({
            key,
            label: FEATURE_REGISTRY[key].label,
            core: FEATURE_REGISTRY[key].core,
            requires: FEATURE_REGISTRY[key].requires,
            moduleKey: FEATURE_REGISTRY[key].moduleKey,
            enabled: enabled.has(key),
            source: byKey.get(key)?.source ?? null,
          })),
      })),
    }));

    return NextResponse.json({
      apps,
      enabled: [...enabled],
      category,
      tier: user.tenant.tier,
      role: user.role,
    });
  } catch (error) {
    return routeError("GET /api/features", error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ADMIN_ROLES.has(user.role)) {
      return NextResponse.json(
        { error: "Only owners and admins can manage features" },
        { status: 403 }
      );
    }

    const body = await parseBody<{ featureKey?: string; action?: string }>(request);
    const featureKey = body.featureKey as FeatureKey | undefined;
    const action = body.action === "revoke" ? "revoke" : "grant";

    if (!featureKey || !FEATURE_REGISTRY[featureKey]) {
      return NextResponse.json({ error: "Unknown feature" }, { status: 400 });
    }
    const def = FEATURE_REGISTRY[featureKey];

    const category = getBusinessCategory(user.tenant.type);
    if (!featuresForCategory(category).includes(featureKey)) {
      return NextResponse.json(
        { error: `"${def.label}" isn't available for a ${category.replaceAll("_", " ").toLowerCase()} business` },
        { status: 403 }
      );
    }

    if (action === "grant") {
      // A feature is only self-serve inside an app the tenant already runs —
      // otherwise the app switch on the same screen is the first step.
      const moduleRow = await db.tenantModule.findUnique({
        where: {
          tenantId_moduleKey: { tenantId: user.tenantId, moduleKey: def.moduleKey },
        },
        select: { enabled: true },
      });
      if (!moduleRow?.enabled) {
        return NextResponse.json(
          { error: `Turn on the "${def.moduleKey}" module first — this feature belongs to it.` },
          { status: 403 }
        );
      }
      await grantFeature(user.tenantId, featureKey, "addon");
      return NextResponse.json({ ok: true, featureKey, action, enabled: true });
    }

    // Revoke — revokeFeature answers 409 for core features and for anything
    // an enabled sibling hard-depends on; routeError keeps those statuses.
    await revokeFeature(user.tenantId, featureKey);
    return NextResponse.json({ ok: true, featureKey, action, enabled: false });
  } catch (error) {
    return routeError("POST /api/features", error);
  }
}