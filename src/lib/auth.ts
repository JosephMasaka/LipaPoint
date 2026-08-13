import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE_NAME = "lipapoint-session";
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

interface SessionPayload extends JWTPayload {
  userId: string;
  tenantId: string;
  tenantSlug: string;
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
}

// --- Get current user ---

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return null;
  }

  // Verify session exists in database and is not expired
  const session = await db.session.findUnique({
    where: { token },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  // Fetch full user with tenant
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

  if (!user || !user.isActive || !user.tenant.isActive) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
