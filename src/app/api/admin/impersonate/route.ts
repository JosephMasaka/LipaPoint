import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, startImpersonation } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Signs the super-admin in as one of the tenant's users, parking the admin
 * session in a backup cookie (restored via POST /api/admin/impersonate/exit).
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((user.role as string) !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const tenantId = body?.tenantId;
  if (!tenantId || typeof tenantId !== "string") {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true, isActive: true, type: true },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  if ((tenant.type as string) === "PLATFORM") {
    return NextResponse.json({ error: "Can't open the platform tenant" }, { status: 400 });
  }
  if (!tenant.isActive) {
    return NextResponse.json({ error: "Activate the tenant before opening it" }, { status: 400 });
  }

  // Prefer the owner; fall back to any active staff account.
  const target =
    (await db.user.findFirst({
      where: { tenantId, isActive: true, role: "OWNER" },
      select: { id: true, tenantId: true, role: true },
    })) ??
    (await db.user.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, tenantId: true, role: true },
    }));

  if (!target) {
    return NextResponse.json(
      { error: "This tenant has no active users to open" },
      { status: 400 }
    );
  }

  try {
    await startImpersonation({
      id: target.id,
      tenantId: target.tenantId,
      role: target.role,
      tenantSlug: tenant.slug,
    });
  } catch {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    slug: tenant.slug,
    redirect: `/${tenant.slug}/dashboard`,
  });
}
