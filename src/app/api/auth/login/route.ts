import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { comparePassword, createSession, createResellerSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      include: { tenant: true },
    });

    if (!user) {
      // Not a tenant user — check the reseller portal.
      const reseller = await db.reseller.findUnique({ where: { email: normalizedEmail } });
      if (!reseller || !reseller.isActive) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }

      const validReseller = await comparePassword(password, reseller.password);
      if (!validReseller) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }

      await createResellerSession({ id: reseller.id });

      return NextResponse.json({
        user: { id: reseller.id, name: reseller.name, email: reseller.email, role: "RESELLER" },
        reseller: { id: reseller.id, name: reseller.name, code: reseller.code },
      });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!user.tenant.isActive) {
      return NextResponse.json({ error: "Your account has been deactivated. Contact support." }, { status: 403 });
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await createSession({ id: user.id, tenantId: user.tenantId, role: user.role, tenant: { slug: user.tenant.slug } });

    await db.activityLog.create({
      data: {
        action: "LOGIN",
        entity: "user",
        entityId: user.id,
        tenantId: user.tenantId,
        userId: user.id,
      },
    });

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      tenant: { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug, type: user.tenant.type },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
