import { initiateStkPush, getTransaction, normalizeKenyanPhone } from "@/lib/palpluss";
import type { PaymentGatewayAdapter, CollectionRequest, CollectionResult, StatusResult } from "./types";

export interface PalPlussCredentials {
  secretKey: string; // the tenant's OWN PalPluss key — distinct from PALPLUSS_SECRET_KEY (platform billing)
  channelId?: string; // optional — routes through a specific Paybill/Till if the tenant has one configured
}

export class PalPlussAdapter implements PaymentGatewayAdapter {
  constructor(private creds: PalPlussCredentials) {}

  async initiateCollection(req: CollectionRequest): Promise<CollectionResult> {
    const result = await initiateStkPush({
      phone: normalizeKenyanPhone(req.phone),
      amount: req.amount,
      accountReference: req.reference,
      transactionDesc: req.description.slice(0, 13), // see register/route.ts for why
      channelId: this.creds.channelId,
      callbackUrl: req.callbackUrl,
      apiKey: this.creds.secretKey,
    });
    return { providerTransactionId: result.data.transactionId };
  }

  async getStatus(providerTransactionId: string): Promise<StatusResult> {
    const result = await getTransaction(providerTransactionId, this.creds.secretKey);
    const status = result.data.status;

    if (status === "SUCCESS") {
      return { status: "SUCCESS", resultDesc: result.data.result_desc ?? undefined, receiptNumber: result.data.mpesa_receipt ?? undefined };
    }
    if (status === "PENDING") {
      return { status: "PENDING" };
    }
    // FAILED, CANCELLED, EXPIRED all collapse to FAILED for the adapter interface.
    return { status: "FAILED", resultDesc: result.data.result_desc ?? undefined };
  }
}