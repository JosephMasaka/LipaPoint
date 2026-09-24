import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getTransaction } from "@/lib/palpluss";
import { completeUpgradeFromTransaction } from "@/lib/plan-upgrade";

export async function GET(
  request: NextRequest,
  { params }: { params: { upgradeTransactionId: string } }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let record = await db.transaction.findUnique({
    where: { id: params.upgradeTransactionId },
  });

  // Ownership check — don't let one tenant poll another tenant's upgrade.
  if (!record || record.tenantId !== currentUser.tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (record.status === "PENDING" && record.gatewayRef) {
    try {
      const txn = await getTransaction(record.gatewayRef);
      if (txn.data.status !== "PENDING") {
        await completeUpgradeFromTransaction(record.id, {
          id: txn.data.id,
          status: txn.data.status,
          amount: txn.data.amount,
          phone_number: txn.data.phone_number,
          mpesa_receipt: txn.data.mpesa_receipt,
          result_code: txn.data.result_code,
          result_desc: txn.data.result_desc,
          provider_request_id: txn.data.provider_request_id,
        });
        record = await db.transaction.findUnique({ where: { id: record.id } });
      }
    } catch (err) {
      console.error(
        "Failed to reconcile PalPluss upgrade transaction",
        record.gatewayRef,
        err
      );
    }
  }

  const tierMatch = record!.type.match(/^UPGRADE:(\w+)$/);

  return NextResponse.json({
    status: record!.status, // PENDING | COMPLETED | FAILED
    tier: tierMatch ? tierMatch[1] : null,
    failureReason: record!.status === "FAILED" ? record!.gatewayStatus : null,
  });
}