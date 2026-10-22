import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE_NAME = "lipapoint-session";
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

/** Cookie holding the super-admin's own session while they impersonate a tenant. */
export const IMPERSONATION_BACKUP_COOKIE = "lipapoint-session-backup";

interface SessionPayload extends JWTPayload {
  // Platform users (SUPER_ADMIN included) carry userId/tenantId; reseller
  // portal sessions carry resellerId instead.
  userId?: string;
  tenantId?: string;
  tenantSlug?: string;
  resellerId?: string;
  role: string;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

// --- Password utilities ---

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// --- JWT utilities ---

export async function signToken(payload: SessionPayload): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(secret);
}

export async function verifyToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

// --- Session management ---

export async function createSession(user: {
  id: string;
  tenantId: string;
  role: string;
  tenant: { slug: string };
}): Promise<string> {
  const payload: SessionPayload = {
    userId: user.id,
    tenantId: user.tenantId,
    tenantSlug: user.tenant.slug,
    role: user.role,
  };

  const token = await signToken(payload);

  // Store session in database
  const expiresAt = new Date(Date.now() + SESSION_DURATION * 1000);
  await db.session.create({
    data: {
      token,
      userId: user.id,
      expiresAt,
    },
  });

  // Set cookie
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION,
  });

  return token;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    // Remove session from database
    await db.session.deleteMany({ where: { token } });
  }

  // Clear cookie
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  // If this logout happened mid-impersonation, drop the parked admin
  // session too so a stale backup token can't be restored later.
  cookieStore.set(IMPERSONATION_BACKUP_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

// --- Get current user ---

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    console.log("[AUTH] No session cookie found");
    return null;
  }

  console.log("[AUTH] Session cookie found");

  const payload = await verifyToken(token);

  if (!payload) {
    console.log("[AUTH] JWT verification failed");
    return null;
  }

  if (!payload.userId) {
    // Reseller portal session — not a tenant user.
    return null;
  }

  console.log("[AUTH] JWT verified:", {
    userId: payload.userId,
    tenantId: payload.tenantId,
    tenantSlug: payload.tenantSlug,
    role: payload.role,
  });

  const session = await db.session.findUnique({
    where: { token },
  });

  if (!session) {
    console.log("[AUTH] No database session found for JWT");
    return null;
  }

  if (session.expiresAt < new Date()) {
    console.log("[AUTH] Database session expired:", session.expiresAt);
    return null;
  }

  console.log("[AUTH] Database session valid");

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          tier: true,
          currency: true,
          taxRate: true,
          logo: true,
          isActive: true,
        },
      },
    },
  });

  if (!user) {
    console.log("[AUTH] User not found:", payload.userId);
    return null;
  }

  if (!user.isActive) {
    console.log("[AUTH] User is inactive:", user.id);
    return null;
  }

  if (!user.tenant) {
    console.log("[AUTH] User has no tenant:", user.id);
    return null;
  }

  if (!user.tenant.isActive) {
    console.log("[AUTH] Tenant is inactive:", user.tenant.id);
    return null;
  }

  console.log("[AUTH] Authentication successful:", {
    userId: user.id,
    tenantId: user.tenantId,
    tenantSlug: user.tenant.slug,
    role: user.role,
  });

  const { password, ...userWithoutPassword } = user;

  return userWithoutPassword;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

// --- Reseller portal sessions ---

export async function createResellerSession(reseller: {
  id: string;
}): Promise<string> {
  const payload: SessionPayload = {
    resellerId: reseller.id,
    role: "RESELLER",
  };

  const token = await signToken(payload);

  const expiresAt = new Date(Date.now() + SESSION_DURATION * 1000);
  await db.session.create({
    data: {
      token,
      resellerId: reseller.id,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION,
  });

  return token;
}

export async function getCurrentReseller() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || payload.role !== "RESELLER" || !payload.resellerId) return null;

  const session = await db.session.findUnique({ where: { token } });
  if (!session || session.expiresAt < new Date()) return null;

  const reseller = await db.reseller.findUnique({
    where: { id: payload.resellerId },
  });
  if (!reseller || !reseller.isActive) return null;

  const { password, ...safeReseller } = reseller;
  void password;
  return safeReseller;
}

export type CurrentReseller = NonNullable<Awaited<ReturnType<typeof getCurrentReseller>>>;

// --- Tenant impersonation (super admin) ---

function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * Parks the super-admin's own session in a backup cookie, then signs in as
 * the target tenant's user. `exitImpersonation` restores the backup.
 */
export async function startImpersonation(targetUser: {
  id: string;
  tenantId: string;
  role: string;
  tenantSlug: string;
}): Promise<void> {
  const cookieStore = await cookies();
  const current = cookieStore.get(COOKIE_NAME)?.value;
  if (!current) {
    throw new Error("Not signed in");
  }

  cookieStore.set(IMPERSONATION_BACKUP_COOKIE, current, sessionCookieOptions(SESSION_DURATION));

  await createSession({
    id: targetUser.id,
    tenantId: targetUser.tenantId,
    role: targetUser.role,
    tenant: { slug: targetUser.tenantSlug },
  });
}

/**
 * True while a super-admin has a parked session — i.e. the current session
 * cookie is a tenant session opened via `startImpersonation`.
 */
export async function isImpersonating(): Promise<boolean> {
  const cookieStore = await cookies();
  const backup = cookieStore.get(IMPERSONATION_BACKUP_COOKIE)?.value;
  if (!backup) return false;
  const payload = await verifyToken(backup);
  return payload?.role === "SUPER_ADMIN";
}

/** Restores the parked super-admin session and clears the backup cookie. */
export async function exitImpersonation(): Promise<{ ok: boolean; reason?: string }> {
  const cookieStore = await cookies();
  const backup = cookieStore.get(IMPERSONATION_BACKUP_COOKIE)?.value;
  if (!backup) return { ok: false, reason: "no_active_impersonation" };

  const payload = await verifyToken(backup);
  const session = payload ? await db.session.findUnique({ where: { token: backup } }) : null;

  const valid =
    payload?.role === "SUPER_ADMIN" &&
    !!session &&
    session.expiresAt >= new Date() &&
    session.userId === payload.userId;

  if (!valid) {
    cookieStore.set(IMPERSONATION_BACKUP_COOKIE, "", sessionCookieOptions(0));
    return { ok: false, reason: "session_expired" };
  }

  cookieStore.set(COOKIE_NAME, backup, sessionCookieOptions(SESSION_DURATION));
  cookieStore.set(IMPERSONATION_BACKUP_COOKIE, "", sessionCookieOptions(0));
  return { ok: true };
}
