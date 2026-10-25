import "server-only";
import { cookies as nextCookies } from "next/headers";

const COOKIE_NAME = "lipapoint-session";
const BACKUP_COOKIE_NAME = "lipapoint-session-backup";

/** A non-null cookie store facade that never throws during prerender. */
async function safeCookieStore() {
  try {
    const store = await nextCookies();
    return store;
  } catch (err) {
    if (err && err instanceof ReferenceError && err.message.includes("cookies is not defined")) {
      // During static prerender there is no request-bound headers context.
      // Return a safe no-op store so callers don't crash the build.
      return {
        get: () => null,
        set: () => {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as Awaited<ReturnType<typeof nextCookies>> & { set: () => void; get: () => { value: string | undefined; name: string | undefined } | null };
    }
    throw err;
  }
}

export async function readSessionCookie(): Promise<string | null> {
  const store = await safeCookieStore();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export async function readBackupCookie(): Promise<string | null> {
  const store = await safeCookieStore();
  return store.get(BACKUP_COOKIE_NAME)?.value ?? null;
}

export async function setSessionCookie(token: string, maxAge = 7 * 24 * 60 * 60): Promise<void> {
  const store = await safeCookieStore();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

/** Set the backup cookie that holds a super-admin's own session while impersonating. */
export async function setBackupCookie(token: string, maxAge = 7 * 24 * 60 * 60): Promise<void> {
  const store = await safeCookieStore();
  store.set(BACKUP_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await safeCookieStore();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function clearBackupCookie(): Promise<void> {
  const store = await safeCookieStore();
  store.set(BACKUP_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
