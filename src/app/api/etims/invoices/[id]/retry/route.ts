import { NextRequest, NextResponse } from "next/server";
import { retryEtimsInvoice, EtimsError } from "@/lib/etims/submission";
import { requireUserWithFeature, routeError } from "@/lib/api-guards";

/**
 * POST /api/etims/invoices/[id]/retry — resubmit one pending/rejected
 * invoice. Accepted rows are refused (already filed with KRA) and rows
 * awaiting confirmation are refused (retrying is how duplicates happen).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithFeature("etims-submission");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const row = await retryEtimsInvoice(user.tenantId, id, user.id);
    return NextResponse.json(row);
  } catch (error) {
    if (error instanceof EtimsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("POST /api/etims/invoices/[id]/retry", error);
  }
}
