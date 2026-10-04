export interface CollectionRequest {
  phone: string;
  amount: number; // whole KES
  reference: string; // your own correlator — becomes accountReference/AccountReference
  description: string;
  callbackUrl: string;
}

export interface CollectionResult {
  providerTransactionId: string; // what you poll/query with later
}

export interface StatusResult {
  status: "PENDING" | "SUCCESS" | "FAILED";
  resultDesc?: string;
  receiptNumber?: string;
}

/**
 * Every gateway (Daraja, PalPluss, and eventually IntaSend/Pesapal/etc.)
 * implements this. initiateCollection covers mobile-money push payments.
 * getStatus is optional — implement it if the provider supports querying a
 * transaction directly (both Daraja and PalPluss do); if omitted, that
 * gateway can only be resolved via its webhook, with no poll-fallback.
 */
export interface PaymentGatewayAdapter {
  initiateCollection(req: CollectionRequest): Promise<CollectionResult>;
  getStatus?(providerTransactionId: string): Promise<StatusResult>;
}