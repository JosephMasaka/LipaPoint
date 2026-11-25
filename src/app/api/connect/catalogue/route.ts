import { NextResponse } from "next/server";
import { routeError } from "@/lib/api-guards";
import { connectionUsage } from "@/lib/connect/connections";
import { requireConnectAccess } from "@/lib/connect/guard";
import { PROVIDERS } from "@/lib/connect/registry";

export const dynamic = "force-dynamic";

/** Read-only catalogue: which integrations exist, and which are real today. */
export async function GET() {
  const auth = await requireConnectAccess();
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const usage = await connectionUsage(user.tenantId, user.tenant.tier);
    return NextResponse.json({
      providers: PROVIDERS,
      usage,
    });
  } catch (error) {
    return routeError("GET /api/connect/catalogue", error);
  }
}
