import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

function encrypt(value: string): string {
  return Buffer.from(value).toString("base64");
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  const { provider, apiKey, apiSecret, merchantRef } = await request.json();

  const gateway = await db.tenantPaymentGateway.upsert({
    where: { tenantId_provider: { tenantId: user.tenantId, provider } },
    create: {
      tenantId: user.tenantId,
      provider,
      apiKeyEnc: apiKey ? encrypt(apiKey) : null,
      apiSecretEnc: apiSecret ? encrypt(apiSecret) : null,
      merchantRef,
      isActive: true,
    },
    update: {
      ...(apiKey && { apiKeyEnc: encrypt(apiKey) }),
      ...(apiSecret && { apiSecretEnc: encrypt(apiSecret) }),
      ...(merchantRef !== undefined && { merchantRef }),
      isActive: true,
    },
  });
  return NextResponse.json({ provider: gateway.provider, isActive: gateway.isActive });
}