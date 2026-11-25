import { db } from "../db";
import type { IntegrationJob } from "@prisma/client";
import { AUDIT_ACTIONS, writeAuditLog } from "../audit";
import { getConnector } from "./connectors";
import { buildConnectorContext } from "./connections";
import { ConnectError, redact } from "./errors";
import { completeJob, failJob } from "./jobs";
import { applyMapping, normaliseMapping, type MappedRecord } from "./mapping";
import { isConnectEntity, type ConnectEntity } from "./types";

/**
 * Runs one claimed job: fetch a page from the connector, map each record,
 * apply it to the local tables, and leave a per-record trail.
 *
 * Design rules that protect existing data:
 * - Products are matched by the existing unique key `(tenantId, sku)`; a
 *   customer is matched by its external-id link, then by phone. Names are
 *   never used to match — two different suppliers can both have "Sugar 1kg".
 * - A rejected row never partially writes: mapping happens before any Prisma
 *   call, and the local write plus its external-id link commit together.
 * - Re-running is idempotent: the link table means the second run updates the
 *   same rows instead of creating duplicates.
 */

export interface JobRunResult {
  jobId: string;
  status: string;
  processed: number;
  applied: number;
  rejected: number;
  errorCode?: string | null;
  errorDetail?: string | null;
  skipped?: boolean;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : undefined;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

async function resolveBaseUnit(tenantId: string): Promise<string> {
  const existing = await db.unitOfMeasure.findFirst({ where: { tenantId }, select: { id: true } });
  if (existing) return existing.id;
  try {
    const created = await db.unitOfMeasure.create({
      data: { tenantId, name: "Piece", abbreviation: "pc" },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const retry = await db.unitOfMeasure.findFirst({ where: { tenantId }, select: { id: true } });
      if (retry) return retry.id;
    }
    throw error;
  }
}

async function resolveCategory(tenantId: string, name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = await db.category.findUnique({
    where: { tenantId_name: { tenantId, name: trimmed } },
    select: { id: true },
  });
  if (existing) return existing.id;
  try {
    const created = await db.category.create({
      data: { tenantId, name: trimmed.slice(0, 80) },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const retry = await db.category.findUnique({
        where: { tenantId_name: { tenantId, name: trimmed.slice(0, 80) } },
        select: { id: true },
      });
      return retry?.id ?? null;
    }
    throw error;
  }
}

interface ApplyArgs {
  tenantId: string;
  connectionId: string;
  entity: ConnectEntity;
  externalId: string;
  record: MappedRecord;
  conflictPolicy: string;
}

type ApplyOutcome =
  | { status: "APPLIED"; localId: string }
  | { status: "SKIPPED"; localId: string; reason: string }
  | { status: "REJECTED"; reason: string };

async function linkExternalRecord(
  args: ApplyArgs,
  localId: string
): Promise<void> {
  await db.integrationExternalRecord.upsert({
    where: {
      connectionId_entity_externalId: {
        connectionId: args.connectionId,
        entity: args.entity,
        externalId: args.externalId,
      },
    },
    create: {
      tenantId: args.tenantId,
      connectionId: args.connectionId,
      entity: args.entity,
      externalId: args.externalId,
      localId,
      lastSyncedAt: new Date(),
    },
    update: { localId, lastSyncedAt: new Date() },
  });
}

async function applyProduct(args: ApplyArgs): Promise<ApplyOutcome> {
  const sku = String(args.record.sku);
  const existingLink = await db.integrationExternalRecord.findUnique({
    where: {
      connectionId_entity_externalId: {
        connectionId: args.connectionId,
        entity: "products",
        externalId: args.externalId,
      },
    },
  });

  const existing = existingLink
    ? await db.product.findFirst({ where: { id: existingLink.localId, tenantId: args.tenantId } })
    : await db.product.findFirst({ where: { tenantId: args.tenantId, sku } });

  if (existing && args.conflictPolicy === "KEEP_LOCAL") {
    await linkExternalRecord(args, existing.id);
    return { status: "SKIPPED", localId: existing.id, reason: "Kept the local record (KEEP_LOCAL policy)" };
  }

  const baseUnitId = await resolveBaseUnit(args.tenantId);
  const categoryId = args.record.category ? await resolveCategory(args.tenantId, String(args.record.category)) : null;

  const values = {
    name: String(args.record.name),
    price: Number(args.record.price),
    cost: typeof args.record.cost === "number" ? args.record.cost : 0,
    description: args.record.description ? String(args.record.description) : null,
    barcode: args.record.barcode ? String(args.record.barcode) : null,
    isActive: typeof args.record.isActive === "boolean" ? args.record.isActive : true,
    trackStock: typeof args.record.trackStock === "boolean" ? args.record.trackStock : true,
    lowStockAlert:
      typeof args.record.lowStockAlert === "number" ? Math.max(0, Math.floor(args.record.lowStockAlert)) : 10,
  };

  try {
    const product = existing
      ? await db.product.update({
          where: { id: existing.id },
          data: { ...values, sku, categoryId: categoryId ?? existing.categoryId },
        })
      : await db.product.create({
          data: {
            tenantId: args.tenantId,
            sku,
            baseUnitId,
            categoryId,
            ...values,
          },
        });

    await linkExternalRecord(args, product.id);
    return { status: "APPLIED", localId: product.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        status: "REJECTED",
        reason: `A different product already uses SKU "${sku}"`,
      };
    }
    throw error;
  }
}

async function applyCustomer(args: ApplyArgs): Promise<ApplyOutcome> {
  const existingLink = await db.integrationExternalRecord.findUnique({
    where: {
      connectionId_entity_externalId: {
        connectionId: args.connectionId,
        entity: "customers",
        externalId: args.externalId,
      },
    },
  });

  const phone = asString(args.record.phone)?.trim() || null;

  let existing = existingLink
    ? await db.customer.findFirst({ where: { id: existingLink.localId, tenantId: args.tenantId } })
    : null;
  if (!existing && phone) {
    existing = await db.customer.findFirst({ where: { tenantId: args.tenantId, phone } });
  }

  if (existing && args.conflictPolicy === "KEEP_LOCAL") {
    await linkExternalRecord(args, existing.id);
    return { status: "SKIPPED", localId: existing.id, reason: "Kept the local record (KEEP_LOCAL policy)" };
  }

  const values = {
    name: String(args.record.name),
    phone,
    email: args.record.email ? String(args.record.email) : null,
    address: args.record.address ? String(args.record.address) : null,
    notes: args.record.notes ? String(args.record.notes) : null,
  };

  try {
    const customer = existing
      ? await db.customer.update({ where: { id: existing.id }, data: values })
      : await db.customer.create({ data: { tenantId: args.tenantId, ...values } });
    await linkExternalRecord(args, customer.id);
    return { status: "APPLIED", localId: customer.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        status: "REJECTED",
        reason: phone
          ? `Phone ${phone} already belongs to another customer`
          : "That customer could not be saved",
      };
    }
    throw error;
  }
}

function applyRecord(args: ApplyArgs): Promise<ApplyOutcome> {
  return args.entity === "products" ? applyProduct(args) : applyCustomer(args);
}

export async function runJob(jobId: string): Promise<JobRunResult> {
  const job = await db.integrationJob.findUnique({ where: { id: jobId } });
  if (!job) throw new ConnectError("Job not found", 404, "CONNECT_JOB_NOT_FOUND");
  if (job.status !== "RUNNING") {
    return {
      jobId: job.id,
      status: job.status,
      processed: 0,
      applied: 0,
      rejected: 0,
      skipped: true,
    };
  }

  const connection = await db.integrationConnection.findFirst({
    where: { id: job.connectionId, tenantId: job.tenantId },
  });

  if (!connection) {
    await failJob(job, { code: "CONNECT_CONNECTION_MISSING", detail: "The connection no longer exists", retryable: false });
    return await finishFailure(job.id, "CONNECT_CONNECTION_MISSING", "The connection no longer exists");
  }

  if (connection.status !== "ACTIVE") {
    const detail = `Connection is ${connection.status.toLowerCase()}`;
    await failJob(job, { code: "CONNECT_CONNECTION_INACTIVE", detail, retryable: false });
    return await finishFailure(job.id, "CONNECT_CONNECTION_INACTIVE", detail);
  }

  if (!isConnectEntity(job.entity)) {
    await failJob(job, { code: "CONNECT_ENTITY_UNSUPPORTED", detail: job.entity, retryable: false });
    return await finishFailure(job.id, "CONNECT_ENTITY_UNSUPPORTED", "Unsupported entity");
  }
  const entity = job.entity;

  const connector = getConnector(connection.providerId);
  if (!connector) {
    const detail = `No connector for provider ${connection.providerId}`;
    await failJob(job, { code: "CONNECT_PROVIDER_UNAVAILABLE", detail, retryable: false });
    return await finishFailure(job.id, "CONNECT_PROVIDER_UNAVAILABLE", detail);
  }

  const syncConfig = job.syncConfigId
    ? await db.integrationSyncConfig.findFirst({ where: { id: job.syncConfigId, tenantId: job.tenantId } })
    : await db.integrationSyncConfig.findFirst({ where: { connectionId: connection.id, entity } });

  const mapping = normaliseMapping(entity, syncConfig?.mapping);
  const source =
    syncConfig?.sourceContent && syncConfig.sourceFileName && (syncConfig.sourceFormat === "csv" || syncConfig.sourceFormat === "xlsx")
      ? {
          fileName: syncConfig.sourceFileName,
          format: syncConfig.sourceFormat as "csv" | "xlsx",
          content: syncConfig.sourceContent,
        }
      : null;

  const result = await connector.fetchRecords(
    buildConnectorContext(connection, entity, { cursor: syncConfig?.cursor ?? null, source })
  );

  if (!result.ok) {
    const detail = redact(result.message);
    await failJob(job, { code: result.code, detail, retryable: result.retryable });
    await db.integrationConnection.update({
      where: { id: connection.id },
      data: { lastErrorAt: new Date(), lastErrorMessage: detail, lastSyncStatus: "FAILED" },
    });
    await writeAuditLog({
      tenantId: job.tenantId,
      action: AUDIT_ACTIONS.CONNECT.SYNC_FAILED,
      module: "connect",
      entity: "integrationJob",
      entityId: job.id,
      details: `${entity}: ${result.code}`,
    });
    return await finishFailure(job.id, result.code, detail);
  }

  let applied = 0;
  let rejected = 0;
  let processed = 0;

  for (const external of result.records) {
    processed++;
    const mapped = applyMapping(entity, mapping, external.data);

    if (!mapped.ok) {
      rejected++;
      await db.integrationJobRecord.create({
        data: {
          tenantId: job.tenantId,
          jobId: job.id,
          entity,
          externalId: external.externalId,
          status: "REJECTED",
          reason: mapped.errors.join("; ").slice(0, 500),
        },
      });
      continue;
    }

    try {
      const outcome = await applyRecord({
        tenantId: job.tenantId,
        connectionId: connection.id,
        entity,
        externalId: external.externalId,
        record: mapped.value,
        conflictPolicy: syncConfig?.conflictPolicy ?? "KEEP_EXTERNAL",
      });

      if (outcome.status === "APPLIED") applied++;
      if (outcome.status === "REJECTED") rejected++;

      await db.integrationJobRecord.create({
        data: {
          tenantId: job.tenantId,
          jobId: job.id,
          entity,
          externalId: external.externalId,
          localId: "localId" in outcome ? outcome.localId : null,
          status: outcome.status,
          reason: "reason" in outcome ? outcome.reason.slice(0, 500) : null,
        },
      });
    } catch (error) {
      rejected++;
      const detail = redact(error instanceof Error ? error.message : "Unexpected error");
      await db.integrationJobRecord.create({
        data: {
          tenantId: job.tenantId,
          jobId: job.id,
          entity,
          externalId: external.externalId,
          status: "REJECTED",
          reason: detail,
        },
      });
    }
  }

  const finished = await completeJob(job.id, { processed, applied, rejected });

  await db.integrationConnection.update({
    where: { id: connection.id },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: finished.status,
      lastErrorAt: null,
      lastErrorMessage: null,
    },
  });

  if (syncConfig) {
    await db.integrationSyncConfig.update({
      where: { id: syncConfig.id },
      data: {
        lastRunAt: new Date(),
        cursor: result.nextCursor ?? null,
        nextRunAt:
          syncConfig.frequency === "HOURLY" ? new Date(Date.now() + 60 * 60 * 1000) : null,
      },
    });
  }

  await writeAuditLog({
    tenantId: job.tenantId,
    action: AUDIT_ACTIONS.CONNECT.SYNC_COMPLETED,
    module: "connect",
    entity: "integrationJob",
    entityId: job.id,
    details: `${entity}: ${applied} applied, ${rejected} rejected`,
  });

  return {
    jobId: job.id,
    status: finished.status,
    processed,
    applied,
    rejected,
    errorCode: null,
    errorDetail: null,
  };
}

async function finishFailure(jobId: string, code: string, detail: string): Promise<JobRunResult> {
  const job = await db.integrationJob.findUnique({ where: { id: jobId } });
  return {
    jobId,
    status: job?.status ?? "FAILED",
    processed: job?.processedCount ?? 0,
    applied: job?.appliedCount ?? 0,
    rejected: job?.rejectedCount ?? 0,
    errorCode: code,
    errorDetail: detail,
  };
}

/** Scheduler helper: claim and run, returning the per-job outcomes. */
export async function runClaimedJobs(jobs: IntegrationJob[]): Promise<JobRunResult[]> {
  const results: JobRunResult[] = [];
  for (const job of jobs) {
    try {
      results.push(await runJob(job.id));
    } catch (error) {
      const detail = redact(error instanceof Error ? error.message : "Unexpected error");
      await failJob(job, { code: "CONNECT_JOB_CRASHED", detail, retryable: true });
      results.push({
        jobId: job.id,
        status: "FAILED",
        processed: 0,
        applied: 0,
        rejected: 0,
        errorCode: "CONNECT_JOB_CRASHED",
        errorDetail: detail,
      });
    }
  }
  return results;
}
