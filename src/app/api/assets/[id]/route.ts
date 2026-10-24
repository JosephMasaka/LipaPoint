import { NextRequest, NextResponse } from "next/server";
import { updateAsset, deleteAsset, AssetError, type UpdateAssetInput } from "@/lib/assets";
import { requireUserWithModule, routeError, parseBody } from "@/lib/api-guards";

/**
 * PATCH /api/assets/[id] — edit an open asset (fields, assignment, method,
 * lifecycle between in_service / under_maintenance). Disposed and lost are
 * terminal and only settable through the dispose endpoint, because they
 * post to the GL.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithModule("assets");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const body = await parseBody<UpdateAssetInput>(request);
    const asset = await updateAsset(user.tenantId, id, body, user.id);
    return NextResponse.json(asset);
  } catch (error) {
    if (error instanceof AssetError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("PATCH /api/assets/[id]", error);
  }
}

/**
 * DELETE /api/assets/[id] — open assets only. Anything that has touched
 * the GL (depreciated or disposed) must stay so the ledger adds up.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserWithModule("assets");
    if (auth.response) return auth.response;
    const { user } = auth;

    const { id } = await params;
    const result = await deleteAsset(user.tenantId, id, user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AssetError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("DELETE /api/assets/[id]", error);
  }
}
