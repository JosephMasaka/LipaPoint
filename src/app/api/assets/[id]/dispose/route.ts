import { NextRequest, NextResponse } from "next/server";
import { disposeAsset, AssetError, type DisposeAssetInput } from "@/lib/assets";
import { requireUserWithModule, routeError, parseBody } from "@/lib/api-guards";

/**
 * POST /api/assets/[id]/dispose — closes an asset against the GL:
 *   DR 1510 Accumulated Depreciation (what's been written off)
 *   DR <wallet> proceeds (cash received, if any)
 *   CR 1500 Fixed Assets (original cost)
 *   CR 4200 gain / DR 6800 loss (the balance vs book value)
 *
 * Body: { proceeds?: number, bankAccountId?: string, lost?: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithModule("assets");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const body = await parseBody<DisposeAssetInput>(request);
    const result = await disposeAsset({
      ...body,
      tenantId: user.tenantId,
      assetId: id,
      userId: user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AssetError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("POST /api/assets/[id]/dispose", error);
  }
}
