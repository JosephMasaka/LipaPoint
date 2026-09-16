const PALPLUSS_BASE_URL = "https://api.palpluss.com/v1";

function getSecretKey(): string {
  const key = process.env.PALPLUSS_SECRET_KEY;
  if (!key) {
    throw new Error("PALPLUSS_SECRET_KEY environment variable is not set");
  }
  return key;
}

// PalPluss docs list auth as "HTTP Basic (API key)" and the homepage sample
// sends the raw key as `Authorization: Basic <key>` (not base64 "user:pass").
// PALPLUSS_AUTH_TOKEN isn't referenced anywhere in the docs, SDKs, or site —
// left out here. Add it back in if support specifies a header/format for it.
function headers(): HeadersInit {
  return {
    Authorization: `Basic ${getSecretKey()}`,
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

  const payload = await response.json();

  if (!response.ok || payload.success === false) {
    const message = payload?.error?.message ?? response.statusText;
    const code = payload?.error?.code ?? "UNKNOWN_ERROR";
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
 * Amount is in KES, sent as-is (no cents conversion — PalPluss expects whole shillings).
 */
export async function initiateStkPush(params: {
  phone: string; // e.g. "254712345678"
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

export interface TransactionData {
  id: string;
  type: "STK" | "B2C";
  status: "PENDING" | "SUCCESS" | "FAILED";
  amount: number;
  currency: string;
  phone: string;
  reference: string | null;
  createdAt: string;
  completedAt: string | null;
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
  status?: "PENDING" | "SUCCESS" | "FAILED";
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

/**
 * Disburse funds directly to a customer's M-Pesa number.
 * Amount is in KES, sent as whole shillings.
 */
export async function initiateB2cPayout(params: {
  phone: string;
  amount: number;
  currency?: string; // defaults to KES
  reference?: string;
  description?: string;
  channelId?: string;
  credentialId?: string;
  callbackUrl?: string;
  idempotencyKey?: string; // recommended — retries are unsafe without this
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