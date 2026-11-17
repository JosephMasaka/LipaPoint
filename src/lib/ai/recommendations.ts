import { db } from "@/lib/db";
import { buildIntelligence } from "./intelligence";
import type { AiScopeInfo, RestockSuggestion } from "./types";

/**
 * Deterministic, evidence-backed recommendations (Milestone 2).
 *
 * Nothing here calls a model: each row is derived from the same
 * `buildIntelligence` snapshot the chat tools use, so a recommendation can
 * always be traced back to the product rows and formula that produced it.
 * No recommendation executes anything.
 */

export const RECOMMENDATION_STATUSES = ["new", "accepted", "dismissed", "done"] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

const CONFIDENCE_BY_URGENCY: Record<RestockSuggestion["urgency"], number> = {
  critical: 0.9,
  high: 0.75,
  medium: 0.6,
};

export function isRecommendationStatus(value: unknown): value is RecommendationStatus {
  return typeof value === "string" && (RECOMMENDATION_STATUSES as readonly string[]).includes(value);
}

/**
 * Stable per product+branch, deliberately excluding the period: regenerating
 * daily updates the existing row instead of creating a new one, so a
 * dismissal is not undone by tomorrow's refresh.
 */
export function restockFingerprint(productId: string, locationId: string | null): string {
  return `restock:${productId}:${locationId ?? "all"}`;
}

export interface RecommendationDraft {
  type: "restock";
  productId: string;
  title: string;
  summary: string;
  urgency: RestockSuggestion["urgency"];
  confidence: number;
  fingerprint: string;
  evidence: {
    formula: string;
    stock: number;
    velocityPerDay: number;
    daysOfCover: number;
    suggestedQty: number;
    targetDays: number;
    period: { from: string; to: string };
    scope: { locationId: string | null };
  };
}

export function draftFromRestock(
  suggestion: RestockSuggestion,
  scope: AiScopeInfo
): RecommendationDraft {
  const { productId, product, stock, velocityPerDay, daysOfCover, suggestedQty, targetDays, urgency } =
    suggestion;
  return {
    type: "restock",
    productId,
    title: `Restock ${product}`,
    summary:
      `${product} has about ${Math.round(daysOfCover)} day${daysOfCover === 1 ? "" : "s"} of cover ` +
      `at ${velocityPerDay.toFixed(2)} units/day. Order roughly ${suggestedQty} units to reach ` +
      `${targetDays} days.`,
    urgency,
    confidence: CONFIDENCE_BY_URGENCY[urgency] ?? 0.5,
    fingerprint: restockFingerprint(productId, scope.locationId),
    evidence: {
      formula: `ceil(velocityPerDay × ${targetDays} − stock), kept only when daysOfCover < ${targetDays}`,
      stock,
      velocityPerDay,
      daysOfCover,
      suggestedQty,
      targetDays,
      period: { from: scope.from, to: scope.to },
      scope: { locationId: scope.locationId },
    },
  };
}

/**
 * Recomputes restock recommendations for one scope and upserts them.
 * Existing `accepted`/`dismissed`/`done` rows keep their status.
 */
export async function syncRestockRecommendations(
  scope: AiScopeInfo
): Promise<{ created: number; updated: number }> {
  const intel = await buildIntelligence(scope.tenantId, {
    from: new Date(scope.from),
    to: new Date(scope.to),
    locationId: scope.locationId ?? undefined,
  });

  let created = 0;
  let updated = 0;

  for (const suggestion of intel.restock) {
    const draft = draftFromRestock(suggestion, scope);
    const existing = await db.aiRecommendation.findUnique({
      where: { tenantId_fingerprint: { tenantId: scope.tenantId, fingerprint: draft.fingerprint } },
      select: { id: true },
    });

    if (existing) {
      await db.aiRecommendation.update({
        where: { id: existing.id },
        data: {
          title: draft.title,
          summary: draft.summary,
          urgency: draft.urgency,
          confidence: draft.confidence,
          periodFrom: new Date(scope.from),
          periodTo: new Date(scope.to),
          evidence: draft.evidence,
        },
      });
      updated++;
    } else {
      await db.aiRecommendation.create({
        data: {
          tenantId: scope.tenantId,
          ...draft,
          periodFrom: new Date(scope.from),
          periodTo: new Date(scope.to),
          locationId: scope.locationId,
        },
      });
      created++;
    }
  }

  return { created, updated };
}

export async function listRecommendations(
  tenantId: string,
  options: { status?: RecommendationStatus | "all"; limit?: number } = {}
) {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  return db.aiRecommendation.findMany({
    where: {
      tenantId,
      ...(options.status && options.status !== "all" ? { status: options.status } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
  });
}

export async function recommendationCounts(tenantId: string) {
  const rows = await db.aiRecommendation.groupBy({
    by: ["status"],
    where: { tenantId },
    _count: { _all: true },
  });
  const counts: Record<RecommendationStatus, number> = {
    new: 0,
    accepted: 0,
    dismissed: 0,
    done: 0,
  };
  for (const row of rows) {
    if (isRecommendationStatus(row.status)) counts[row.status] = row._count._all;
  }
  return counts;
}

/**
 * Human-only status change. `updateMany` is tenant-scoped, so an id from
 * another tenant is a no-op rather than a cross-tenant write.
 */
export async function setRecommendationStatus(
  tenantId: string,
  id: string,
  status: RecommendationStatus,
  userId: string,
  feedback?: string
): Promise<boolean> {
  const result = await db.aiRecommendation.updateMany({
    where: { id, tenantId },
    data: {
      status,
      feedback: feedback ?? null,
      resolvedAt: status === "new" ? null : new Date(),
      resolvedById: status === "new" ? null : userId,
    },
  });
  return result.count > 0;
}
