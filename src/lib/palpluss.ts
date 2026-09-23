const PALPLUSS_BASE_URL = "https://api.palpluss.com/v1";

function getSecretKey(): string {
  const key = process.env.PALPLUSS_SECRET_KEY;
  if (!key) {
    throw new Error("PALPLUSS_SECRET_KEY environment variable is not set");
  }
  return key;
}

// Standard HTTP Basic Auth is base64("key:") — a raw key with a literal
// "Basic " prefix (no encoding) is NOT valid Basic auth and would produce a
// 401 from any spec-compliant server. This was the previous bug here.
function headers(): HeadersInit {
  const encoded = Buffer.from(`${getSecretKey()}:`).toString("base64");
  return {
    Authorization: `Basic ${encoded}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<PalPlussResponse<T>> {
  const response = await fetch(`${PALPLUSS_BASE_URL}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers ?? {}) },
  });

  // A 401/403/5xx might not come back as JSON at all — don't let a failed
  // .json() call mask the real status/error.
  let payload: any;
  const rawText = await response.text();
  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(
      `PalPluss request failed [HTTP_${response.status}] Non-JSON response: ${rawText.slice(0, 300)}`
    );
  }

  if (!response.ok || payload.success === false) {
    const message = payload?.error?.message ?? response.statusText;
    const code = payload?.error?.code ?? `HTTP_${response.status}`;
    const requestId = payload?.requestId ?? "unknown";
    throw new Error(
      `PalPluss request failed [${code}] ${message} (requestId: ${requestId})`
    );
  }

  return payload;
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return "";
  const search = new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)])
  );
  return `?${search.toString()}`;
}

/**
 * PalPluss's docs show request bodies using local Kenyan format
 * ("0712345678"), while the webhook payload's phone_number comes back in
 * international format ("254712345678"). Normalize whatever the user typed
 * (+254..., 254..., 0...) to the local format the request examples use,
 * since that's the only confirmed-accepted input shape.
 */
export function normalizeKenyanPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) {
    return `0${digits.slice(3)}`;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return digits;
  }
  if (digits.length === 9) {
    // e.g. "712345678" with no leading 0/254
    return `0${digits}`;
  }
  return digits; // best effort — let PalPluss validate/reject if still malformed
}

// --- Envelope types ---

export interface PalPlussResponse<T = unknown> {
  success: boolean;
  requestId: string;
  data: T;
}

export interface PalPlussErrorPayload {
  success: false;
  error: {
    message: string;
    code: string;
    details: Record<string, unknown>;
  };
  requestId: string;
}

// --- STK Push ---

export interface StkPushData {
  transactionId: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
}

/**
 * Trigger an M-Pesa STK Push prompt to a customer's phone.
 * Amount is in KES, sent as-is (no cents conversion).
 */
export async function initiateStkPush(params: {
  phone: string; // local format, e.g. "0712345678" — see normalizeKenyanPhone
  amount: number; // whole KES
  accountReference?: string;
  transactionDesc?: string;
  channelId?: string;
  callbackUrl?: string;
  credentialId?: string;
}): Promise<PalPlussResponse<StkPushData>> {
  const body: Record<string, unknown> = {
    phone: params.phone,
    amount: params.amount,
  };

  if (params.accountReference) body.accountReference = params.accountReference;
  if (params.transactionDesc) body.transactionDesc = params.transactionDesc;
  if (params.channelId) body.channelId = params.channelId;
  if (params.callbackUrl) body.callbackUrl = params.callbackUrl;
  if (params.credentialId) body.credentialId = params.credentialId;

  return request<StkPushData>("/payments/stk", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// --- Transactions ---

// NOTE: this shape is confirmed for the *webhook* payload (from PalPluss's
// actual docs). The GET /transactions/{id} response shape itself hasn't
// been separately confirmed — assumed to mirror the webhook's transaction
// object since that's the only verified reference we have. Worth spot-
// checking against the real API reference page for this endpoint.
export interface TransactionData {
  id: string;
  tenant_id: string;
  type: "STK" | "B2C";
  status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED";
  amount: number;
  currency: string;
  phone_number: string;
  external_reference: string | null;
  provider: string;
  provider_request_id: string;
  provider_checkout_id: string;
  mpesa_receipt: string | null;
  result_code: string | null;
  result_desc: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionListData {
  items: TransactionData[];
  nextCursor: string | null;
}

export async function getTransaction(
  transactionId: string
): Promise<PalPlussResponse<TransactionData>> {
  return request<TransactionData>(
    `/transactions/${encodeURIComponent(transactionId)}`
  );
}

export async function listTransactions(params?: {
  limit?: number;
  status?: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED";
  type?: "STK" | "B2C";
  cursor?: string;
}): Promise<PalPlussResponse<TransactionListData>> {
  const query = qs({
    limit: params?.limit,
    status: params?.status,
    type: params?.type,
    cursor: params?.cursor,
  });
  return request<TransactionListData>(`/transactions${query}`);
}

// --- B2C Payouts ---

export interface B2cPayoutData {
  transactionId: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
}

export async function initiateB2cPayout(params: {
  phone: string;
  amount: number;
  currency?: string;
  reference?: string;
  description?: string;
  channelId?: string;
  credentialId?: string;
  callbackUrl?: string;
  idempotencyKey?: string;
}): Promise<PalPlussResponse<B2cPayoutData>> {
  const body: Record<string, unknown> = {
    phone: params.phone,
    amount: params.amount,
    currency: params.currency ?? "KES",
  };

  if (params.reference) body.reference = params.reference;
  if (params.description) body.description = params.description;
  if (params.channelId) body.channelId = params.channelId;
  if (params.credentialId) body.credentialId = params.credentialId;
  if (params.callbackUrl) body.callbackUrl = params.callbackUrl;

  return request<B2cPayoutData>("/payouts/b2c", {
    method: "POST",
    headers: params.idempotencyKey
      ? { "Idempotency-Key": params.idempotencyKey }
      : undefined,
    body: JSON.stringify(body),
  });
}

// --- Service Wallet ---

export interface ServiceWalletBalanceData {
  availableBalance: number;
  currency: string;
}

export interface ServiceWalletTopupData {
  transactionId: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
}

export async function getServiceWalletBalance(): Promise<
  PalPlussResponse<ServiceWalletBalanceData>
> {
  return request<ServiceWalletBalanceData>("/wallet/balance");
}

export async function topUpServiceWallet(params: {
  phone: string;
  amount: number;
  idempotencyKey?: string;
}): Promise<PalPlussResponse<ServiceWalletTopupData>> {
  const body: Record<string, unknown> = {
    phone: params.phone,
    amount: params.amount,
  };

  return request<ServiceWalletTopupData>("/wallet/topup", {
    method: "POST",
    headers: params.idempotencyKey
      ? { "Idempotency-Key": params.idempotencyKey }
      : undefined,
    body: JSON.stringify(body),
  });
}

// --- Payment Channels ---

export interface PaymentChannelData {
  id: string;
  type: "PAYBILL" | "TILL";
  shortcode: string;
  name: string;
}

export async function createPaymentChannel(params: {
  type: "PAYBILL" | "TILL";
  shortcode: string;
  name: string;
}): Promise<PalPlussResponse<PaymentChannelData>> {
  return request<PaymentChannelData>("/channels", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function updatePaymentChannel(
  channelId: string,
  params: { name?: string; shortcode?: string }
): Promise<PalPlussResponse<PaymentChannelData>> {
  return request<PaymentChannelData>(
    `/channels/${encodeURIComponent(channelId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(params),
    }
  );
}

export async function deletePaymentChannel(
  channelId: string
): Promise<PalPlussResponse<null>> {
  return request<null>(`/channels/${encodeURIComponent(channelId)}`, {
    method: "DELETE",
  });
}