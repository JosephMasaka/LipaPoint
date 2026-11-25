import { ConnectError } from "../errors";
import { readPath } from "../mapping";
import { safeFetch } from "../ssrf";
import type {
  Connector,
  ConnectorContext,
  ConnectorResult,
  ConnectorTestResult,
  ExternalRecord,
} from "../types";

/**
 * Generic "Custom API" connector: any public HTTPS endpoint returning JSON.
 * Read-only in Milestone 1 — it never POSTs to the tenant's system, so a
 * misconfigured mapping cannot corrupt an external source of truth.
 */

function stringConfig(context: ConnectorContext, key: string): string | undefined {
  const value = context.config[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function authHeaders(context: ConnectorContext): Record<string, string> {
  const { authType, credentials } = context;
  if (authType === "API_KEY") {
    const key = credentials.apiKey;
    if (!key) throw new ConnectError("This connection has no API key saved", 400, "CONNECT_CREDENTIALS_MISSING");
    return { "x-api-key": key };
  }
  if (authType === "BEARER") {
    const token = credentials.token;
    if (!token) throw new ConnectError("This connection has no bearer token saved", 400, "CONNECT_CREDENTIALS_MISSING");
    return { authorization: `Bearer ${token}` };
  }
  if (authType === "BASIC") {
    const { username, password } = credentials;
    if (!username || !password) {
      throw new ConnectError("This connection has no username/password saved", 400, "CONNECT_CREDENTIALS_MISSING");
    }
    return { authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` };
  }
  return {};
}

function entityPath(context: ConnectorContext): string | undefined {
  return stringConfig(context, context.entity === "products" ? "productsPath" : "customersPath");
}

function buildUrl(context: ConnectorContext, path: string): string {
  if (!context.baseUrl) {
    throw new ConnectError("This connection has no base URL", 400, "CONNECT_BASE_URL_MISSING");
  }
  if (/^[a-z]+:\/\//i.test(path)) {
    throw new ConnectError("The path must be relative to the base URL", 400, "CONNECT_PATH_ABSOLUTE");
  }
  const base = context.baseUrl.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${suffix}`);
  url.searchParams.set("limit", String(context.limit));
  if (context.cursor) {
    url.searchParams.set(stringConfig(context, "cursorParam") ?? "cursor", context.cursor);
  }
  return url.toString();
}

function extractItems(payload: unknown, itemsPath: string | undefined): unknown[] {
  if (itemsPath) {
    const found = readPath(payload, itemsPath);
    return Array.isArray(found) ? found : [];
  }
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const value of Object.values(payload as Record<string, unknown>)) {
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

function toFailure(error: unknown): ConnectorResult {
  if (error instanceof ConnectError) {
    return {
      ok: false,
      code: error.code,
      message: error.message,
      retryable: error.status === 429 || error.status >= 500,
    };
  }
  return {
    ok: false,
    code: "CONNECT_UNREACHABLE",
    message: error instanceof Error ? error.message : "The endpoint could not be reached",
    retryable: true,
  };
}

export const httpConnector: Connector = {
  id: "custom-api",

  async testConnection(context: ConnectorContext): Promise<ConnectorTestResult> {
    if (!context.baseUrl) return { ok: false, message: "A base URL is required" };
    try {
      const response = await safeFetch(context.baseUrl, { headers: authHeaders(context) });
      if (!response.ok) {
        return {
          ok: false,
          message:
            response.status === 401 || response.status === 403
              ? "The endpoint rejected the credentials"
              : `The endpoint returned HTTP ${response.status}`,
        };
      }
      const host = new URL(context.baseUrl).host;
      return { ok: true, accountLabel: host };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "The endpoint could not be reached" };
    }
  },

  async fetchRecords(context: ConnectorContext): Promise<ConnectorResult> {
    try {
      const path = entityPath(context);
      if (!path) {
        return {
          ok: false,
          code: "CONNECT_NO_PATH",
          message: `No ${context.entity} path is configured for this connection`,
          retryable: false,
        };
      }

      const response = await safeFetch(buildUrl(context, path), { headers: authHeaders(context) });

      if (!response.ok) {
        return {
          ok: false,
          code: `CONNECT_HTTP_${response.status}`,
          message:
            response.status === 401 || response.status === 403
              ? "The endpoint rejected the credentials"
              : `The endpoint returned HTTP ${response.status}`,
          retryable: response.status === 429 || response.status >= 500,
        };
      }

      let payload: unknown;
      try {
        payload = JSON.parse(response.text);
      } catch {
        return {
          ok: false,
          code: "CONNECT_INVALID_JSON",
          message: "The endpoint did not return JSON",
          retryable: false,
        };
      }

      const items = extractItems(payload, stringConfig(context, "itemsPath"));
      const idField = stringConfig(context, "idField") ?? "id";
      const records: ExternalRecord[] = items
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item, index) => {
          const id = readPath(item, idField);
          return {
            externalId: id !== undefined && id !== null && String(id).trim() !== "" ? String(id) : `record-${index + 1}`,
            data: item,
          };
        });

      const nextCursorPath = stringConfig(context, "nextCursorPath");
      const rawNext = nextCursorPath ? readPath(payload, nextCursorPath) : undefined;
      const nextCursor =
        rawNext === undefined || rawNext === null || String(rawNext) === "" ? null : String(rawNext);

      return { ok: true, records, nextCursor };
    } catch (error) {
      return toFailure(error);
    }
  },
};
