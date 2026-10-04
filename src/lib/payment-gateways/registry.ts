import { db } from "@/lib/db";
import { decryptJSON } from "@/lib/crypto";
import { DarajaAdapter, type DarajaCredentials } from "./daraja";
import { PalPlussAdapter, type PalPlussCredentials } from "./palpluss-adapter";
import type { PaymentGatewayAdapter } from "./types";

// Providers not implemented yet — see the note at the top of this
// conversation's delivery: no confirmed API docs for these were available,
// so nothing has been fabricated. Throwing here rather than silently
// pretending to support them.
const UNIMPLEMENTED = new Set(["INTASEND", "PESAPAL", "KOPOKOPO", "FLUTTERWAVE"]);

export async function getTenantGatewayAdapter(
  tenantId: string,
  provider: string
): Promise<PaymentGatewayAdapter> {
  if (UNIMPLEMENTED.has(provider)) {
    throw new Error(
      `${provider} isn't implemented yet — this adapter needs to be built against ${provider}'s real API documentation before it can process real payments.`
    );
  }

  const gateway = await db.tenantPaymentGateway.findUnique({
    where: { tenantId_provider: { tenantId, provider: provider as never } },
  });

  if (!gateway || !gateway.isActive) {
    throw new Error(`${provider} is not connected for this business.`);
  }
  if (!gateway.credentialsEnc) {
    throw new Error(`${provider} is connected but has no credentials stored.`);
  }

  switch (provider) {
    case "DARAJA": {
      const creds = decryptJSON<DarajaCredentials>(gateway.credentialsEnc);
      return new DarajaAdapter(creds);
    }
    case "PALPLUSS": {
      const creds = decryptJSON<PalPlussCredentials>(gateway.credentialsEnc);
      return new PalPlussAdapter(creds);
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}