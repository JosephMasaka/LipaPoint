import { db } from "@/lib/db";

interface OrderPaymentResult {
  status: "SUCCESS" | "FAILED";
  receiptNumber?: string;
  resultDesc?: string;
}

/**
 * Called from provider webhooks and poll-fallbacks once a pending STK
 * transaction reaches a terminal state. Idempotent via the PENDING check.
 *
 * Stock is intentionally NOT decremented in /api/orders for STK sales —
 * it's committed here, only once payment actually clears. On failure,
 * nothing was ever decremented, so there's nothing to reverse.
 */
export async function completeOrderPayment(
  transactionId: string,
  result: OrderPaymentResult
): Promise<{ ok: boolean }> {
  const record = await db.transaction.findUnique({ where: { id: transactionId } });
  if (!record) return { ok: false };
  if (record.status !== "PENDING") return { ok: true }; // already handled
  if (!record.orderId) return { ok: false }; // not a POS sale transaction

  if (result.status === "SUCCESS") {
    await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: record.orderId! },
        include: { items: true },
      });
      if (!order) throw new Error(`Order ${record.orderId} not found`);

      for (const item of order.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product?.trackStock) continue;

        const stock = await tx.stock.findUnique({
          where: { productId_locationId: { productId: item.productId, locationId: order.locationId } },
        });

        if (!stock || stock.quantity < item.baseQuantity) {
          // Stock moved between order creation and payment confirming
          // (rare, but possible if the STK prompt sat pending a while).
          // Don't silently oversell — surface it so this gets seen rather
          // than the customer being marked paid for stock that no longer
          // exists.
          throw new Error(
            `Insufficient stock for product ${item.productId} at payment confirmation (order ${order.orderNo})`
          );
        }

        await tx.stock.update({
          where: { productId_locationId: { productId: item.productId, locationId: order.locationId } },
          data: { quantity: { decrement: item.baseQuantity } },
        });

        await tx.stockMovement.create({
          data: {
            type: "GOODS_ISSUE",
            quantity: item.baseQuantity,
            productId: item.productId,
            locationId: order.locationId,
            reference: order.orderNo,
            notes: `Sale - ${item.quantity} units (STK confirmed)`,
            tenantId: order.tenantId,
            userId: record.userId ?? undefined,
          },
        });
      }

      await tx.transaction.update({
        where: { id: record.id },
        data: {
          status: "COMPLETED",
          reference: result.receiptNumber ?? record.reference,
          gatewayRef: result.receiptNumber ?? record.gatewayRef,
          gatewayStatus: result.resultDesc,
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "COMPLETED",
          paymentStatus: "COMPLETED",
          paymentRef: result.receiptNumber ?? undefined,
        },
      });
    }, { timeout: 30000 });

    return { ok: true };
  }

  // FAILED — nothing was ever decremented, so there's nothing to reverse.
  await db.transaction.update({
    where: { id: record.id },
    data: { status: "FAILED", gatewayStatus: result.resultDesc },
  });
  await db.order.update({
    where: { id: record.orderId },
    data: { status: "CANCELLED", paymentStatus: "FAILED" },
  });

  return { ok: true };
}