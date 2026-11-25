import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ConnectError } from "./errors";

/**
 * SSRF guard for tenant-supplied URLs (custom API connectors).
 *
 * Called on every outbound request, not only when the URL is saved: DNS can
 * be re-pointed after a connection is created (DNS rebinding), so the check
 * that matters is the one immediately before the fetch.
 *
 * The address is resolved here and the fetch re-resolves it — a determined
 * attacker with control of their DNS can still win that race (TOCTOU). The
 * remaining exposure is a GET against an internal host with credentials the
 * tenant already supplied, which is why the allowed surface is also limited
 * to HTTPS, port 443 and no redirects. Documented in SECURITY_MODEL.md §5.
 */

const PRIVATE_V4 = [
  /^0\./,
  /^10\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^198\.1[89]\./,
  /^22[4-9]\./,
  /^2[3-5]\d\./,
];

const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost", ".home.arpa", ".lan"];

export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) return PRIVATE_V4.some((pattern) => pattern.test(address));
  if (isIP(address) === 6) {
    const normalised = address.toLowerCase();
    if (normalised === "::1" || normalised === "::") return true;
    if (normalised.startsWith("fe80:") || normalised.startsWith("fc") || normalised.startsWith("fd")) return true;
    // IPv4-mapped IPv6 (::ffff:127.0.0.1) — unwrap and re-check.
    const mapped = normalised.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  return false;
}

export function isBlockedHostName(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  if (isIP(host) !== 0) return isPrivateAddress(host);
  return false;
}

function insecureLocalAllowed(): boolean {
  return process.env.CONNECT_ALLOW_INSECURE_LOCAL === "true" && process.env.NODE_ENV !== "production";
}

export interface SafeUrlOptions {
  /** Tests (and future providers) may need a non-443 port on a public host. */
  allowInsecureLocal?: boolean;
}

export async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConnectError("That is not a valid URL", 400, "CONNECT_URL_INVALID");
  }

  const allowHttp = insecureLocalAllowed();
  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
    throw new ConnectError(
      "Only HTTPS endpoints are allowed",
      400,
      "CONNECT_URL_INSECURE"
    );
  }
  if (url.username || url.password) {
    throw new ConnectError(
      "Put credentials in the connection fields, not in the URL",
      400,
      "CONNECT_URL_HAS_CREDENTIALS"
    );
  }
  if (isBlockedHostName(url.hostname)) {
    throw new ConnectError(
      "That host is not allowed — private, loopback and internal addresses are refused",
      400,
      "CONNECT_URL_BLOCKED"
    );
  }

  const expectedPort = url.protocol === "https:" ? "" : "80";
  if (url.port && url.port !== expectedPort) {
    throw new ConnectError(
      `Port ${url.port} is not allowed — use the default port`,
      400,
      "CONNECT_URL_PORT_BLOCKED"
    );
  }

  // Resolve and check every address the name maps to.
  let addresses: { address: string }[] = [];
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new ConnectError(
      "That host could not be resolved",
      400,
      "CONNECT_URL_UNRESOLVED"
    );
  }
  if (addresses.length === 0) {
    throw new ConnectError("That host could not be resolved", 400, "CONNECT_URL_UNRESOLVED");
  }
  for (const entry of addresses) {
    if (isPrivateAddress(entry.address)) {
      throw new ConnectError(
        "That host resolves to a private address, which is not allowed",
        400,
        "CONNECT_URL_PRIVATE"
      );
    }
  }

  return url;
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
}

export interface SafeFetchResult {
  status: number;
  ok: boolean;
  text: string;
  contentType: string | null;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * `fetch` with the guard applied, redirects refused, a timeout and a body
 * cap. A 3xx is an error rather than a follow: redirects are how an allowed
 * public host walks a request into 169.254.169.254.
 */
export async function safeFetch(
  rawUrl: string | URL,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult> {
  const url = await assertSafeUrl(String(rawUrl));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        accept: "application/json",
        "user-agent": "LipaPoint-Connect/1.0",
        ...(init.headers ?? {}),
      },
      body: init.body,
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      throw new ConnectError(
        "The endpoint redirected the request, which is not allowed",
        502,
        "CONNECT_REDIRECT_REFUSED"
      );
    }

    const buffer = await response.arrayBuffer();
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    if (buffer.byteLength > maxBytes) {
      throw new ConnectError(
        `The response is larger than ${Math.round(maxBytes / (1024 * 1024))} MB`,
        502,
        "CONNECT_RESPONSE_TOO_LARGE"
      );
    }

    return {
      status: response.status,
      ok: response.ok,
      text: Buffer.from(buffer).toString("utf8"),
      contentType: response.headers.get("content-type"),
    };
  } catch (error) {
    if (error instanceof ConnectError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ConnectError("The endpoint did not respond in time", 504, "CONNECT_TIMEOUT");
    }
    throw new ConnectError(
      `The endpoint could not be reached: ${error instanceof Error ? error.message : "network error"}`,
      502,
      "CONNECT_UNREACHABLE"
    );
  } finally {
    clearTimeout(timeout);
  }
}
