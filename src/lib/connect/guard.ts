import { NextResponse } from "next/server";
import { getCurrentUser } from "../auth";
import { isAdminRole } from "../permissions";
import { connectionLimitForTier } from "./limits";

/**
 * Guard for every tenant-scoped Connect route.
 *
 * Three checks, in order:
 * 1. session (401) — `getCurrentUser()` reads the cookie, never a header;
 * 2. plan entitlement (403) — a tier whose connection limit is 0 has no
 *    Connect, and the same number the API enforces is the one the UI shows;
 * 3. role for writes (403) — OWNER/ADMIN only. Deliberately not
 *    `isAdminUser()`, which lets demo tenants bypass role checks: rotating
 *    credentials and disconnecting a system must not be a demo-bypass action.
 *
 * Middleware exempts `/api/*` (see REPOSITORY_AUDIT.md §10), so this guard is
 * the route's only authentication. Every handler under /api/connect calls it
 * except the webhook and cron tick, which authenticate by HMAC and
 * `CRON_SECRET` respectively.
 */
export async function requireConnectAccess(options: { write?: boolean } = {}): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; limit: number; response?: undefined }
  | { user?: undefined; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const limit = connectionLimitForTier(user.tenant.tier);
  if (limit <= 0) {
    return {
      response: NextResponse.json(
        {
          error: "LipaPoint Connect is not included in your plan",
          code: "CONNECT_FEATURE_NOT_IN_PLAN",
        },
        { status: 403 }
      ),
    };
  }

  if (options.write && !isAdminRole(user.role)) {
    return {
      response: NextResponse.json(
        { error: "Only owners and admins can change integrations", code: "CONNECT_FORBIDDEN" },
        { status: 403 }
      ),
    };
  }

  return { user, limit };
}
