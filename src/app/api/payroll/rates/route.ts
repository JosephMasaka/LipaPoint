import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRatesForPeriod, ensureStatutoryRates, PayrollError, type PayeBand } from "@/lib/payroll";
import { writeAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { requireUserWithModule, routeError, parseBody } from "@/lib/api-guards";

/**
 * GET /api/payroll/rates — the statutory rate table plus the rates
 * currently in force for this month, resolved for THIS tenant: their own
 * override rows first, then the shared platform default. Surfaced on the
 * Payroll page so "which rates produced this payslip?" has an answer on
 * screen, with the review warning the spec requires (rates must be
 * verified against KRA/NSSF/SHA notices before filing).
 *
 * Query: period (YYYY-MM) to preview rates for a specific month.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("payroll");
    if (auth.response) return auth.response;
    const { user } = auth;

    const period =
      request.nextUrl.searchParams.get("period") ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    await ensureStatutoryRates();
    const [current, versions] = await Promise.all([
      getRatesForPeriod(period, user.tenantId),
      // A tenant only ever sees the shared default + their own overrides —
      // never another tenant's rows.
      db.statutoryRateTable.findMany({
        where: { OR: [{ tenantId: null }, { tenantId: user.tenantId }] },
        orderBy: { effectiveFrom: "desc" },
      }),
    ]);

    return NextResponse.json({
      period,
      current,
      versions: versions.map((v) => ({
        id: v.id,
        label: v.label,
        effectiveFrom: v.effectiveFrom,
        isDefault: v.isDefault,
        // Where this row came from: shared platform copy vs this tenant's own.
        scope: v.tenantId === user.tenantId ? "tenant" : "platform",
        payeBands: v.payeBands as unknown as PayeBand[],
        personalRelief: v.personalRelief,
        nssfRateEmployee: v.nssfRateEmployee,
        nssfRateEmployer: v.nssfRateEmployer,
        nssfTier1Cap: v.nssfTier1Cap,
        nssfTier2Cap: v.nssfTier2Cap,
        shifRate: v.shifRate,
        shifMinimum: v.shifMinimum,
        housingLevyRate: v.housingLevyRate,
        nitaLevyPerEmployee: v.nitaLevyPerEmployee,
      })),
    });
  } catch (error) {
    return routeError("GET /api/payroll/rates", error);
  }
}

interface RateVersionBody {
  label?: string;
  effectiveFrom?: string;
  payeBands?: PayeBand[];
  personalRelief?: number;
  nssfRateEmployee?: number;
  nssfRateEmployer?: number;
  nssfTier1Cap?: number;
  nssfTier2Cap?: number;
  shifRate?: number;
  shifMinimum?: number;
  housingLevyRate?: number;
  nitaLevyPerEmployee?: number;
}

const SCALAR_FIELDS = [
  "personalRelief",
  "nssfRateEmployee",
  "nssfRateEmployer",
  "nssfTier1Cap",
  "nssfTier2Cap",
  "shifRate",
  "shifMinimum",
  "housingLevyRate",
  "nitaLevyPerEmployee",
] as const;

function bad(message: string): never {
  throw new PayrollError(message);
}

/**
 * POST /api/payroll/rates — adds a new rate version as a TENANT-SCOPED
 * override: effective from a given date, layered on top of the shared
 * platform default for this tenant only (other tenants are unaffected).
 * Historical payslips are untouched — they keep pointing at the row they
 * were computed with.
 *
 * Body: { label, effectiveFrom, payeBands: [{upTo, rate}…], …scalars }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithModule("payroll");
    if (auth.response) return auth.response;
    const { user } = auth;

    const body = await parseBody<RateVersionBody>(request);

    const label = body.label?.trim();
    if (!label) bad("label is required");
    if (!body.effectiveFrom) bad("effectiveFrom is required");
    const effectiveFrom = new Date(body.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) bad("effectiveFrom must be a valid date");

    // PAYE bands: at least one, caps strictly ascending, open-ended (null)
    // band allowed only at the end, all rates non-negative numbers.
    const bands = body.payeBands;
    if (!Array.isArray(bands) || bands.length === 0) {
      bad("payeBands must be a non-empty array of { upTo, rate }");
    }
    let previousCap = -Infinity;
    bands.forEach((band, i) => {
      const rate = Number(band?.rate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        bad(`PAYE band ${i + 1}: rate must be between 0 and 100`);
      }
      if (band.upTo === null || band.upTo === undefined) {
        if (i !== bands.length - 1) {
          bad("only the last PAYE band may be open-ended (upTo: null)");
        }
        return;
      }
      const cap = Number(band.upTo);
      if (!Number.isFinite(cap) || cap <= previousCap) {
        bad(`PAYE band ${i + 1}: upTo must be greater than the previous band's cap`);
      }
      previousCap = cap;
    });

    // Omitted scalars fall back to their schema defaults (the reference
    // statutory values) — only what the caller actually sends is validated.
    const scalars: Record<string, number> = {};
    for (const field of SCALAR_FIELDS) {
      const raw = body[field] as number | string | null | undefined;
      if (raw === undefined || raw === null || raw === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        bad(`${field} must be a non-negative number`);
      }
      scalars[field] = value;
    }

    const clash = await db.statutoryRateTable.findFirst({
      where: { tenantId: user.tenantId, effectiveFrom },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json(
        { error: `A rate version already exists for ${effectiveFrom.toISOString().slice(0, 10)} for this tenant` },
        { status: 409 }
      );
    }

    const created = await db.statutoryRateTable.create({
      data: {
        tenantId: user.tenantId,
        label,
        effectiveFrom,
        payeBands: bands.map((b) => ({
          upTo: b.upTo === null || b.upTo === undefined ? null : Number(b.upTo),
          rate: Number(b.rate),
        })),
        ...scalars,
        isDefault: false,
      },
    });

    await writeAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      action: AUDIT_ACTIONS.PAYROLL.RATES_VERSION_ADDED,
      module: "payroll",
      entity: "statutoryRateTable",
      entityId: created.id,
      after: { label, effectiveFrom, payeBands: created.payeBands, ...scalars },
    });

    return NextResponse.json(
      {
        id: created.id,
        label: created.label,
        effectiveFrom: created.effectiveFrom,
        scope: "tenant",
        payeBands: created.payeBands as unknown as PayeBand[],
        ...scalars,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof PayrollError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return routeError("POST /api/payroll/rates", error);
  }
}
