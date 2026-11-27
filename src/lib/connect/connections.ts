import { randomBytes } from "node:crypto";
import { db } from "../db";
import type { IntegrationConnection, Prisma } from "@prisma/client";
import { AUDIT_ACTIONS, writeAuditLog } from "../audit";
import { decrypt, encrypt } from "../crypto";
import { getConnector } from "./connectors";
import { badRequest, conflict, forbidden, notFound } from "./errors";
import { buildMaskedHint, decryptSecrets, encryptSecrets, sanitizeSecretValues } from "./credentials";
import { connectionLimitForTier, describeConnectionLimit } from "./limits";
import { getProvider, type ProviderDefinition } from "./registry";
import { assertSafeUrl } from "./ssrf";
import {
  isAuthType,
  isConnectEntity,
  type AuthType,
  type ConnectorContext,
  type ConnectEntity,
} from "./types";

/**
 * Connection lifecycle: create, update, pause/resume, disconnect, test.
 *
 * Every read takes `tenantId` as an argument and includes it in the `where`,
 * so a guessed id returns 404 rather than another tenant's row. Credentials
 * are decrypted only to build a ConnectorContext and never returned.
 */

export interface PublicSyncConfig {
  id: string;
  entity: string;
  enabled: boolean;
  frequency: string;
  conflictPolicy: string;
  mapping: unknown;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  sourceFileName: string | null;
}

export interface PublicConnection {
  id: string;
  providerId: string;
  providerLabel: string;
  providerStatus: string;
  name: string;
  status: string;
  authType: string;
  baseUrl: string | null;
  config: Record<string, unknown>;
  maskedHint: string | null;
  hasCredentials: boolean;
  webhookUrl: string | null;
  lastTestedAt: Date | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastErrorMessage: string | null;
  syncConfigs: PublicSyncConfig[];
  createdAt: Date;
}

type ConnectionWithConfigs = IntegrationConnection & {
  syncConfigs?: {
    id: string;
    entity: string;
    enabled: boolean;
    frequency: string;
    conflictPolicy: string;
    mapping: unknown;
    lastRunAt: Date | null;
    nextRunAt: Date | null;
    sourceFileName: string | null;
  }[];
};

function asConfig(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function toPublicConnection(connection: ConnectionWithConfigs): PublicConnection {
  const provider = getProvider(connection.providerId);
  return {
    id: connection.id,
    providerId: connection.providerId,
    providerLabel: provider?.label ?? connection.providerId,
    providerStatus: provider?.status ?? "unknown",
    name: connection.name,
    status: connection.status,
    authType: connection.authType,
    baseUrl: connection.baseUrl,
    config: asConfig(connection.config),
    maskedHint: connection.maskedHint,
    hasCredentials: Boolean(connection.credentialsEnc),
    webhookUrl: connection.webhookSecretEnc ? `/api/connect/webhooks/${connection.id}` : null,
    lastTestedAt: connection.lastTestedAt,
    lastTestOk: connection.lastTestOk,
    lastTestMessage: connection.lastTestMessage,
    lastSyncAt: connection.lastSyncAt,
    lastSyncStatus: connection.lastSyncStatus,
    lastErrorMessage: connection.lastErrorMessage,
    syncConfigs: (connection.syncConfigs ?? []).map((config) => ({
      id: config.id,
      entity: config.entity,
      enabled: config.enabled,
      frequency: config.frequency,
      conflictPolicy: config.conflictPolicy,
      mapping: config.mapping ?? null,
      lastRunAt: config.lastRunAt,
      nextRunAt: config.nextRunAt,
      sourceFileName: config.sourceFileName,
    })),
    createdAt: connection.createdAt,
  };
}

export function readSecrets(connection: IntegrationConnection): {
  authType: AuthType;
  values: Record<string, string>;
} {
  if (!connection.credentialsEnc) {
    return { authType: (isAuthType(connection.authType) ? connection.authType : "NONE") as AuthType, values: {} };
  }
  try {
    return decryptSecrets(connection.credentialsEnc);
  } catch {
    // A rotated/lost ENCRYPTION_KEY must surface as a readable state, not a 500.
    throw badRequest(
      "The saved credentials could not be decrypted — re-enter them",
      "CONNECT_CREDENTIALS_UNREADABLE"
    );
  }
}

export function buildConnectorContext(
  connection: IntegrationConnection,
  entity: ConnectEntity,
  extras: { cursor?: string | null; source?: { fileName: string; format: "csv" | "xlsx"; content: string } | null; limit?: number } = {}
): ConnectorContext {
  const secrets = readSecrets(connection);
  return {
    connectionId: connection.id,
    tenantId: connection.tenantId,
    entity,
    baseUrl: connection.baseUrl,
    config: asConfig(connection.config),
    authType: secrets.authType,
    credentials: secrets.values,
    cursor: extras.cursor ?? null,
    source: extras.source ?? null,
    limit: extras.limit ?? 200,
  };
}

export function webhookSecretFor(connection: IntegrationConnection): string | null {
  if (!connection.webhookSecretEnc) return null;
  return decrypt(connection.webhookSecretEnc);
}

async function getConnectionRow(tenantId: string, id: string): Promise<IntegrationConnection> {
  const connection = await db.integrationConnection.findFirst({ where: { id, tenantId } });
  if (!connection) throw notFound();
  return connection;
}

export async function connectionUsage(
  tenantId: string,
  tier: string
): Promise<{ used: number; limit: number; label: string }> {
  const limit = connectionLimitForTier(tier);
  const used = await db.integrationConnection.count({
    where: { tenantId, status: { not: "DISCONNECTED" } },
  });
  return { used, limit, label: describeConnectionLimit(limit) };
}

export async function assertWithinLimit(tenantId: string, tier: string): Promise<void> {
  const { used, limit } = await connectionUsage(tenantId, tier);
  if (limit <= 0) {
    throw forbidden("LipaPoint Connect is not included in your plan", "CONNECT_FEATURE_NOT_IN_PLAN");
  }
  if (used >= limit) {
    throw conflict(
      `Your plan allows ${describeConnectionLimit(limit).toLowerCase()} — disconnect one before adding another`,
      "CONNECT_LIMIT_REACHED"
    );
  }
}

export async function listConnections(tenantId: string, tier: string) {
  const [connections, usage] = await Promise.all([
    db.integrationConnection.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        syncConfigs: {
          select: {
            id: true,
            entity: true,
            enabled: true,
            frequency: true,
            conflictPolicy: true,
            mapping: true,
            lastRunAt: true,
            nextRunAt: true,
            sourceFileName: true,
          },
        },
      },
    }),
    connectionUsage(tenantId, tier),
  ]);
  return { connections: connections.map(toPublicConnection), usage };
}

export async function getConnection(tenantId: string, id: string): Promise<PublicConnection> {
  const connection = await db.integrationConnection.findFirst({
    where: { id, tenantId },
    include: {
      syncConfigs: {
        select: {
          id: true,
          entity: true,
          enabled: true,
          frequency: true,
          conflictPolicy: true,
          mapping: true,
          lastRunAt: true,
          nextRunAt: true,
          sourceFileName: true,
        },
      },
    },
  });
  if (!connection) throw notFound();
  return toPublicConnection(connection);
}

function requiredCredentialKeys(authType: AuthType): string[] {
  switch (authType) {
    case "API_KEY":
      return ["apiKey"];
    case "BEARER":
      return ["token"];
    case "BASIC":
      return ["username", "password"];
    default:
      return [];
  }
}

function assertCredentialShape(authType: AuthType, values: Record<string, string>): void {
  const missing = requiredCredentialKeys(authType).filter((key) => !values[key]);
  if (missing.length > 0) {
    throw badRequest(
      `Missing required credential field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
      "CONNECT_CREDENTIALS_INCOMPLETE"
    );
  }
}

function validateAuthType(provider: ProviderDefinition, raw: unknown): AuthType {
  const fallback = provider.authTypes[0] ?? "NONE";
  if (raw === undefined || raw === null || raw === "") return fallback;
  if (!isAuthType(raw) || !provider.authTypes.includes(raw)) {
    throw badRequest(`${provider.label} does not support that authentication method`, "CONNECT_AUTH_TYPE_INVALID");
  }
  return raw;
}

function normaliseEntities(provider: ProviderDefinition, raw: unknown): ConnectEntity[] {
  if (raw === undefined || raw === null) return [...provider.entities];
  if (!Array.isArray(raw)) throw badRequest("entities must be an array");
  const entities = raw.filter(isConnectEntity).filter((entity) => provider.entities.includes(entity));
  if (entities.length === 0) {
    throw badRequest("Choose at least one entity to sync", "CONNECT_NO_ENTITIES");
  }
  return [...new Set(entities)];
}

export interface CreateConnectionInput {
  providerId?: unknown;
  name?: unknown;
  authType?: unknown;
  baseUrl?: unknown;
  config?: unknown;
  credentials?: unknown;
  entities?: unknown;
}

export async function createConnection(args: {
  tenantId: string;
  userId: string;
  tier: string;
  input: CreateConnectionInput;
}): Promise<PublicConnection> {
  const { tenantId, userId, tier, input } = args;
  const providerId = typeof input.providerId === "string" ? input.providerId.trim() : "";
  const provider = getProvider(providerId);
  if (!provider || provider.status !== "available") {
    throw badRequest("That integration is not available yet", "CONNECT_PROVIDER_UNAVAILABLE");
  }

  if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 80) {
    throw badRequest("Give the connection a name of 2–80 characters");
  }
  const name = input.name.trim();

  await assertWithinLimit(tenantId, tier);

  const authType = validateAuthType(provider, input.authType);
  const values = sanitizeSecretValues(input.credentials);
  if (provider.id !== "mock" && provider.id !== "file") assertCredentialShape(authType, values);

  let baseUrl: string | null = null;
  if (provider.id === "custom-api") {
    if (typeof input.baseUrl !== "string" || !input.baseUrl.trim()) {
      throw badRequest("A base URL is required for a custom API", "CONNECT_BASE_URL_MISSING");
    }
    const url = await assertSafeUrl(input.baseUrl.trim());
    baseUrl = url.toString().replace(/\/+$/, "");
  }

  const entities = normaliseEntities(provider, input.entities);
  const secrets = values && Object.keys(values).length > 0 ? encryptSecrets({ authType, values }) : null;
  const webhookSecret = provider.supportsWebhooks ? encrypt(randomBytes(24).toString("hex")) : null;

  const connection = await db.$transaction(async (tx) => {
    const created = await tx.integrationConnection.create({
      data: {
        tenantId,
        providerId: provider.id,
        name,
        status: "PENDING",
        authType,
        baseUrl,
        config: asConfig(input.config) as Prisma.InputJsonValue,
        credentialsEnc: secrets,
        maskedHint: secrets ? buildMaskedHint({ authType, values }) : null,
        webhookSecretEnc: webhookSecret,
        createdById: userId,
      },
    });
    await tx.integrationSyncConfig.createMany({
      data: entities.map((entity) => ({
        tenantId,
        connectionId: created.id,
        entity,
        direction: "INBOUND",
        enabled: true,
        frequency: "MANUAL",
      })),
    });
    return created;
  });

  await writeAuditLog({
    tenantId,
    userId,
    action: AUDIT_ACTIONS.CONNECT.CONNECTION_CREATED,
    module: "connect",
    entity: "integrationConnection",
    entityId: connection.id,
    details: `${provider.label} · ${name}`,
  });

  return getConnection(tenantId, connection.id);
}

export interface UpdateConnectionInput {
  name?: unknown;
  baseUrl?: unknown;
  config?: unknown;
  credentials?: unknown;
  authType?: unknown;
  status?: unknown;
  regenerateWebhookSecret?: unknown;
}

export async function updateConnection(args: {
  tenantId: string;
  userId: string;
  id: string;
  input: UpdateConnectionInput;
}): Promise<PublicConnection> {
  const { tenantId, userId, id, input } = args;
  const connection = await getConnectionRow(tenantId, id);
  const provider = getProvider(connection.providerId);
  if (!provider) throw badRequest("This integration is no longer supported", "CONNECT_PROVIDER_UNKNOWN");

  const data: Record<string, unknown> = {};

  if (input.name !== undefined) {
    if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 80) {
      throw badRequest("Give the connection a name of 2–80 characters");
    }
    data.name = input.name.trim();
  }

  if (input.baseUrl !== undefined && provider.id === "custom-api") {
    if (typeof input.baseUrl !== "string" || !input.baseUrl.trim()) {
      throw badRequest("A base URL is required for a custom API", "CONNECT_BASE_URL_MISSING");
    }
    data.baseUrl = (await assertSafeUrl(input.baseUrl.trim())).toString().replace(/\/+$/, "");
  }

  if (input.config !== undefined) data.config = asConfig(input.config);

  if (input.authType !== undefined) {
    data.authType = validateAuthType(provider, input.authType);
  }

  const credentialValues = sanitizeSecretValues(input.credentials);
  const authType =
    (data.authType as AuthType | undefined) ??
    (isAuthType(connection.authType) ? connection.authType : "NONE");

  if (Object.keys(credentialValues).length > 0) {
    if (provider.id !== "mock" && provider.id !== "file") assertCredentialShape(authType, credentialValues);
    data.credentialsEnc = encryptSecrets({ authType, values: credentialValues });
    data.maskedHint = buildMaskedHint({ authType, values: credentialValues });
  } else if (data.authType && data.authType !== connection.authType) {
    throw badRequest(
      "Enter the credentials for the new authentication method",
      "CONNECT_CREDENTIALS_INCOMPLETE"
    );
  }

  if (typeof input.status === "string") {
    if (input.status !== "ACTIVE" && input.status !== "PAUSED") {
      throw badRequest("status must be ACTIVE or PAUSED");
    }
    if (connection.status === "DISCONNECTED") {
      throw conflict("This connection was disconnected — create a new one instead");
    }
    if (input.status === "ACTIVE") {
      const hasCredentials = data.credentialsEnc !== undefined ? true : Boolean(connection.credentialsEnc);
      if (requiredCredentialKeys(authType).length > 0 && !hasCredentials) {
        throw badRequest("Add credentials before activating this connection", "CONNECT_CREDENTIALS_MISSING");
      }
    }
    data.status = input.status;
  }

  if (input.regenerateWebhookSecret === true) {
    if (!provider.supportsWebhooks) {
      throw badRequest("This integration does not receive webhooks", "CONNECT_WEBHOOK_UNSUPPORTED");
    }
    data.webhookSecretEnc = encrypt(randomBytes(24).toString("hex"));
  }

  if (Object.keys(data).length === 0) return getConnection(tenantId, id);

  await db.integrationConnection.update({ where: { id: connection.id }, data });

  await writeAuditLog({
    tenantId,
    userId,
    action: AUDIT_ACTIONS.CONNECT.CONNECTION_UPDATED,
    module: "connect",
    entity: "integrationConnection",
    entityId: connection.id,
    details: Object.keys(data).join(", "),
  });

  return getConnection(tenantId, id);
}

export async function disconnectConnection(args: {
  tenantId: string;
  userId: string;
  id: string;
}): Promise<PublicConnection> {
  const connection = await getConnectionRow(args.tenantId, args.id);

  await db.$transaction([
    db.integrationConnection.update({
      where: { id: connection.id },
      data: {
        status: "DISCONNECTED",
        credentialsEnc: null,
        webhookSecretEnc: null,
        maskedHint: null,
        disconnectedAt: new Date(),
      },
    }),
    db.integrationSyncConfig.updateMany({
      where: { connectionId: connection.id },
      data: { enabled: false, nextRunAt: null },
    }),
  ]);

  await writeAuditLog({
    tenantId: args.tenantId,
    userId: args.userId,
    action: AUDIT_ACTIONS.CONNECT.CONNECTION_DISCONNECTED,
    module: "connect",
    entity: "integrationConnection",
    entityId: connection.id,
    details: connection.name,
  });

  return getConnection(args.tenantId, connection.id);
}

export async function testConnection(args: {
  tenantId: string;
  userId: string;
  id: string;
}): Promise<{ ok: boolean; message: string; accountLabel?: string }> {
  const connection = await getConnectionRow(args.tenantId, args.id);
  const provider = getProvider(connection.providerId);
  const connector = getConnector(connection.providerId);
  if (!provider || !connector || provider.status !== "available") {
    throw badRequest("This integration has no connector yet", "CONNECT_PROVIDER_UNAVAILABLE");
  }

  const entity = provider.entities[0] ?? "products";
  let result: { ok: boolean; message: string; accountLabel?: string };
  try {
    const context = buildConnectorContext(connection, entity);
    const tested = await connector.testConnection(context);
    result = tested.ok
      ? { ok: true, message: "Connection succeeded", accountLabel: tested.accountLabel }
      : { ok: false, message: tested.message };
  } catch (error) {
    result = { ok: false, message: error instanceof Error ? error.message : "Connection failed" };
  }

  await db.integrationConnection.update({
    where: { id: connection.id },
    data: {
      lastTestedAt: new Date(),
      lastTestOk: result.ok,
      lastTestMessage: result.message,
      status:
        connection.status === "PAUSED" || connection.status === "DISCONNECTED"
          ? connection.status
          : result.ok
            ? "ACTIVE"
            : "ERROR",
      lastErrorAt: result.ok ? connection.lastErrorAt : new Date(),
      lastErrorMessage: result.ok ? connection.lastErrorMessage : result.message,
    },
  });

  await writeAuditLog({
    tenantId: args.tenantId,
    userId: args.userId,
    action: AUDIT_ACTIONS.CONNECT.TESTED,
    module: "connect",
    entity: "integrationConnection",
    entityId: connection.id,
    details: result.ok ? "ok" : result.message,
  });

  return result;
}

/** Used by the scheduler and the sync API before enqueuing work. */
export async function requireActiveConnection(tenantId: string, id: string): Promise<IntegrationConnection> {
  const connection = await getConnectionRow(tenantId, id);
  if (connection.status === "DISCONNECTED") {
    throw conflict("This connection was disconnected", "CONNECT_DISCONNECTED");
  }
  if (connection.status === "PAUSED") {
    throw conflict("This connection is paused", "CONNECT_PAUSED");
  }
  return connection;
}
