import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getTenantGatewayAdapter } from "@/lib/payment-gateways/registry";

// Each provider gets its own webhook (different payload shapes) — this
// picks which one to register as the callback for this transaction.
const CALLBACK_PATH_BY_PROVIDER: Record<string, string> = {
  DARAJA: "/api/webhooks/daraja",
  PALPLUSS: "/api/webhooks/palpluss",
};

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { orderId, provider, phone } = body ?? {};

  if (!orderId || !provider || !phone) {
    return NextResponse.json({ error: "orderId, provider, and phone are required" }, { status: 400 });
  }

  const callbackPath = CALLBACK_PATH_BY_PROVIDER[provider];
  if (!callbackPath) {
    return NextResponse.json(
      { error: `${provider} isn't available for POS payments yet.` },
      { status: 400 }
    );
  }

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.tenantId !== currentUser.tenantId) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // /api/orders already created a PENDING Transaction for this order (see
  // the isPendingStk branch there) — find it rather than creating a second
  // one for the same sale.
  const transaction = await db.transaction.findFirst({
    where: { orderId: order.id, status: "PENDING" },
  });
  if (!transaction) {
    return NextResponse.json({ error: "No pending payment found for this order" }, { status: 409 });
  }

  let adapter;
  try {
    adapter = await getTenantGatewayAdapter(currentUser.tenantId, provider);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load payment gateway" },
      { status: 400 }
    );
  }

  try {
    const result = await adapter.initiateCollection({
      phone,
      // M-Pesa requires whole-shilling amounts — order.total can carry
      // fractional cents from the tax calculation upstream.
      amount: Math.round(order.total),
      reference: transaction.id,
      description: `Order ${order.orderNo}`,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}${callbackPath}`,
    });

    await db.transaction.update({
      where: { id: transaction.id },
      data: { gatewayRef: result.providerTransactionId },
    });

    return NextResponse.json({ transactionId: transaction.id }, { status: 202 });
  } catch (err) {
    console.error("POS payment initiation failed for order", order.id, err);
    await db.transaction.update({
      where: { id: transaction.id },
      data: { status: "FAILED", gatewayStatus: "Payment initiation failed" },
    });
    await db.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED", paymentStatus: "FAILED" },
    });
    return NextResponse.json({ error: "Could not start payment. Please try again." }, { status: 502 });
  }
}