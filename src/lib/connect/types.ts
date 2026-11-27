/**
 * Shared types for LipaPoint Connect (Milestone 1).
 *
 * Pure — no Prisma, no Node APIs — so client components (catalogue, forms)
 * can import the entity/auth lists without pulling the database driver into
 * the browser bundle. Mirrors the split used by src/lib/module-registry.ts.
 */

export const CONNECT_ENTITIES = ["products", "customers"] as const;
export type ConnectEntity = (typeof CONNECT_ENTITIES)[number];

export const ENTITY_LABELS: Record<ConnectEntity, string> = {
  products: "Products",
  customers: "Customers",
};

export function isConnectEntity(value: unknown): value is ConnectEntity {
  return typeof value === "string" && (CONNECT_ENTITIES as readonly string[]).includes(value);
}

export const AUTH_TYPES = ["NONE", "API_KEY", "BEARER", "BASIC"] as const;
export type AuthType = (typeof AUTH_TYPES)[number];

export function isAuthType(value: unknown): value is AuthType {
  return typeof value === "string" && (AUTH_TYPES as readonly string[]).includes(value);
}

export const AUTH_TYPE_LABELS: Record<AuthType, string> = {
  NONE: "No authentication",
  API_KEY: "API key header",
  BEARER: "Bearer token",
  BASIC: "Username & password",
};

export const CONNECTION_STATUSES = [
  "PENDING",
  "ACTIVE",
  "PAUSED",
  "ERROR",
  "DISCONNECTED",
] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const SYNC_FREQUENCIES = ["MANUAL", "HOURLY"] as const;
export type SyncFrequency = (typeof SYNC_FREQUENCIES)[number];

export const CONFLICT_POLICIES = ["KEEP_EXTERNAL", "KEEP_LOCAL"] as const;
export type ConflictPolicy = (typeof CONFLICT_POLICIES)[number];

export const JOB_STATUSES = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "PARTIAL",
  "FAILED",
  "DEAD",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** One record as the external system returned it, already normalised to an id. */
export interface ExternalRecord {
  externalId: string;
  data: Record<string, unknown>;
}

/** An uploaded CSV/Excel workbook, kept base64 so binary formats survive the DB. */
export interface ConnectorSource {
  fileName: string;
  format: "csv" | "xlsx";
  content: string; // base64
}

/** Everything a connector needs for one page of one entity. */
export interface ConnectorContext {
  connectionId: string;
  /**
   * The tenant that owns the connection.
   *
   * Connectors that read LipaPoint's own tables (eTIMS) need this: a connection
   * id is not a tenant id, and using one as the other silently scopes queries
   * to the wrong business. Connectors that only call an external API ignore it.
   */
  tenantId: string;
  entity: ConnectEntity;
  baseUrl?: string | null;
  config: Record<string, unknown>;
  authType: AuthType;
  /** Decrypted for this call only; never logged, never persisted. */
  credentials: Record<string, string>;
  cursor?: string | null;
  limit: number;
  source?: ConnectorSource | null;
}

export interface ConnectorSuccess {
  ok: true;
  records: ExternalRecord[];
  nextCursor?: string | null;
  accountLabel?: string;
}

export interface ConnectorFailure {
  ok: false;
  code: string;
  message: string;
  retryable: boolean;
}

export type ConnectorResult = ConnectorSuccess | ConnectorFailure;

export type ConnectorTestResult =
  | { ok: true; accountLabel?: string }
  | { ok: false; message: string };

export interface Connector {
  id: string;
  testConnection(context: ConnectorContext): Promise<ConnectorTestResult>;
  fetchRecords(context: ConnectorContext): Promise<ConnectorResult>;
}

/** Upload cap shared by the connector and the API route. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Default page size for a single connector call. */
export const DEFAULT_PAGE_SIZE = 200;
/** How long a manual sync may run inline before it is left to the scheduler. */
export const INLINE_SYNC_BUDGET_MS = 20_000;
