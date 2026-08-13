import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "lipapoint-session";

// Marketing/public pages that do not require authentication
const PUBLIC_PATHS = [
  "/",
  "/pricing",
  "/features",
  "/contact",
  "/demo-request",
  "/login",
  "/register",
  "/onboard",
];

function isPublicPath(pathname: string): boolean {
  // Exact match for public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return true;
  }

  // Allow all API routes through (auth is handled per-route)
  if (pathname.startsWith("/api")) {
    return true;
  }

  // Allow Next.js internals and static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return true;
  }

  return false;
}

/**
 * Check if the path matches a tenant route pattern.
 * Tenant routes are: /[slug]/dashboard, /[slug]/pos, etc.
 * A tenant slug is a lowercase alphanumeric string with hyphens.
 */
function isTenantPath(pathname: string): boolean {
  // Match pattern: /some-slug/... (at least two segments, first segment looks like a slug)
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 1) return false;

  const slug = segments[0];
  // Slug pattern: lowercase letters, numbers, hyphens (not a known public path)
  const slugPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
  return slugPattern.test(slug) && !PUBLIC_PATHS.includes(`/${slug}`);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through without authentication
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check if this is a tenant-protected route
  if (isTenantPath(pathname)) {
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verify the JWT token
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      await jwtVerify(token, secret);
      return NextResponse.next();
    } catch {
      // Invalid or expired token - redirect to login
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
