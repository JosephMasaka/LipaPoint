import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { pendingSignupId, completionToken } = body ?? {};

  if (!pendingSignupId || !completionToken) {
    return NextResponse.json({ error: "Missing pendingSignupId or completionToken" }, { status: 400 });
  }

  const pending = await db.pendingSignup.findUnique({ where: { id: pendingSignupId } });

  if (!pending || !safeEqual(pending.completionToken, completionToken)) {
    return NextResponse.json({ error: "Invalid or expired signup" }, { status: 403 });
  }

  if (pending.status !== "COMPLETED" || !pending.tenantId || !pending.userId) {
    return NextResponse.json({ error: "Payment not yet confirmed" }, { status: 409 });
  }

  const tenant = await db.tenant.findUnique({ where: { id: pending.tenantId } });
  const user = await db.user.findUnique({ where: { id: pending.userId } });

  if (!tenant || !user) {
    // Shouldn't happen — the webhook created both before marking COMPLETED.
    console.error("complete-login: tenant/user missing for completed pending signup", pendingSignupId);
    return NextResponse.json({ error: "Something went wrong. Please contact support." }, { status: 500 });
  }

  await createSession({ id: user.id, tenantId: tenant.id, role: user.role, tenant: { slug: tenant.slug } });

  return NextResponse.json({
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}