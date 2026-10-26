import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { routeError, parseBody } from "@/lib/api-guards";
import {
  MODULE_KEYS,
  MODULE_REGISTRY,
  modulesForTier,
  expandModuleSet,
} from "@/lib/modules";
import type { ModuleKey } from "@/lib/modules";

/**
 * Module management API for the tenant's Modules admin page.
 *
 * The page used to import grantModule/revokeModule directly, which dragged
 * Prisma into the browser bundle — the page rendered but could never load or
 * change module state. Everything now goes through this route, guarded to
 * OWNER/ADMIN like the rest of the tenant settings surface.
 *
 * GET    /api/modules          → full module state for the tenant
 * POST   { moduleKey, action } → grant ("on") or revoke ("off")
 */

const ADMIN_ROLES = new Set(["OWNER", "ADMIN"]);

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ADMIN_ROLES.has(user.role)) {
      return NextResponse.json(
        { error: "Only owners and admins can manage modules" },
        { status: 403 }
      );
    }

    const entitlement = modulesForTier(user.tenant.tier);
    const rows = await db.tenantModule.findMany({
      where: { tenantId: user.tenantId },
      select: { moduleKey: true, enabled: true, source: true, enabledAt: true },
    });

    const byKey = new Map(rows.map((r) => [r.moduleKey, r]));

    const modules = MODULE_KEYS.map((key) => {
      const def = MODULE_REGISTRY[key];
      const row = byKey.get(key);
      return {
        key,
        label: def.label,
        description: def.description,
        group: def.group,
        requires: def.requires,
        enabled: row?.enabled ?? false,
        source: row?.source ?? null,
        enabledAt: row?.enabledAt ?? null,
        entitledByTier: entitlement.has(key),
      };
    });

    return NextResponse.json({
      modules,
      tier: user.tenant.tier,
      role: user.role,
    });
  } catch (error) {
    return routeError("GET /api/modules", error);
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
        { error: "Only owners and admins can manage modules" },
        { status: 403 }
      );
    }

    const body = await parseBody<{ moduleKey?: string; action?: string }>(request);
    const moduleKey = body.moduleKey as ModuleKey | undefined;
    const action = body.action === "revoke" ? "revoke" : "grant";

    if (!moduleKey || !MODULE_KEYS.includes(moduleKey)) {
      return NextResponse.json({ error: "Unknown module" }, { status: 400 });
    }

    if (action === "grant") {
      // Self-serve switches are bounded by the subscription: granting a
      // module the tier doesn't include would hand out a free upgrade.
      // Paid addon grants happen through support/billing instead.
      const entitled = modulesForTier(user.tenant.tier);
      if (!entitled.has(moduleKey)) {
        return NextResponse.json(
          {
            error: `"${MODULE_REGISTRY[moduleKey].label}" isn't included in your ${user.tenant.tier.toLowerCase()} plan — upgrade or contact support to add this app.`,
          },
          { status: 403 }
        );
      }

      // Turning a module on also turns on everything it depends on
      // (e.g. payroll implies finance). Rows are written as tier-sourced so
      // the monthly tier re-sync keeps the same state the user chose.
      const needed = expandModuleSet([moduleKey]);
      const now = new Date();
      await db.$transaction(
        [...needed].map((key) =>
          db.tenantModule.upsert({
            where: { tenantId_moduleKey: { tenantId: user.tenantId, moduleKey: key } },
            create: {
              tenantId: user.tenantId,
              moduleKey: key,
              enabled: true,
              planTier: user.tenant.tier,
              source: "tier",
              enabledAt: now,
            },
            update: { enabled: true, source: "tier", enabledAt: now },
          })
        )
      );
      return NextResponse.json({ ok: true, moduleKey, action, enabled: true });
    }

    // Revoke: refuse when another enabled module still depends on this one.
    const enabledRows = await db.tenantModule.findMany({
      where: { tenantId: user.tenantId, enabled: true },
      select: { moduleKey: true },
    });
    const enabledKeys = new Set(enabledRows.map((r) => r.moduleKey as ModuleKey));
    const blockers = [...enabledKeys].filter((key) =>
      MODULE_REGISTRY[key].requires.includes(moduleKey)
    );
    if (blockers.length > 0) {
      const names = blockers.map((k) => MODULE_REGISTRY[k].label).join(", ");
      return NextResponse.json(
        { error: `Turn off ${names} first — it depends on this module.` },
        { status: 409 }
      );
    }

    // Explicit opt-out: flip the row to source "manual" (disabled) so the
    // monthly tier re-sync doesn't silently turn the module back on.
    await db.tenantModule.updateMany({
      where: { tenantId: user.tenantId, moduleKey, enabled: true },
      data: { enabled: false, enabledAt: null, source: "manual" },
    });
    return NextResponse.json({ ok: true, moduleKey, action, enabled: false });
  } catch (error) {
    return routeError("POST /api/modules", error);
  }
}
