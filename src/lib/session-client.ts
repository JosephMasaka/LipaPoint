import type { SessionUser } from "@/lib/api-guards";

/**
 * Client-safe session reader.
 *
 * The old `getCurrentUser()` from `src/lib/auth.ts` called `cookies()` from
 * `next/headers`, which is server-only and broke the production build the
 * moment it got pulled into a Client Component (the admin modules page).
 *
 * This replaces that usage: client code calls `getSessionUser()`, which hits
 * the server `/api/auth/session` route under the hood. The server-only cookie
 * work stays in `src/lib/auth.ts` (marked `import "server-only"`).
 */
export async function getSessionUser() {
  const res = await fetch("/api/auth/session", {
    method: "GET",
    credentials: "include",
    headers: { accept: "application/json" },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { user: unknown };
  return json.user as SessionUser | null;
}
