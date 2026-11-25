import { NextResponse } from "next/server";
import { parseBody, routeError } from "@/lib/api-guards";
import { createConnection, listConnections } from "@/lib/connect/connections";
import { requireConnectAccess } from "@/lib/connect/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireConnectAccess();
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const data = await listConnections(user.tenantId, user.tenant.tier);
    return NextResponse.json(data);
  } catch (error) {
    return routeError("GET /api/connect/connections", error);
  }
}

export async function POST(request: Request) {
  const auth = await requireConnectAccess({ write: true });
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const body = await parseBody<Record<string, unknown>>(request);
    const allowed = new Set(["providerId", "name", "authType", "baseUrl", "config", "credentials", "entities"]);
    const unknown = Object.keys(body).filter((key) => !allowed.has(key));
    if (unknown.length > 0) {
      return NextResponse.json({ error: `Unknown field(s): ${unknown.join(", ")}` }, { status: 400 });
    }

    const connection = await createConnection({
      tenantId: user.tenantId,
      userId: user.id,
      tier: user.tenant.tier,
      input: body,
    });
    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    return routeError("POST /api/connect/connections", error);
  }
}
