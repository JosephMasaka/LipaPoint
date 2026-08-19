import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-paystack-signature");
    const secret = process.env.PAYSTACK_SECRET_KEY;

    if (!secret || !signature) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hash = crypto.createHmac("sha512", secret).update(body).digest("hex");
    if (hash !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body);

    switch (event.event) {
      case "charge.success": {
        const { reference, amount, metadata } = event.data;
        const tenantId = metadata?.tenantId;
        const tier = metadata?.tier;

        if (tenantId) {
          await db.transaction.create({
            data: {
              type: "SUBSCRIPTION_PAYMENT",
              amount: amount / 100,
              method: "PAYSTACK",
              status: "COMPLETED",
              reference,
              gatewayRef: reference,
              tenantId,
              description: `Subscription payment - ${tier || "plan"}`,
            },
          });

          const updateData: Record<string, unknown> = {
            isActive: true,
            paystackSubCode: reference,
          };
          if (tier && ["STARTER", "PROFESSIONAL", "ENTERPRISE"].includes(tier)) {
            updateData.tier = tier;
          }

          await db.tenant.update({
            where: { id: tenantId },
            data: updateData,
          });
        }
        break;
      }

      case "subscription.create": {
        const { subscription_code, customer, plan } = event.data;
        const tenantId = event.data.metadata?.tenantId;

        if (tenantId) {
          await db.subscription.create({
            data: {
              tenantId,
              tier: "PROFESSIONAL",
              paystackSubCode: subscription_code,
              paystackCustCode: customer.customer_code,
              paystackPlanCode: plan.plan_code,
              amount: plan.amount / 100,
              status: "active",
            },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const tenantId = event.data.metadata?.tenantId;
        if (tenantId) {
          await db.activityLog.create({
            data: {
              action: "PAYMENT_FAILED",
              entity: "subscription",
              tenantId,
              details: "Subscription payment failed",
            },
          });
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
