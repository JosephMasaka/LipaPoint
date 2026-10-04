import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { encryptJSON } from "@/lib/crypto";

const VALID_PROVIDERS = ["DARAJA", "INTASEND", "PESAPAL", "KOPOKOPO", "FLUTTERWAVE", "PALPLUSS"] as const;

// Shape of `credentials` differs per provider — this route stores whatever
// object it's given, encrypted whole. The adapter for each provider is
// what defines/expects the actual shape:
//   DARAJA:   { consumerKey, consumerSecret, shortCode, passkey, environment? }
//   PALPLUSS: { secretKey, channelId? }
//   others:   not implemented yet — see lib/payment-gateways/registry.ts
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { provider, credentials, merchantRef } = body ?? {};

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }
  if (!credentials || typeof credentials !== "object") {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  let credentialsEnc: string;
  try {
    credentialsEnc = encryptJSON(credentials);
  } catch (err) {
    console.error("Failed to encrypt gateway credentials:", err);
    return NextResponse.json({ error: "Server encryption is not configured" }, { status: 500 });
  }

  const gateway = await db.tenantPaymentGateway.upsert({
    where: { tenantId_provider: { tenantId: user.tenantId, provider } },
    create: {
      tenantId: user.tenantId,
      provider,
      credentialsEnc,
      merchantRef,
      isActive: true,
    },
    update: {
      credentialsEnc,
      ...(merchantRef !== undefined && { merchantRef }),
      isActive: true,
    },
  });

  // Never echo credentials back, even encrypted.
  return NextResponse.json({ provider: gateway.provider, isActive: gateway.isActive });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const provider = body?.provider;
  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  await db.tenantPaymentGateway.updateMany({
    where: { tenantId: user.tenantId, provider },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}