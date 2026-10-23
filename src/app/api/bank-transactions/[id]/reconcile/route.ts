import { NextRequest, NextResponse } from "next/server";
import { reconcileBankTransaction } from "@/lib/bank";
import { requireUserWithModule, routeError, parseBody } from "@/lib/api-guards";

/**
 * POST /api/bank-transactions/[id]/reconcile
 * Marks a bank transaction reconciled, optionally matched to a journal
 * line (e.g. an individual POS sale's income line).
 * Body: { matchedJournalLineId? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithModule("finance");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const body = await parseBody<{ matchedJournalLineId?: string }>(request).catch(
      () => ({}) as { matchedJournalLineId?: string }
    );

    const txn = await reconcileBankTransaction(
      user.tenantId,
      id,
      body.matchedJournalLineId ?? null
    );

    return NextResponse.json(txn);
  } catch (error) {
    return routeError("POST /api/bank-transactions/[id]/reconcile", error);
  }
}
