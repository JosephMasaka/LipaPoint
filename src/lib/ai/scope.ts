import { db } from "@/lib/db";
import type { AiScopeInfo } from "./types";

const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 30;
const MAX_DAYS = 366;

export class AiScopeError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
    this.name = "AiScopeError";
  }
}

export interface RawAiScopeInput {
  from?: unknown;
  to?: unknown;
  locationId?: unknown;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

/** Parses an ISO date from the client, rejecting anything unparseable. */
function parseDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new AiScopeError(`${field} must be an ISO date string`, 400, "INVALID_DATE");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AiScopeError(`${field} is not a valid date`, 400, "INVALID_DATE");
  }
  return date;
}

/**
 * Resolves the only scope a request may read.
 *
 * `tenantId` comes from the session, never the request. A branch is accepted
 * from the client only after it is verified to belong to that tenant — the
 * same ownership pattern as POST /api/orders.
 */
/** Branch lookup seam, so tests can prove the tenant filter without a database. */
export interface AiScopeDeps {
  findLocation: (where: {
    id: string;
    tenantId: string;
    isActive: true;
  }) => Promise<{ id: string; name: string } | null>;
}

const defaultDeps: AiScopeDeps = {
  findLocation: (where) => db.location.findFirst({ where, select: { id: true, name: true } }),
};

export async function resolveAiScope(
  user: { tenantId: string; tenant: { currency: string } },
  input: RawAiScopeInput = {},
  deps: AiScopeDeps = defaultDeps
): Promise<{ scope: AiScopeInfo; locationName: string | null }> {
  const now = new Date();
  const explicitTo = parseDate(input.to, "to");
  const explicitFrom = parseDate(input.from, "from");

  // Snap explicit dates to UTC day boundaries so repeated loads share one
  // cache entry and citations describe whole days, not arbitrary instants.
  // Defaults are snapped to UTC day boundaries as well. Both the narrative and
  // the intelligence caches are keyed on scope.from/scope.to, so a millisecond-
  // precise default would mint a fresh key — and a fresh model call — on every
  // load. A whole-day default keeps one cache entry per tenant/branch/day.
  const to = endOfUtcDay(explicitTo ?? now);
  const from = explicitFrom
    ? startOfUtcDay(explicitFrom)
    : startOfUtcDay(new Date((explicitTo ?? now).getTime() - (DEFAULT_DAYS - 1) * DAY));

  // Today is allowed (it becomes end-of-day); a later day is not.
  if (explicitTo && startOfUtcDay(explicitTo).getTime() > startOfUtcDay(now).getTime()) {
    throw new AiScopeError("to cannot be in the future", 400, "FUTURE_DATE");
  }

  if (from.getTime() > to.getTime()) {
    throw new AiScopeError("from must be before to", 400, "INVALID_RANGE");
  }
  if (to.getTime() - from.getTime() > MAX_DAYS * DAY) {
    throw new AiScopeError(`Date range cannot exceed ${MAX_DAYS} days`, 400, "RANGE_TOO_LARGE");
  }

  let locationId: string | null = null;
  let locationName: string | null = null;

  if (input.locationId !== undefined && input.locationId !== null && input.locationId !== "") {
    if (typeof input.locationId !== "string") {
      throw new AiScopeError("locationId must be a string", 400, "INVALID_LOCATION");
    }
    const location = await deps.findLocation({
      id: input.locationId,
      tenantId: user.tenantId,
      isActive: true,
    });
    if (!location) {
      throw new AiScopeError("Location not found for this business", 404, "LOCATION_NOT_FOUND");
    }
    locationId = location.id;
    locationName = location.name;
  }

  return {
    scope: {
      tenantId: user.tenantId,
      from: from.toISOString(),
      to: to.toISOString(),
      locationId,
      locationName,
      currency: user.tenant.currency || "KES",
    },
    locationName,
  };
}
