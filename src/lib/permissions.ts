/**
 * Minimal role/permission resolver (Milestone 1).
 *
 * RolePermission rows are not consulted yet — this is the single place that
 * will grow into that check. Today it encodes the role rules the product
 * already assumes, so new routes stop re-implementing string comparisons.
 */
export type Permission =
  | "ai:usage:read" // tenant-wide AI spend and failure history
  | "ai:recommendations:write" // accept/dismiss generated recommendations
  | "users:read:sensitive"; // staff emails and phone numbers

const MIN_ROLE_LEVEL: Record<Permission, number> = {
  "ai:usage:read": 80, // OWNER, ADMIN
  "ai:recommendations:write": 60, // OWNER, ADMIN, MANAGER
  "users:read:sensitive": 60, // OWNER, ADMIN, MANAGER
};

const ROLE_LEVEL: Record<string, number> = {
  SUPER_ADMIN: 100,
  OWNER: 90,
  ADMIN: 80,
  MANAGER: 60,
  CASHIER: 20,
  STOCK_KEEPER: 20,
  KITCHEN: 10,
  RESELLER: 0,
};

export function can(role: string, permission: Permission): boolean {
  const level = ROLE_LEVEL[role] ?? 0;
  return level >= MIN_ROLE_LEVEL[permission];
}

/** Roles that may change organisation-wide settings. */
export function isAdminRole(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/**
 * Owner/admin check for the organisation-wide API guards (settings, locations,
 * payment gateways, plan changes).
 *
 * Demo tenants (`Tenant.demoMode`, see prisma/schema.prisma) bypass the role
 * test: the seeded demo logins exist to show the product to a reviewer, and a
 * cashier login that can open Settings but not save it demonstrates a bug
 * rather than a permission model. Real tenants never set demoMode.
 */
export function isAdminUser(user: {
  role: string;
  tenant?: { demoMode?: boolean | null } | null;
}): boolean {
  return user.tenant?.demoMode === true || isAdminRole(user.role);
}

export class PermissionDeniedError extends Error {
  public readonly status = 403;
  public readonly code = "FORBIDDEN";
  constructor(permission: Permission) {
    super(`Your role does not allow ${permission}`);
    this.name = "PermissionDeniedError";
  }
}
