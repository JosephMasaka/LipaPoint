import type { PaymentGatewayAdapter, CollectionRequest, CollectionResult, StatusResult } from "./types";

export interface DarajaCredentials {
  consumerKey: string;
  consumerSecret: string;
  shortCode: string;
  passkey: string;
  environment?: "sandbox" | "production"; // defaults to "sandbox"
}

function baseUrl(env: "sandbox" | "production"): string {
  return env === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

/**
 * Daraja requires a Kenyan MSISDN with country code, no leading zero and no
 * "+" — e.g. "254712345678". This is the opposite format from PalPluss's
 * confirmed local-format requirement — don't share a normalizer between them.
 */
function toDarajaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

async function getAccessToken(creds: DarajaCredentials): Promise<string> {
  const env = creds.environment ?? "sandbox";
  const auth = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString("base64");

  const res = await fetch(`${baseUrl(env)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daraja OAuth failed [HTTP_${res.status}]: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Daraja OAuth response missing access_token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

export class DarajaAdapter implements PaymentGatewayAdapter {
  constructor(private creds: DarajaCredentials) {}

  async initiateCollection(req: CollectionRequest): Promise<CollectionResult> {
    const env = this.creds.environment ?? "sandbox";
    const token = await getAccessToken(this.creds);
    const ts = timestamp();
    const password = Buffer.from(`${this.creds.shortCode}${this.creds.passkey}${ts}`).toString("base64");
    const phone = toDarajaPhone(req.phone);

    const body = {
      BusinessShortCode: this.creds.shortCode,
      Password: password,
      Timestamp: ts,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(req.amount),
      PartyA: phone,
      PartyB: this.creds.shortCode,
      PhoneNumber: phone,
      CallBackURL: req.callbackUrl,
      // Daraja's real-world limits: AccountReference ~12 chars, TransactionDesc ~13.
      AccountReference: req.reference.slice(0, 12),
      TransactionDesc: req.description.slice(0, 13),
    };

    const res = await fetch(`${baseUrl(env)}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.ResponseCode !== "0") {
      throw new Error(
        `Daraja STK Push failed [${data.ResponseCode ?? `HTTP_${res.status}`}]: ${data.ResponseDescription ?? data.errorMessage ?? "Unknown error"}`
      );
    }

    return { providerTransactionId: data.CheckoutRequestID };
  }

  async getStatus(providerTransactionId: string): Promise<StatusResult> {
    const env = this.creds.environment ?? "sandbox";
    const token = await getAccessToken(this.creds);
    const ts = timestamp();
    const password = Buffer.from(`${this.creds.shortCode}${this.creds.passkey}${ts}`).toString("base64");

    const res = await fetch(`${baseUrl(env)}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: this.creds.shortCode,
        Password: password,
        Timestamp: ts,
        CheckoutRequestID: providerTransactionId,
      }),
    });

    const data = await res.json().catch(() => ({}));

    // ResultCode 0 = success. 1032 = still pending/cancelled depending on
    // context; Daraja's query endpoint can also return an error envelope
    // (errorCode present) while the payment is still genuinely pending —
    // treat that as PENDING rather than FAILED so polling keeps trying
    // instead of giving up on a transient query failure.
    if (data.errorCode) {
      return { status: "PENDING" };
    }

    if (String(data.ResultCode) === "0") {
      return { status: "SUCCESS", resultDesc: data.ResultDesc };
    }

    if (data.ResultCode !== undefined) {
      return { status: "FAILED", resultDesc: data.ResultDesc };
    }

    return { status: "PENDING" };
  }
}