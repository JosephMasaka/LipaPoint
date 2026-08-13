import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { initializeTransaction } from "@/lib/paystack";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

const PLAN_AMOUNTS: Record<string, number> = {
  STARTER: 2999,
  PROFESSIONAL: 7999,
  ENTERPRISE: 19999,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessName, businessType, plan, ownerName, email, phone, password } = body;

    if (!businessName || !businessType || !ownerName || !email || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existingUser = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existingUser) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    let slug = generateSlug(businessName);
    const existingTenant = await db.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const hashedPassword = await hashPassword(password);
    const tier = (plan as string) === "PROFESSIONAL" ? "PROFESSIONAL" : (plan as string) === "ENTERPRISE" ? "ENTERPRISE" : "STARTER";

    const tenant = await db.tenant.create({
      data: {
        name: businessName,
        slug,
        type: businessType,
        tier,
        email: email.toLowerCase().trim(),
        phone,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        locations: {
          create: {
            name: "Main Location",
            registers: { create: { name: "Register 1" } },
          },
        },
        users: {
          create: {
            name: ownerName,
            email: email.toLowerCase().trim(),
            phone,
            password: hashedPassword,
            role: "OWNER",
          },
        },
      },
      include: { users: true, locations: true },
    });

    const user = tenant.users[0];
    await createSession({ id: user.id, tenantId: tenant.id, role: user.role, tenant: { slug: tenant.slug } });

    await db.activityLog.create({
      data: {
        action: "TENANT_CREATED",
        entity: "tenant",
        entityId: tenant.id,
        tenantId: tenant.id,
        userId: user.id,
      },
    });

    const amount = PLAN_AMOUNTS[tier] || 2999;
    let paymentUrl: string | null = null;

    if (process.env.PAYSTACK_SECRET_KEY) {
      try {
        const txn = await initializeTransaction({
          email: email.toLowerCase().trim(),
          amount,
          metadata: { tenantId: tenant.id, plan: tier },
          callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${slug}/dashboard?payment=success`,
        });
        paymentUrl = txn.data.authorization_url;
      } catch {
        // Payment init failed — continue with free trial
      }
    }

    return NextResponse.json({
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      paymentUrl,
    }, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
