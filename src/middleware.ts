import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "lipapoint-session";

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

const ROUTE_PERMISSIONS: Record<string, string[]> = {
  pos: ["OWNER", "ADMIN", "MANAGER", "CASHIER"],
  orders: ["OWNER", "ADMIN", "MANAGER", "CASHIER", "KITCHEN"],
  tabs: ["OWNER", "ADMIN", "MANAGER", "CASHIER"],
  inventory: ["OWNER", "ADMIN", "MANAGER", "STOCK_KEEPER"],
  analytics: ["OWNER", "ADMIN", "MANAGER"],
  users: ["OWNER", "ADMIN", "MANAGER"],
  settings: ["OWNER", "ADMIN"],
  expenses: ["OWNER", "ADMIN", "MANAGER", "STOCK_KEEPER"],
  kitchen: ["OWNER", "ADMIN", "MANAGER", "KITCHEN"],
};

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) return true;
  return false;
}

function isTenantPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 1) return false;
  const slug = segments[0];
  const slugPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
  return slugPattern.test(slug) && !PUBLIC_PATHS.includes(`/${slug}`);
}

const AUTH_PAGES = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (AUTH_PAGES.includes(pathname)) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (token) {
      try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);
        const slug = payload.tenantSlug as string;
        if (slug) {
          return NextResponse.redirect(new URL(`/${slug}/dashboard`, request.url));
        }
      } catch {
        // invalid token — let them through to login
      }
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (isTenantPath(pathname)) {
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);

      const segments = pathname.split("/").filter(Boolean);
      const route = segments[1];

      if (route && ROUTE_PERMISSIONS[route]) {
        const userRole = (payload.role as string) || "CASHIER";
        const allowedRoles = ROUTE_PERMISSIONS[route];
        if (!allowedRoles.includes(userRole)) {
          const dashUrl = new URL(`/${segments[0]}/pos`, request.url);
          return NextResponse.redirect(dashUrl);
        }
      }

      return NextResponse.next();
    } catch {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
