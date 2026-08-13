const PAYSTACK_BASE_URL = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY environment variable is not set");
  }
  return key;
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${getSecretKey()}`,
    "Content-Type": "application/json",
  };
}

// --- Types ---

export interface PaystackResponse<T = unknown> {
  status: boolean;
  message: string;
  data: T;
}

export interface InitializeTransactionData {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface VerifyTransactionData {
  id: number;
  status: "success" | "failed" | "abandoned";
  reference: string;
  amount: number;
  currency: string;
  paid_at: string | null;
  channel: string;
  customer: {
    id: number;
    email: string;
    customer_code: string;
  };
  metadata: Record<string, unknown> | null;
}

export interface CreatePlanData {
  id: number;
  name: string;
  plan_code: string;
  amount: number;
  interval: string;
  currency: string;
}

export interface ChargeCustomerData {
  reference: string;
  status: string;
  display_text: string;
}

// --- API functions ---

/**
 * Initialize a Paystack transaction.
 * Amount is in KES (will be converted to kobo/cents internally by Paystack for KES).
 * Note: Paystack expects amount in the smallest currency unit (cents for KES).
 */
export async function initializeTransaction(params: {
  email: string;
  amount: number; // Amount in KES (will be multiplied by 100 for Paystack)
  reference?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackResponse<InitializeTransactionData>> {
  const body: Record<string, unknown> = {
    email: params.email,
    amount: Math.round(params.amount * 100), // Convert to cents
    currency: "KES",
  };

  if (params.reference) body.reference = params.reference;
  if (params.callbackUrl) body.callback_url = params.callbackUrl;
  if (params.metadata) body.metadata = params.metadata;

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Paystack initialize transaction failed: ${error}`);
  }

  return response.json();
}

/**
 * Verify a Paystack transaction by reference.
 */
export async function verifyTransaction(
  reference: string
): Promise<PaystackResponse<VerifyTransactionData>> {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: headers(),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Paystack verify transaction failed: ${error}`);
  }

  return response.json();
}

/**
 * Create a subscription plan on Paystack.
 * Amount is in KES.
 */
export async function createSubscriptionPlan(params: {
  name: string;
  amount: number; // Amount in KES (will be multiplied by 100 for Paystack)
  interval: "hourly" | "daily" | "weekly" | "monthly" | "quarterly" | "biannually" | "annually";
  description?: string;
}): Promise<PaystackResponse<CreatePlanData>> {
  const body: Record<string, unknown> = {
    name: params.name,
    amount: Math.round(params.amount * 100), // Convert to cents
    interval: params.interval,
    currency: "KES",
  };

  if (params.description) body.description = params.description;

  const response = await fetch(`${PAYSTACK_BASE_URL}/plan`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Paystack create plan failed: ${error}`);
  }

  return response.json();
}

/**
 * Charge a customer using their authorization code.
 * This is used for recurring payments.
 * Amount is in KES.
 */
export async function chargeCustomer(params: {
  email: string;
  amount: number; // Amount in KES (will be multiplied by 100 for Paystack)
  authorizationCode: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackResponse<ChargeCustomerData>> {
  const body: Record<string, unknown> = {
    email: params.email,
    amount: Math.round(params.amount * 100), // Convert to cents
    authorization_code: params.authorizationCode,
    currency: "KES",
  };

  if (params.reference) body.reference = params.reference;
  if (params.metadata) body.metadata = params.metadata;

  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/charge_authorization`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Paystack charge customer failed: ${error}`);
  }

  return response.json();
}
