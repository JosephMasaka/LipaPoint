import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";

/**
 * One-click demo sign-in. Deliberately password-less, so the only thing that
 * makes it safe is `tenant.demoMode`: real customer tenants have it false and
 * are rejected here before any user is looked up. Do not relax that check —
 * it is the whole boundary between a demo shortcut and an auth bypass.
 *
 * Retired: the public demo accounts are switched off, so every request is
 * redirected to the demo-request form before any lookup happens. Flip this to
 * true only together with a deliberate decision to hand out shared logins
 * again — the `demoMode` guard below still applies either way.
 */
const DEMO_LOGIN_ENABLED = false;

// Preferred landing account per demo workspace: whoever sees the whole app.
const DEMO_ROLES: UserRole[] = [UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER];

function back(request: NextRequest, path: string, status = 303) {
  return NextResponse.redirect(new URL(path, request.url), status);
}

export async function POST(request: NextRequest) {
  if (!DEMO_LOGIN_ENABLED) return back(request, "/demo-request");

  let slug = "";
  let email = "";

  try {
    const form = await request.formData();
    slug = String(form.get("tenant") ?? "").trim().toLowerCase();
    email = String(form.get("email") ?? "").trim().toLowerCase();
  } catch {
    return back(request, "/demo?error=invalid");
  }

  if (!slug) return back(request, "/demo?error=invalid");

  const tenant = await db.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, type: true, isActive: true, demoMode: true },
  });

  // PLATFORM carries demoMode too, but a one-click super-admin session must
  // never be reachable from the marketing site.
  if (!tenant || tenant.demoMode !== true || !tenant.isActive || tenant.type === "PLATFORM") {
    return back(request, "/demo?error=unavailable");
  }

  const where = { tenantId: tenant.id, isActive: true, ...(email ? { email } : {}) };
  const user =
    (await db.user.findFirst({
      where: { ...where, role: { in: DEMO_ROLES } },
      select: { id: true, role: true },
    })) ??
    (await db.user.findFirst({ where, select: { id: true, role: true } }));

  if (!user) return back(request, "/demo?error=unavailable");

  await createSession({
    id: user.id,
    tenantId: tenant.id,
    role: user.role,
    tenant: { slug: tenant.slug },
  });

  await db.activityLog.create({
    data: {
      action: "LOGIN",
      entity: "user",
      entityId: user.id,
      tenantId: tenant.id,
      userId: user.id,
    },
  });

  return back(request, `/${tenant.slug}/dashboard`);
}
