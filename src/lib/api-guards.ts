import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import { requireModule, ModuleNotEnabledError, type ModuleKey } from "./modules";
import { requireFeature, FeatureNotEnabledError, type FeatureKey } from "./features";
import type { Prisma } from "@prisma/client";

/**
 * Shared route guards for ERP API routes (Phase 1+).
 *
 * Every tenant-scoped route needs the same two checks — session and
 * module entitlement — plus consistent error envelopes for the domain
 * errors the services throw. Keeping them here stops 14 route files from
 * each inventing their own.
 */

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * Resolves the caller or returns an error response:
 *   { user } on success, { response } otherwise.
 *
 * `moduleKey` additionally enforces the ERP module gate, so a starter-plan
 * tenant hitting /api/suppliers gets 403, not silently-empty data.
 */
export async function requireUserWithModule(moduleKey?: ModuleKey): Promise<
  { user: SessionUser; response?: undefined } | { user?: undefined; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (moduleKey) {
    try {
      await requireModule(user.tenantId, moduleKey);
    } catch (error) {
      if (error instanceof ModuleNotEnabledError) {
        return {
          response: NextResponse.json(
            { error: `Module "${moduleKey}" is not enabled for your plan` },
            { status: 403 }
          ),
        };
      }
      throw error;
    }
  }
  return { user };
}

/**
 * Same contract as requireUserWithModule, one granularity down (sub-feature
 * spec §3/§4): `featureKey` enforces the sub-feature gate, so a tenant that
 * bought Payroll but not Attendance gets 403 on /api/hr/attendance rather
 * than silently-empty data. Routes not yet decomposed keep the coarser
 * module guard above — both stay, neither replaces the other.
 */
export async function requireUserWithFeature(featureKey: FeatureKey): Promise<
  { user: SessionUser; response?: undefined } | { user?: undefined; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  try {
    await requireFeature(user.tenantId, featureKey);
  } catch (error) {
    if (error instanceof FeatureNotEnabledError) {
      return {
        response: NextResponse.json({ error: error.message }, { status: 403 }),
      };
    }
    throw error;
  }
  return { user };
}

/**
 * Maps a caught error to a JSON response. Domain errors (anything with a
 * numeric `status`) keep their status and message; the rest become a
 * generic 500 with the route label for logs.
 */
export function routeError(label: string, error: unknown): NextResponse {
  if (error instanceof Error && "status" in error && typeof (error as { status: unknown }).status === "number") {
    return NextResponse.json(
      { error: error.message },
      { status: (error as { status: number }).status }
    );
  }
  console.error(`${label} error:`, error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** Small wrapper so routes can parse JSON body without repeating try/catch noise. */
export async function parseBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

/** Standard pagination envelope used by the customers route. */
export function pagination(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

export type { Prisma };
