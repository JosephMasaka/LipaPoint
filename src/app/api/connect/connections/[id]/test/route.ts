import { NextResponse } from "next/server";
import { routeError } from "@/lib/api-guards";
import { testConnection } from "@/lib/connect/connections";
import { requireConnectAccess } from "@/lib/connect/guard";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireConnectAccess({ write: true });
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const { id } = await params;
    const result = await testConnection({ tenantId: user.tenantId, userId: user.id, id });
    return NextResponse.json(result);
  } catch (error) {
    return routeError("POST /api/connect/connections/[id]/test", error);
  }
}
