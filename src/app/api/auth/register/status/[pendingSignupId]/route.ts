import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTransaction } from "@/lib/palpluss";
import { completeSignupFromTransaction } from "@/lib/signup-completion";

export async function GET(
  request: NextRequest,
  { params }: { params: { pendingSignupId: string } }
) {
  let pending = await db.pendingSignup.findUnique({
    where: { id: params.pendingSignupId },
  });

  if (!pending) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Don't rely solely on the webhook having arrived — it may be delayed,
  // dropped, or (in local dev, if callbackUrl points at localhost)
  // unreachable entirely. Actively check PalPluss directly whenever we're
  // still PENDING and know the transaction id.
  if (pending.status === "PENDING" && pending.transactionId) {
    try {
      const txn = await getTransaction(pending.transactionId);
      if (txn.data.status !== "PENDING") {
        await completeSignupFromTransaction(pending.id, {
          id: txn.data.id,
          status: txn.data.status,
          amount: txn.data.amount,
          phone_number: txn.data.phone_number,
          mpesa_receipt: txn.data.mpesa_receipt,
          result_code: txn.data.result_code,
          result_desc: txn.data.result_desc,
          provider_request_id: txn.data.provider_request_id,
        });
        pending = await db.pendingSignup.findUnique({ where: { id: pending.id } });
      }
    } catch (err) {
      console.error(
        "Failed to reconcile PalPluss transaction status",
        pending.transactionId,
        err
      );
      // Not fatal — keep reporting current DB status, client keeps polling.
    }
  }

  return NextResponse.json({
    status: pending!.status,
    failureReason: pending!.failureReason ?? null,
  });
}