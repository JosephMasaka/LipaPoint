/**
 * eTIMS (KRA) connector for LipaPoint Connect.
 *
 * Read-only mirror of the tenant's own KRA eTIMS submission records, exposed
 * as products (invoice lines) and customers (buyers) through the Connect
 * catalogue, sync, job history and webhooks. It is not a second submission
 * path — real submission stays on the etims module behind POST /api/orders,
 * the credit-note hook and the STK completion path — and this connector
 * writes nothing back to KRA.
 *
 * The connector reads EtimsInvoice rows directly (no HTTP), so the catalogue
 * snapshot and the real submission path agree on seller identity, line format
 * and invoice-number semantics.
 *
 * Auth: eTIMS is a KRA-registered device, not a per-connection API credential,
 * so this connector has no credential form. The device is configured once per
 * tenant in Settings > eTIMS.
 */
import type {
  Connector,
  ConnectorContext,
  ConnectorResult,
  ConnectorTestResult,
} from "../types";
import { db } from "@/lib/db";
import type { EtimsDeviceType } from "@/lib/etims/provider";
import { readEtimsHttpConfig } from "@/lib/etims/provider";

const ACCOUNT_LABEL = "eTIMS (KRA) — tenant submission record mirror";

export const etimsConnector: Connector = {
  id: "etims",

  async testConnection(context: ConnectorContext): Promise<ConnectorTestResult> {
    // The connector reads this tenant's own submitted records, so the real
    // connectivity test is "does this tenant have usable seller config".
    const configured = context.config.deviceType;
    const deviceType: EtimsDeviceType = configured === "VSCU" ? "VSCU" : "OSCU";

    try {
      // Throws EtimsConfigError when seller config is missing, so the test
      // surfaces the same message the real submission path would show.
      readEtimsHttpConfig(deviceType);
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "eTIMS seller config is incomplete — set it up under Settings > eTIMS.",
      };
    }

    return { ok: true, accountLabel: ACCOUNT_LABEL };
  },

  async fetchRecords(context: ConnectorContext): Promise<ConnectorResult> {
    const { entity, connectionId: tenantId, limit } = context;

    if (entity !== "products" && entity !== "customers") {
      return {
        ok: false,
        code: "UNSUPPORTED_ENTITY",
        message: `eTIMS connector only exposes products and customers; requested entity "${entity}" is not supported.`,
        retryable: false,
      };
    }

    // Page cursors are invoice ids: stable, tenant-scoped and monotonic.
    const cursor = context.cursor ?? null;
    const where = {
      tenantId,
      ...(cursor ? { id: { gt: cursor } } : {}),
    };

    const rows = await db.etimsInvoice.findMany({
      where,
      orderBy: { id: "asc" },
      take: limit + 1,
      select: {
        id: true,
        sourceType: true,
        sourceRef: true,
        status: true,
        kraInvoiceNumber: true,
        qrCodeUrl: true,
        totalAmount: true,
        taxAmount: true,
        submittedAt: true,
      },
    });

    const records = rows.map((row) => {
      const shared = {
        etimsId: row.id,
        sourceType: row.sourceType,
        sourceRef: row.sourceRef,
        status: row.status,
        kraInvoiceNumber: row.kraInvoiceNumber,
        totalAmount: row.totalAmount,
        taxAmount: row.taxAmount,
        submittedAt: row.submittedAt,
        __etimsRecord: true,
      };

      // One EtimsInvoice is a submitted document, not a buyer record: the
      // customer view projects the document reference and status so an
      // integration can reconcile what KRA acknowledged for that buyer.
      return entity === "customers"
        ? {
            externalId: `etims:${row.id}`,
            data: { ...shared, customerRef: row.sourceRef, qrCodeUrl: row.qrCodeUrl },
          }
        : { externalId: `etims:${row.id}`, data: shared };
    });

    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;

    return {
      ok: true,
      records: page,
      accountLabel: ACCOUNT_LABEL,
      nextCursor: hasMore ? page[page.length - 1].externalId.replace("etims:", "") : null,
    };
  },
};
