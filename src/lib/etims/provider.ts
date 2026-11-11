/**
 * eTIMS / KRA provider layer — OSCU + VSCU (LipaPoint ERP spec §4.8).
 *
 * Decision (spec §8 Phase 2 "build-vs-reuse TimsIQ"): this is an internal
 * module of LipaPoint ERP behind a narrow provider seam, not a call into
 * TimsIQ. TimsIQ is a separate product that has not reached production, so
 * coupling to it would block Phase 2 on another team's timeline — but the
 * seam is deliberately tiny (one `submit(payload)` method), so if TimsIQ
 * does ship first, its hosted integration layer drops in as a second
 * provider implementation without touching submission, storage or UI.
 *
 * Both KRA eTIMS device types are supported:
 * - OSCU (Online Sales Control Unit) — retail/POS merchants: till sales
 *   and credit notes, captured in real time.
 * - VSCU (Virtual Sales Control Unit) — wholesale/B2B merchants: full
 *   invoicing (including supplier invoices) with no physical device.
 *
 * They share one wire format behind this seam. The middleware is told which
 * device type is speaking (`deviceType` in the body, `x-device-type` on the
 * request), and each type has its own base-URL env var (ETIMS_OSCU_BASE_URL
 * / ETIMS_VSCU_BASE_URL), with ETIMS_BASE_URL covering a single middleware
 * that serves both.
 *
 * Implementations:
 * - EtimsHttpProvider — real HTTP adapter for the middleware endpoint.
 *   Configured entirely by env (see .env.example); fails loudly when
 *   misconfigured rather than silently falling back to the mock, because a
 *   fake KRA invoice number printed on a customer receipt is a compliance
 *   incident, not a convenience.
 * - MockEtimsProvider — deterministic accept, used in dev/test and when no
 *   device endpoint is configured. Generates clearly-labelled MOCK- invoice
 *   numbers so they can never be mistaken for real KRA documents.
 */

export type EtimsDocumentType = "sale" | "credit_note" | "supplier_invoice";

export interface EtimsItemLine {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** Percent, e.g. 16 for Kenyan VAT. */
  taxRate: number;
  taxAmount: number;
}

export interface EtimsSubmissionPayload {
  /** orderNo / creditNoteNumber — our traceable reference. */
  internalRef: string;
  /**
   * Our EtimsInvoice.id, echoed back by the device's async confirmation so the
   * callback can resolve the row without guessing on internalRef alone.
   */
  submissionId?: string;
  documentType: EtimsDocumentType;
  issuedAt: Date;
  currency: string;
  seller: { tin: string; branch: string; name: string };
  buyer?: { name?: string | null; phone?: string | null; tin?: string | null } | null;
  /** Normalized: CASH | MOBILE_MONEY | CARD | BANK | CREDIT. */
  paymentMethod: string;
  lines: EtimsItemLine[];
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  memo?: string | null;
}

/**
 * Outcome of one submission attempt. The distinction that matters:
 * - `rejected`  — KRA saw it and said no. Needs a human fix, then a retry.
 * - `unreachable` — we never got an answer (timeout, 5xx, DNS). The row
 *   stays `pending` and is safe to retry automatically; nothing was
 *   accepted, so a retry cannot double-submit.
 * - `submitted` — accepted for asynchronous processing (no invoice number
 *   yet); the row waits for a confirmation callback/poll.
 */
export type EtimsSubmitOutcome =
  | { outcome: "accepted"; kraInvoiceNumber: string; qrCodeUrl?: string | null; raw?: unknown }
  | { outcome: "submitted"; reference?: string | null; raw?: unknown }
  | { outcome: "rejected"; reason: string; raw?: unknown }
  | { outcome: "unreachable"; error: string };

export interface EtimsProvider {
  readonly name: string;
  submit(payload: EtimsSubmissionPayload): Promise<EtimsSubmitOutcome>;
}

/** Which KRA eTIMS device type this deployment speaks for. */
export type EtimsDeviceType = "OSCU" | "VSCU";

/**
 * Middleware connection settings for one device type, resolved from env.
 * Seller identity (TIN/branch/CSID) is shared — a deployment registers one
 * KRA device — only the endpoint differs.
 */
export interface EtimsHttpConfig {
  deviceType: EtimsDeviceType;
  baseUrl: string;
  tin: string;
  branch: string;
  csid: string;
  apiKey?: string;
  sellerName: string;
  timeoutMs: number;
}

export class EtimsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EtimsConfigError";
  }
}

/** Base-URL env var for a device type; ETIMS_BASE_URL covers either. */
function baseUrlVarFor(deviceType: EtimsDeviceType): string {
  return deviceType === "VSCU" ? "ETIMS_VSCU_BASE_URL" : "ETIMS_OSCU_BASE_URL";
}

export function readEtimsHttpConfig(deviceType: EtimsDeviceType): EtimsHttpConfig {
  const deviceVar = baseUrlVarFor(deviceType);
  const baseUrl = process.env[deviceVar]?.trim() || process.env.ETIMS_BASE_URL?.trim();
  const tin = process.env.ETIMS_SELLER_TIN?.trim();
  const branch = process.env.ETIMS_SELLER_BRANCH?.trim();
  const csid = process.env.ETIMS_CSID?.trim();

  const missing = [
    !baseUrl && `${deviceVar} (or ETIMS_BASE_URL)`,
    !tin && "ETIMS_SELLER_TIN",
    !branch && "ETIMS_SELLER_BRANCH",
    !csid && "ETIMS_CSID",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new EtimsConfigError(
      `eTIMS provider is set to "${deviceType.toLowerCase()}" but missing: ${missing.join(", ")}. ` +
        `Refusing to fall back to the mock — that would put fake KRA invoice numbers on receipts.`
    );
  }

  return {
    deviceType,
    baseUrl: baseUrl!,
    tin: tin!,
    branch: branch!,
    csid: csid!,
    apiKey: process.env.ETIMS_API_KEY?.trim() || undefined,
    sellerName: process.env.ETIMS_SELLER_NAME?.trim() || "LipaPoint Merchant",
    timeoutMs: parseInt(process.env.ETIMS_TIMEOUT_MS || "5000", 10),
  };
}

/**
 * Real HTTP adapter for the eTIMS middleware, for either device type.
 * Maps our normalized payload onto the invoice envelope, tags it with the
 * device type KRA registered us under, and interprets the response.
 * Transport failures are folded into `unreachable` (retryable) instead of
 * throwing, so the caller never has to distinguish "the fetch blew up"
 * from "KRA said no".
 */
export class EtimsHttpProvider implements EtimsProvider {
  /** "oscu" | "vscu" — recorded on audit rows as `provider`. */
  readonly name: string;

  constructor(private readonly config: EtimsHttpConfig) {
    this.name = config.deviceType.toLowerCase();
  }

  async submit(payload: EtimsSubmissionPayload): Promise<EtimsSubmitOutcome> {
    const device = this.config.deviceType;
    const body = {
      deviceType: device,
      tin: this.config.tin,
      branch: this.config.branch,
      csid: this.config.csid,
      sellerName: this.config.sellerName,
      internalReference: payload.internalRef,
      submissionId: payload.submissionId,
      documentType: payload.documentType,
      issuedAt: payload.issuedAt.toISOString(),
      currency: payload.currency,
      buyer: payload.buyer ?? null,
      paymentMethod: payload.paymentMethod,
      items: payload.lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
        taxRate: line.taxRate,
        taxAmount: line.taxAmount,
      })),
      subtotal: payload.subtotal,
      discount: payload.discount,
      taxAmount: payload.taxAmount,
      total: payload.total,
      memo: payload.memo ?? null,
    };

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/etims/v1/invoices`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-device-type": device,
          authorization: `Bearer ${this.config.csid}`,
          ...(this.config.apiKey ? { "x-api-key": this.config.apiKey } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs),
        cache: "no-store",
      });
    } catch (error) {
      // Timeout / DNS / connection reset — nothing reached KRA, safe to retry.
      return { outcome: "unreachable", error: `${device} unreachable: ${(error as Error).message}` };
    }

    const rawText = await response.text().catch(() => "");
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
    } catch {
      // Non-JSON body (proxy error page, etc.) — keep the raw text only.
    }

    if (!response.ok) {
      const detail = rawText.slice(0, 300);
      if (response.status >= 400 && response.status < 500) {
        // KRA understood us and refused: permanent until the doc is fixed.
        return {
          outcome: "rejected",
          reason: `${device} ${response.status}: ${detail || "rejected by KRA"}`,
          raw: parsed ?? { status: response.status, body: rawText.slice(0, 1000) },
        };
      }
      // 5xx / gateway errors: transient.
      return { outcome: "unreachable", error: `${device} ${response.status}: ${detail.slice(0, 200)}` };
    }

    const invoiceNumber = (parsed?.invoiceNumber ?? parsed?.kraInvoiceNumber) as string | undefined;
    const qrCodeUrl = (parsed?.qrCode ?? parsed?.qrCodeUrl) as string | undefined;
    const accepted = (parsed?.accepted ?? parsed?.success) as boolean | undefined;

    if (accepted === false) {
      const errors = parsed?.errors as Array<{ message?: string }> | undefined;
      const reason =
        errors && errors.length > 0
          ? errors.map((e) => e.message ?? JSON.stringify(e)).join("; ")
          : "Rejected by KRA";
      return { outcome: "rejected", reason, raw: parsed };
    }

    if (!invoiceNumber) {
      // 2xx but no number yet: queued for async processing at KRA's side.
      return {
        outcome: "submitted",
        reference: (parsed?.reference ?? parsed?.trackingId) as string | null | undefined,
        raw: parsed,
      };
    }

    return {
      outcome: "accepted",
      kraInvoiceNumber: invoiceNumber,
      qrCodeUrl: qrCodeUrl ?? null,
      raw: parsed,
    };
  }
}

/**
 * Deterministic stand-in used in dev/test. Accepts every payload, assigns a
 * clearly-fake `MOCK-` invoice number, and never touches the network.
 */
export class MockEtimsProvider implements EtimsProvider {
  readonly name = "mock";

  async submit(payload: EtimsSubmissionPayload): Promise<EtimsSubmitOutcome> {
    return {
      outcome: "accepted",
      kraInvoiceNumber: `MOCK-${payload.internalRef}`,
      qrCodeUrl: null,
      raw: { mock: true, internalRef: payload.internalRef, total: payload.total },
    };
  }
}

/**
 * Resolves the active provider from env.
 * - ETIMS_PROVIDER=oscu  → OSCU adapter (throws EtimsConfigError if unconfigured)
 * - ETIMS_PROVIDER=vscu  → VSCU adapter (throws EtimsConfigError if unconfigured)
 * - ETIMS_PROVIDER=mock  → mock
 * - unset                → mock unless a device base URL is present, in which
 *                          case live is assumed for that device (a VSCU base
 *                          URL selects VSCU, otherwise OSCU; config errors
 *                          still loud).
 * - anything else        → EtimsConfigError: a typo must never silently
 *                          pick a device.
 */
export function getEtimsProvider(): EtimsProvider {
  const mode = process.env.ETIMS_PROVIDER?.trim().toLowerCase();

  if (mode === "mock") return new MockEtimsProvider();
  if (mode === "oscu") return new EtimsHttpProvider(readEtimsHttpConfig("OSCU"));
  if (mode === "vscu") return new EtimsHttpProvider(readEtimsHttpConfig("VSCU"));
  if (mode) {
    throw new EtimsConfigError(
      `Unknown ETIMS_PROVIDER "${mode}" — expected "mock", "oscu" or "vscu".`
    );
  }

  // Unset: live when an endpoint is configured. The device type is inferred
  // from which base URL is present; with only the shared ETIMS_BASE_URL
  // set, OSCU is assumed (set ETIMS_PROVIDER=vscu to override).
  if (process.env.ETIMS_VSCU_BASE_URL?.trim()) {
    return new EtimsHttpProvider(readEtimsHttpConfig("VSCU"));
  }
  if (process.env.ETIMS_OSCU_BASE_URL?.trim() || process.env.ETIMS_BASE_URL?.trim()) {
    return new EtimsHttpProvider(readEtimsHttpConfig("OSCU"));
  }

  return new MockEtimsProvider();
}

/** KRA payment-method buckets (spec §4.1 payment methods → eTIMS codes). */
export function normalizePaymentMethod(
  method: string,
  paymentStatus?: string | null
): string {
  switch (method) {
    case "CASH":
      return "CASH";
    case "MPESA_MANUAL":
    case "MPESA_STK":
      return "MOBILE_MONEY";
    case "CARD":
    case "PDQ":
    case "PAYSTACK":
      return "CARD";
    default:
      break;
  }
  // Anything not settled yet (tabs, credit sales) is credit, not cash.
  if (paymentStatus && paymentStatus !== "COMPLETED") return "CREDIT";
  return "BANK";
}
