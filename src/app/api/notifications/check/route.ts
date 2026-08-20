import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail, lowStockAlertEmail, planExpiryWarningEmail } from "@/lib/email";

export async function GET() {
  try {
    const tenants = await db.tenant.findMany({
      where: { isActive: true },
      include: {
        users: {
          where: { role: { in: ["OWNER", "ADMIN"] }, isActive: true },
          select: { name: true, email: true },
        },
      },
    });

    let alertsSent = 0;

    for (const tenant of tenants) {
      const owner = tenant.users[0];
      if (!owner) continue;

      // Low stock alerts
      const lowStockProducts = await db.product.findMany({
        where: {
          tenantId: tenant.id,
          isActive: true,
          trackStock: true,
          stocks: { some: {} },
        },
        include: { stocks: true },
      });

      const lowItems = lowStockProducts
        .filter(p => {
          const totalStock = p.stocks.reduce((sum, s) => sum + s.quantity, 0);
          return totalStock <= p.lowStockAlert;
        })
        .map(p => ({
          name: p.name,
          stock: p.stocks.reduce((sum, s) => sum + s.quantity, 0),
          threshold: p.lowStockAlert,
        }));

      if (lowItems.length > 0) {
        const emailContent = lowStockAlertEmail(owner.name, lowItems);
        await sendEmail({ to: owner.email, ...emailContent });
        alertsSent++;
      }

      // Trial expiry warning (3 days and 1 day before)
      if (tenant.trialEndsAt) {
        const daysLeft = Math.ceil((tenant.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysLeft === 3 || daysLeft === 1) {
          const emailContent = planExpiryWarningEmail(owner.name, tenant.name, daysLeft);
          await sendEmail({ to: owner.email, ...emailContent });
          alertsSent++;
        }
      }
    }

    return NextResponse.json({ success: true, alertsSent });
  } catch (error) {
    console.error("Notification check error:", error);
    return NextResponse.json({ error: "Failed to process notifications" }, { status: 500 });
  }
}
