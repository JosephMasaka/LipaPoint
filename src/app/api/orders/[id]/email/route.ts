import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sendEmail, receiptEmail } from "@/lib/email";
import { formatCurrency } from "@/lib/utils";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let email: string | undefined;
    try {
      const body = await request.json();
      email = body.email;
    } catch { /* empty body is ok - we'll look up customer email */ }

    const { id } = await params;
    if (!email) {
      return NextResponse.json({ error: "No email address on file for this customer. Please provide one." }, { status: 400 });
    }

    const order = await db.order.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        items: { include: { product: { select: { name: true } } } },
        user: { select: { name: true } },
      },
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const tenant = await db.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true, mpesaPaybill: true, mpesaTill: true, receiptFooter: true, taxRate: true },
    });

    const itemRows = order.items.map(i =>
      `<div style="display:flex;justify-content:space-between;margin:2px 0;"><span>${i.product.name} x${i.quantity}</span><span>${formatCurrency(i.total)}</span></div>`
    ).join("");

    const mpesaInfo = [
      tenant?.mpesaPaybill ? `Paybill: ${tenant.mpesaPaybill}` : "",
      tenant?.mpesaTill ? `Till No: ${tenant.mpesaTill}` : "",
    ].filter(Boolean).join(" | ");

    const receiptHtml = `
      <div style="text-align:center;font-weight:bold;margin-bottom:8px;">${tenant?.name || ""}</div>
      <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>
      <div style="display:flex;justify-content:space-between;"><span>Order:</span><span>${order.orderNo}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Date:</span><span>${new Date(order.createdAt).toLocaleDateString("en-KE")}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Served by:</span><span>${order.user.name}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Payment:</span><span>${order.paymentMethod.replace("_", " ")}</span></div>
      <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>
      ${itemRows}
      <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>
      <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>${formatCurrency(order.subtotal)}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Tax</span><span>${formatCurrency(order.taxAmount)}</span></div>
      ${order.discount > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Discount</span><span>-${formatCurrency(order.discount)}</span></div>` : ""}
      <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;"><span>TOTAL</span><span>${formatCurrency(order.total)}</span></div>
      ${mpesaInfo ? `<div style="border-top:1px dashed #ccc;margin:8px 0;"></div><div style="text-align:center;font-size:11px;color:#666;">${mpesaInfo}</div>` : ""}
      <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>
      <div style="text-align:center;font-style:italic;color:#666;">${tenant?.receiptFooter || "Thank you!"}</div>
      <div style="text-align:center;font-size:9px;color:#999;margin-top:8px;">Powered by LipaPoint POS | Dev: Joseph Masaka | 0791298382</div>
    `;

    const emailContent = receiptEmail(order.customerName || "", order.orderNo, receiptHtml);
    const result = await sendEmail({ to: email, ...emailContent });

    if (result.success) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  } catch (error) {
    console.error("Email receipt error:", error);
    return NextResponse.json({ error: "Failed to send receipt" }, { status: 500 });
  }
}
