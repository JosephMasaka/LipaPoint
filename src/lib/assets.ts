import { db } from "./db";
import { postJournalEntry } from "./journal";
import { hasSoftDependency } from "./features";
import { writeAuditLog, AUDIT_ACTIONS } from "./audit";

/**
 * Asset management (LipaPoint ERP spec §4.5) — a lightweight register for
 * POS-tenant assets (till machines, delivery bikes, kitchen equipment,
 * furniture), deliberately shallower than SAP-PM.
 *
 * Accounting rules encoded here:
 * - Straight-line monthly depreciation: (cost − residual) / lifeMonths,
 *   capped so book value never drops below residual. Posted once per run
 *   as a single balanced JE (DR 6500 Depreciation / CR 1510 Accumulated
 *   Depreciation), one AssetDepreciationEntry per asset for provenance.
 * - The run is idempotent: an asset already booked for a period is skipped,
 *   so re-running after adding a mid-month asset just fills the gaps.
 * - Disposal removes remaining book value from the GL: DR accumulated
 *   depreciation, CR asset cost, with the proceeds hitting the wallet and
 *   the difference posted as gain (4200) or loss (6800).
 * - disposed/lost assets stop depreciating immediately.
 */

export class AssetError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "AssetError";
  }
}

function toCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export const ASSET_CATEGORIES = ["equipment", "it", "kitchen", "furniture", "vehicle", "other"] as const;
export const DEPRECIATION_METHODS = ["straight_line", "none"] as const;
/** Statuses an asset can be moved between directly (disposed/lost only via disposal). */
export const ACTIVE_STATUSES = ["in_service", "under_maintenance"] as const;
export const CLOSED_STATUSES = ["disposed", "lost"] as const;

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "2026-11" → Date.UTC(2026, 10, 1). */
export function periodStart(period: string): Date {
  if (!PERIOD_RE.test(period)) {
    throw new AssetError(`Invalid period "${period}" — expected YYYY-MM`);
  }
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

export interface CreateAssetInput {
  tenantId: string;
  name: string;
  category?: string;
  description?: string | null;
  purchaseCost: number;
  purchaseDate: Date | string;
  locationId?: string | null;
  supplierId?: string | null;
  assignedTo?: string | null;
  depreciationMethod?: string;
  usefulLifeMonths?: number;
  residualValue?: number;
  createdBy?: string | null;
}

/**
 * Next asset tag: AST-0001, AST-0002… — same count+1 scheme as staff
 * numbers and POs; a race fails loudly on the unique constraint.
 */
async function nextAssetCode(tenantId: string): Promise<string> {
  const count = await db.asset.count({ where: { tenantId } });
  return `AST-${String(count + 1).padStart(4, "0")}`;
}

function toDate(value: Date | string | null | undefined, field: string): Date {
  const d = typeof value === "string" ? new Date(value) : value;
  if (!d || Number.isNaN(d.getTime())) throw new AssetError(`Invalid date for ${field}`);
  return d;
}

/** One month's straight-line charge, capped by what's left to write off. */
export function monthlyDepreciation(asset: {
  depreciationMethod: string;
  purchaseCost: number;
  residualValue: number;
  usefulLifeMonths: number;
  accumulatedDepreciation: number;
}): number {
  if (asset.depreciationMethod !== "straight_line") return 0;
  const depreciable = toCents(asset.purchaseCost - asset.residualValue);
  if (asset.usefulLifeMonths <= 0 || depreciable <= 0) return 0;
  const remaining = toCents(depreciable - asset.accumulatedDepreciation);
  if (remaining <= 0) return 0;
  return toCents(Math.min(depreciable / asset.usefulLifeMonths, remaining));
}

export async function createAsset(input: CreateAssetInput) {
  const name = input.name?.trim();
  if (!name) throw new AssetError("name is required");

  const cost = Number(input.purchaseCost);
  if (!Number.isFinite(cost) || cost <= 0) throw new AssetError("purchaseCost must be > 0");

  const purchaseDate = toDate(input.purchaseDate, "purchaseDate");

  const category = input.category ?? "equipment";
  if (!ASSET_CATEGORIES.includes(category as (typeof ASSET_CATEGORIES)[number])) {
    throw new AssetError(`category must be one of: ${ASSET_CATEGORIES.join(", ")}`);
  }

  const method = input.depreciationMethod ?? "straight_line";
  if (!DEPRECIATION_METHODS.includes(method as (typeof DEPRECIATION_METHODS)[number])) {
    throw new AssetError(`depreciationMethod must be one of: ${DEPRECIATION_METHODS.join(", ")}`);
  }

  const usefulLifeMonths = Number(input.usefulLifeMonths ?? 60);
  if (method === "straight_line" && (!Number.isInteger(usefulLifeMonths) || usefulLifeMonths <= 0)) {
    throw new AssetError("usefulLifeMonths must be a positive integer for straight-line depreciation");
  }

  const residualValue = Number(input.residualValue ?? 0);
  if (!Number.isFinite(residualValue) || residualValue < 0) {
    throw new AssetError("residualValue must be a non-negative number");
  }
  if (residualValue >= cost) {
    throw new AssetError("residualValue must be less than purchaseCost");
  }

  const asset = await db.asset.create({
    data: {
      tenantId: input.tenantId,
      assetCode: await nextAssetCode(input.tenantId),
      name,
      category,
      description: input.description?.trim() || null,
      purchaseCost: cost,
      purchaseDate,
      locationId: input.locationId ?? null,
      supplierId: input.supplierId ?? null,
      assignedTo: input.assignedTo ?? null,
      depreciationMethod: method,
      usefulLifeMonths,
      residualValue,
    },
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    userId: input.createdBy ?? null,
    action: AUDIT_ACTIONS.ASSETS.ASSET_CREATED,
    module: "assets",
    entity: "asset",
    entityId: asset.id,
    after: {
      assetCode: asset.assetCode,
      name: asset.name,
      purchaseCost: asset.purchaseCost,
      method: asset.depreciationMethod,
      usefulLifeMonths: asset.usefulLifeMonths,
    },
  });

  return asset;
}

export interface UpdateAssetInput {
  name?: string;
  category?: string;
  description?: string | null;
  locationId?: string | null;
  supplierId?: string | null;
  assignedTo?: string | null;
  depreciationMethod?: string;
  usefulLifeMonths?: number;
  residualValue?: number;
  lifecycleStatus?: string;
}

/**
 * Edits an open asset. Lifecycle can only move between the two active
 * states here — disposed/lost are terminal and go through disposeAsset
 * because they post to the GL. Salary-style rule: retro changes don't
 * rewrite posted entries; remaining depreciation simply adjusts.
 */
export async function updateAsset(tenantId: string, assetId: string, input: UpdateAssetInput, userId?: string | null) {
  const asset = await db.asset.findFirst({ where: { id: assetId, tenantId } });
  if (!asset) throw new AssetError("Asset not found", 404);
  if (CLOSED_STATUSES.includes(asset.lifecycleStatus as (typeof CLOSED_STATUSES)[number])) {
    throw new AssetError(`Asset is ${asset.lifecycleStatus} — closed assets cannot be edited`);
  }

  const data: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new AssetError("name cannot be empty");
    data.name = name;
  }
  if (input.category !== undefined) {
    if (!ASSET_CATEGORIES.includes(input.category as (typeof ASSET_CATEGORIES)[number])) {
      throw new AssetError(`category must be one of: ${ASSET_CATEGORIES.join(", ")}`);
    }
    data.category = input.category;
  }
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.locationId !== undefined) data.locationId = input.locationId || null;
  if (input.supplierId !== undefined) data.supplierId = input.supplierId || null;
  if (input.assignedTo !== undefined) data.assignedTo = input.assignedTo || null;

  if (input.depreciationMethod !== undefined) {
    if (!DEPRECIATION_METHODS.includes(input.depreciationMethod as (typeof DEPRECIATION_METHODS)[number])) {
      throw new AssetError(`depreciationMethod must be one of: ${DEPRECIATION_METHODS.join(", ")}`);
    }
    data.depreciationMethod = input.depreciationMethod;
  }
  if (input.usefulLifeMonths !== undefined) {
    const months = Number(input.usefulLifeMonths);
    if (!Number.isInteger(months) || months <= 0) throw new AssetError("usefulLifeMonths must be a positive integer");
    data.usefulLifeMonths = months;
  }
  if (input.residualValue !== undefined) {
    const residual = Number(input.residualValue);
    if (!Number.isFinite(residual) || residual < 0) throw new AssetError("residualValue must be a non-negative number");
    if (residual >= asset.purchaseCost) throw new AssetError("residualValue must be less than purchaseCost");
    const remaining = toCents(asset.purchaseCost - residual - asset.accumulatedDepreciation);
    if (remaining < 0) {
      throw new AssetError(
        `residualValue would put book value below zero — ${asset.accumulatedDepreciation} already depreciated`
      );
    }
    data.residualValue = residual;
  }
  if (input.lifecycleStatus !== undefined) {
    if (!ACTIVE_STATUSES.includes(input.lifecycleStatus as (typeof ACTIVE_STATUSES)[number])) {
      throw new AssetError(
        `lifecycleStatus must be one of: ${ACTIVE_STATUSES.join(", ")} (disposed/lost are set via disposal)`
      );
    }
    data.lifecycleStatus = input.lifecycleStatus;
  }

  if (Object.keys(data).length === 0) throw new AssetError("No fields to update");

  const updated = await db.asset.update({ where: { id: asset.id }, data });

  await writeAuditLog({
    tenantId,
    userId: userId ?? null,
    action: AUDIT_ACTIONS.ASSETS.ASSET_UPDATED,
    module: "assets",
    entity: "asset",
    entityId: asset.id,
    before: { name: asset.name, status: asset.lifecycleStatus, method: asset.depreciationMethod },
    after: { name: updated.name, status: updated.lifecycleStatus, method: updated.depreciationMethod },
  });

  return updated;
}

export interface RunDepreciationInput {
  tenantId: string;
  period: string; // "2026-11"
  userId?: string | null;
}

/**
 * Depreciates every eligible asset for a period in one transaction:
 * entries + accumulated-depreciation updates + the single balanced JE.
 * Idempotent — assets already booked for the period are skipped, so a
 * re-run only picks up assets that were added or unblocked since.
 * Future periods are refused (you cannot depreciate what hasn't happened).
 */
export async function runDepreciation(input: RunDepreciationInput) {
  const start = periodStart(input.period); // validates format
  const monthAfter = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  if (monthAfter > new Date()) {
    throw new AssetError(
      `Cannot run depreciation for ${input.period} — only completed months can be depreciated`
    );
  }

  const candidates = await db.asset.findMany({
    where: {
      tenantId: input.tenantId,
      depreciationMethod: "straight_line",
      lifecycleStatus: { notIn: [...CLOSED_STATUSES] },
      purchaseDate: { lte: monthAfter },
    },
  });

  const alreadyBooked = await db.assetDepreciationEntry.groupBy({
    by: ["assetId"],
    where: { tenantId: input.tenantId, period: input.period },
    _count: { _all: true },
  });
  const bookedIds = new Set(alreadyBooked.map((e) => e.assetId));

  const plan: { asset: (typeof candidates)[number]; amount: number }[] = [];
  for (const asset of candidates) {
    if (bookedIds.has(asset.id)) continue;
    const amount = monthlyDepreciation(asset);
    if (amount > 0) plan.push({ asset, amount });
  }

  if (plan.length === 0) {
    return { period: input.period, count: 0, total: 0, journalEntryId: null };
  }

  const total = toCents(plan.reduce((sum, row) => sum + row.amount, 0));

  // Soft dependency (sub-feature spec §1): depreciation reaches the GL only
  // while Finance's core (`general-ledger`) is active — otherwise the book
  // values still move and the period simply isn't journalised.
  const postToGl = await hasSoftDependency(input.tenantId, "general-ledger");

  const result = await db.$transaction(async (tx) => {
    const entry = postToGl
      ? await postJournalEntry(
          {
            tenantId: input.tenantId,
            date: start,
            reference: `DEP-${input.period}`,
            sourceModule: "assets",
            description: `Depreciation ${input.period} — ${plan.length} asset${plan.length === 1 ? "" : "s"}`,
            postedBy: input.userId ?? null,
            lines: [
              { accountCode: "6500", debit: total, description: `Depreciation expense ${input.period}` },
              { accountCode: "1510", credit: total, description: "Accumulated depreciation" },
            ],
          },
          tx
        )
      : null;

    for (const { asset, amount } of plan) {
      const bookValueAfter = toCents(asset.purchaseCost - (asset.accumulatedDepreciation + amount));
      await tx.assetDepreciationEntry.create({
        data: {
          tenantId: input.tenantId,
          assetId: asset.id,
          period: input.period,
          amount,
          bookValueAfter,
          journalEntryId: entry?.id ?? null,
        },
      });
      await tx.asset.update({
        where: { id: asset.id },
        data: { accumulatedDepreciation: toCents(asset.accumulatedDepreciation + amount) },
      });
    }

    return { entry, count: plan.length, total };
  }, { timeout: 30000 });

  await writeAuditLog({
    tenantId: input.tenantId,
    userId: input.userId ?? null,
    action: AUDIT_ACTIONS.ASSETS.DEPRECIATION_RUN,
    module: "assets",
    entity: "depreciationRun",
    entityId: result.entry?.id ?? `${input.tenantId}:${input.period}`,
    after: { period: input.period, assets: result.count, total, journalEntryId: result.entry?.id ?? null },
  });

  return {
    period: input.period,
    count: result.count,
    total,
    journalEntryId: result.entry?.id ?? null,
  };
}

export interface DisposeAssetInput {
  tenantId: string;
  assetId: string;
  /** Cash received on disposal; 0/omitted = scrapped, written off, or lost. */
  proceeds?: number;
  /** Wallet the proceeds land in (its linked GL account); defaults to Bank 1040. */
  bankAccountId?: string | null;
  /** true → mark "lost" instead of "disposed" (same GL treatment, no proceeds expected). */
  lost?: boolean;
  userId?: string | null;
}

/**
 * Disposes of (or writes off as lost) an asset: posts the GL entry that
 * moves remaining book value off the books, settles the proceeds into the
 * wallet, and closes the asset so it stops depreciating.
 */
export async function disposeAsset(input: DisposeAssetInput) {
  const asset = await db.asset.findFirst({ where: { id: input.assetId, tenantId: input.tenantId } });
  if (!asset) throw new AssetError("Asset not found", 404);
  if (CLOSED_STATUSES.includes(asset.lifecycleStatus as (typeof CLOSED_STATUSES)[number])) {
    throw new AssetError(`Asset is already ${asset.lifecycleStatus}`);
  }

  const proceeds = toCents(Number(input.proceeds ?? 0));
  if (!Number.isFinite(proceeds) || proceeds < 0) throw new AssetError("proceeds must be a non-negative number");
  if (input.lost && proceeds > 0) throw new AssetError("A lost asset cannot have disposal proceeds");

  // Wallet line: proceeds arrive as cash/bank. Resolve the GL account of
  // the chosen wallet, else the generic Bank account (1040).
  let walletCode = "1040";
  if (proceeds > 0 && input.bankAccountId) {
    const bank = await db.bankAccount.findFirst({
      where: { id: input.bankAccountId, tenantId: input.tenantId, isActive: true },
      include: { coaAccount: { select: { code: true } } },
    });
    if (!bank) throw new AssetError("Bank account not found for this tenant", 404);
    if (!bank.coaAccount?.code) throw new AssetError(`Bank account ${bank.name} has no linked GL account`);
    walletCode = bank.coaAccount.code;
  }

  const cost = toCents(asset.purchaseCost);
  const accum = toCents(asset.accumulatedDepreciation);
  const bookValue = toCents(cost - accum);
  const gain = toCents(proceeds - bookValue); // > 0 gain · < 0 loss

  const lines = [
    ...(accum > 0 ? [{ accountCode: "1510", debit: accum, description: `Accumulated depreciation — ${asset.assetCode}` }] : []),
    ...(proceeds > 0 ? [{ accountCode: walletCode, debit: proceeds, description: `Disposal proceeds — ${asset.name}` }] : []),
    { accountCode: "1500", credit: cost, description: `Cost removed — ${asset.assetCode} ${asset.name}` },
    ...(gain > 0
      ? [{ accountCode: "4200", credit: gain, description: "Gain on disposal" }]
      : gain < 0
        ? [{ accountCode: "6800", debit: -gain, description: "Loss on disposal" }]
        : []),
  ];

  const status = input.lost ? "lost" : "disposed";

  // Soft dependency (sub-feature spec §1): disposal only reaches the GL while
  // Finance's core (`general-ledger`) is active — the asset still closes and
  // the audit log still records the gain/loss, just without a journal entry.
  const postToGl = await hasSoftDependency(input.tenantId, "general-ledger");

  const entry = await db.$transaction(async (tx) => {
    const created = postToGl
      ? await postJournalEntry(
          {
            tenantId: input.tenantId,
            reference: `DISP-${asset.assetCode}`,
            sourceModule: "assets",
            sourceId: asset.id,
            description: `${input.lost ? "Write-off" : "Disposal"} — ${asset.name} (book value ${bookValue})`,
            postedBy: input.userId ?? null,
            lines,
          },
          tx
        )
      : null;
    await tx.asset.update({
      where: { id: asset.id },
      data: {
        lifecycleStatus: status,
        disposedAt: new Date(),
        disposalProceeds: proceeds,
      },
    });
    return created;
  }, { timeout: 20000 });

  await writeAuditLog({
    tenantId: input.tenantId,
    userId: input.userId ?? null,
    action: AUDIT_ACTIONS.ASSETS.ASSET_DISPOSED,
    module: "assets",
    entity: "asset",
    entityId: asset.id,
    before: { status: asset.lifecycleStatus, bookValue, accumulated: accum },
    after: { status, proceeds, gain, journalEntryId: entry?.id ?? null },
  });

  return { asset: { id: asset.id, lifecycleStatus: status }, journalEntryId: entry?.id ?? null, bookValue, proceeds, gain };
}

export interface RecordMaintenanceInput {
  tenantId: string;
  assetId: string;
  date: Date | string; // date the work was done
  description: string;
  cost: number;
  performedBy?: string | null;
  nextDueDate?: Date | string | null;
  notes?: string | null;
  userId?: string | null;
}

/**
 * Logs a maintenance event against an asset — the row the Maintenance Cost
 * report (reports-spec §9) aggregates. Purely additive: it does not move the
 * asset's book value or post to the GL (maintenance spend is expensed
 * through the expense flow when it is paid).
 */
export async function recordAssetMaintenance(input: RecordMaintenanceInput) {
  const asset = await db.asset.findFirst({
    where: { id: input.assetId, tenantId: input.tenantId },
    select: { id: true, assetCode: true, name: true, lifecycleStatus: true },
  });
  if (!asset) throw new AssetError("Asset not found", 404);
  if (CLOSED_STATUSES.includes(asset.lifecycleStatus as (typeof CLOSED_STATUSES)[number])) {
    throw new AssetError(`Asset is ${asset.lifecycleStatus} — closed assets cannot take new maintenance`);
  }
  if (!input.description?.trim()) throw new AssetError("description is required");

  const date = toDate(input.date, "date");
  const cost = toCents(Number(input.cost ?? 0));
  if (!Number.isFinite(cost) || cost < 0) throw new AssetError("cost must be a non-negative number");
  const nextDueDate = input.nextDueDate ? toDate(input.nextDueDate, "nextDueDate") : null;

  const created = await db.assetMaintenance.create({
    data: {
      tenantId: input.tenantId,
      assetId: asset.id,
      date,
      description: input.description.trim(),
      cost,
      performedBy: input.performedBy || null,
      nextDueDate,
      notes: input.notes || null,
    },
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    userId: input.userId ?? null,
    action: AUDIT_ACTIONS.ASSETS.MAINTENANCE_LOGGED,
    module: "assets",
    entity: "assetMaintenance",
    entityId: created.id,
    after: {
      assetCode: asset.assetCode,
      date,
      description: created.description,
      cost,
      nextDueDate,
    },
  });

  return created;
}

/**
 * Deletes an open asset. Refuses anything that has touched the GL
 * (depreciated or disposed assets must stay for the ledger to make sense).
 */
/**
 * Deletes an open asset. Refuses anything that has touched the GL
 * (depreciated or disposed assets must stay for the ledger to make sense).
 */
export async function deleteAsset(tenantId: string, assetId: string, userId?: string | null) {
  const asset = await db.asset.findFirst({ where: { id: assetId, tenantId } });
  if (!asset) throw new AssetError("Asset not found", 404);

  const entries = await db.assetDepreciationEntry.count({ where: { assetId } });
  if (entries > 0) {
    throw new AssetError(
      `Has ${entries} depreciation entr${entries === 1 ? "y" : "ies"} on record — assets that have been depreciated must stay for the GL`,
      409
    );
  }
  if (CLOSED_STATUSES.includes(asset.lifecycleStatus as (typeof CLOSED_STATUSES)[number])) {
    throw new AssetError("Disposed/lost assets cannot be deleted — they are part of the audit trail", 409);
  }

  await db.asset.delete({ where: { id: asset.id } });

  await writeAuditLog({
    tenantId,
    userId: userId ?? null,
    action: AUDIT_ACTIONS.ASSETS.ASSET_DELETED,
    module: "assets",
    entity: "asset",
    entityId: asset.id,
    before: { assetCode: asset.assetCode, name: asset.name, purchaseCost: asset.purchaseCost },
  });

  return { id: asset.id };
}
