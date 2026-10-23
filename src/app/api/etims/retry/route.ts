import { NextRequest, NextResponse } from "next/server";
import { retryPendingEtims } from "@/lib/etims/submission";
import { requireUserWithModule, routeError, parseBody } from "@/lib/api-guards";

/**
 * POST /api/etims/retry — bulk retry of the unreachable pile.
 *
 * Only re-sends rows still `pending` (OSCU was down / timed out). Rows
 * `rejected` by KRA are intentionally skipped: their payload is wrong and
 * resending it unchanged would just hammer KRA and fail again — those need
 * a human fix first. Body: { limit? }.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("etims");
    if (auth.response) return auth.response;
    const { user } = auth;

    const body = await parseBody<{ limit?: number }>(request).catch(() => ({}) as { limit?: number });
    const result = await retryPendingEtims(user.tenantId, {
      limit: Number.isFinite(body.limit) ? Number(body.limit) : 25,
      userId: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    return routeError("POST /api/etims/retry", error);
  }
}
