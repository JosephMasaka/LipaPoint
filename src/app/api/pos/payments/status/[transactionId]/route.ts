import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getTenantGatewayAdapter } from "@/lib/payment-gateways/registry";
import { completeOrderPayment } from "@/lib/payment-gateways/order-completion";

export async function GET(
  request: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let record = await db.transaction.findUnique({ where: { id: params.transactionId } });
  if (!record || record.tenantId !== currentUser.tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (record.status === "PENDING" && record.gatewayRef && record.provider) {
    try {
      const adapter = await getTenantGatewayAdapter(currentUser.tenantId, record.provider);
      if (adapter.getStatus) {
        const result = await adapter.getStatus(record.gatewayRef);
        if (result.status !== "PENDING") {
          await completeOrderPayment(record.id, {
            status: result.status,
            receiptNumber: result.receiptNumber,
            resultDesc: result.resultDesc,
          });
          record = await db.transaction.findUnique({ where: { id: record.id } });
        }
      }
    } catch (err) {
      console.error("Failed to reconcile POS payment", record.id, err);
    }
  }

  return NextResponse.json({
    status: record!.status,
    failureReason: record!.status === "FAILED" ? record!.gatewayStatus : null,
  });
}