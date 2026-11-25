import { NextResponse } from "next/server";
import { parseBody, routeError } from "@/lib/api-guards";
import { disconnectConnection, getConnection, updateConnection } from "@/lib/connect/connections";
import { requireConnectAccess } from "@/lib/connect/guard";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireConnectAccess();
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { id } = await params;
    const connection = await getConnection(user.tenantId, id);
    return NextResponse.json({ connection });
  } catch (error) {
    return routeError("GET /api/connect/connections/[id]", error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireConnectAccess({ write: true });
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { id } = await params;
    const body = await parseBody<Record<string, unknown>>(request);
    const allowed = new Set([
      "name",
      "baseUrl",
      "config",
      "credentials",
      "authType",
      "status",
      "regenerateWebhookSecret",
    ]);
    const unknown = Object.keys(body).filter((key) => !allowed.has(key));
    if (unknown.length > 0) {
      return NextResponse.json({ error: `Unknown field(s): ${unknown.join(", ")}` }, { status: 400 });
    }

    const connection = await updateConnection({ tenantId: user.tenantId, userId: user.id, id, input: body });
    return NextResponse.json({ connection });
  } catch (error) {
    return routeError("PATCH /api/connect/connections/[id]", error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireConnectAccess({ write: true });
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { id } = await params;
    const connection = await disconnectConnection({ tenantId: user.tenantId, userId: user.id, id });
    return NextResponse.json({ connection });
  } catch (error) {
    return routeError("DELETE /api/connect/connections/[id]", error);
  }
}
