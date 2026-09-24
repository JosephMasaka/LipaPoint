import { db } from "@/lib/db";
import { describeFailure, type PalPlussTransactionLike } from "@/lib/signup-completion";
import { sendEmail, planUpgradeEmail } from "@/lib/email";

type UpgradeResult =
  | { ok: true; alreadyProcessed?: true }
  | { ok: false; reason: string };

/**
 * Transaction.type is set to "UPGRADE:<TIER>" at initiation (see the
 * subscribe route) so the target tier can be recovered here without a
 * schema change. If you'd rather have a dedicated column for this,
 * migrating to that is cleaner long-term — this is the pragmatic version
 * against the existing schema.
 */
function extractTargetTier(type: string): string | null {
  const match = type.match(/^UPGRADE:(\w+)$/);
  return match ? match[1] : null;
}

export async function completeUpgradeFromTransaction(
  upgradeTransactionId: string, // our db Transaction.id, used as accountReference
  txn: PalPlussTransactionLike
): Promise<UpgradeResult> {
  const record = await db.transaction.findUnique({ where: { id: upgradeTransactionId } });
  if (!record) return { ok: false, reason: "upgrade_transaction_not_found" };
  if (record.status !== "PENDING") return { ok: true, alreadyProcessed: true };

  const targetTier = extractTargetTier(record.type);

  if (txn.status === "SUCCESS") {
    await db.transaction.update({
      where: { id: record.id },
      data: {
        status: "COMPLETED",
        reference: txn.id,
        gatewayRef: txn.mpesa_receipt ?? txn.provider_request_id ?? undefined,
        gatewayStatus: txn.result_desc ?? undefined,
        mpesaPhone: txn.phone_number,
      },
    });

    if (!targetTier) {
      // Shouldn't happen — flag loudly rather than silently leaving the
      // tenant's tier unchanged after they've already paid.
      console.error(
        "Upgrade completion: could not parse target tier from transaction.type",
        record.id,
        record.type
      );
      return { ok: true };
    }

    const tenant = await db.tenant.update({
      where: { id: record.tenantId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { tier: targetTier as any },
    });

    const existingSub = await db.subscription.findFirst({ where: { tenantId: tenant.id } });
    const subData = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tier: targetTier as any,
      amount: record.amount,
      currency: "KES",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    if (existingSub) {
      await db.subscription.update({ where: { id: existingSub.id }, data: subData });
    } else {
      await db.subscription.create({ data: { tenantId: tenant.id, ...subData } });
    }

    await db.activityLog.create({
      data: {
        action: "PLAN_UPGRADED",
        entity: "subscription",
        entityId: tenant.id,
        tenantId: tenant.id,
        userId: record.userId ?? undefined,
      },
    });

    if (record.userId) {
      const user = await db.user.findUnique({ where: { id: record.userId } });
      if (user) {
        const emailContent = planUpgradeEmail(user.name, tenant.name, targetTier);
        sendEmail({ to: user.email, ...emailContent }).catch(() => {});
      }
    }

    return { ok: true };
  }

  // FAILED, CANCELLED, or EXPIRED — tenant's tier is left untouched.
  const message = describeFailure(txn.status, txn.result_code, txn.result_desc);
  await db.transaction.update({
    where: { id: record.id },
    data: { status: "FAILED", gatewayStatus: message, reference: txn.id },
  });
  return { ok: false, reason: message };
}