import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { completeOrderPayment } from "@/lib/payment-gateways/order-completion";

// Safaricom's actual STK callback shape — nested under Body.stkCallback,
// with metadata as a flat array of {Name, Value} pairs. ResultCode 0 =
// success; anything else = failure. Standard, stable, publicly documented.
interface DarajaCallbackItem {
  Name: string;
  Value?: string | number;
}

interface DarajaStkCallback {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: { Item: DarajaCallbackItem[] };
}

interface DarajaWebhookBody {
  Body: { stkCallback: DarajaStkCallback };
}

function metadataValue(items: DarajaCallbackItem[] | undefined, name: string): string | undefined {
  const item = items?.find((i) => i.Name === name);
  return item?.Value !== undefined ? String(item.Value) : undefined;
}

export async function POST(request: NextRequest) {
  let payload: DarajaWebhookBody;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid JSON" }, { status: 400 });
  }

  const callback = payload?.Body?.stkCallback;
  if (!callback?.CheckoutRequestID) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Malformed payload" }, { status: 400 });
  }

  // Daraja doesn't carry a custom reference field the way PalPluss does —
  // CheckoutRequestID (stored as Transaction.gatewayRef at initiation) is
  // the only correlator available.
  const record = await db.transaction.findFirst({
    where: { gatewayRef: callback.CheckoutRequestID },
  });

  // Daraja requires this exact envelope back regardless of outcome.
  const ACK = { ResultCode: 0, ResultDesc: "Accepted" };

  if (!record) {
    console.error("Daraja webhook: no transaction for CheckoutRequestID", callback.CheckoutRequestID);
    return NextResponse.json(ACK);
  }

  if (record.status !== "PENDING" || !record.orderId) {
    return NextResponse.json(ACK); // already handled, or not a POS sale
  }

  const receiptNumber = metadataValue(callback.CallbackMetadata?.Item, "MpesaReceiptNumber");

  await completeOrderPayment(record.id, {
    status: callback.ResultCode === 0 ? "SUCCESS" : "FAILED",
    receiptNumber,
    resultDesc: callback.ResultDesc,
  });

  return NextResponse.json(ACK);
}