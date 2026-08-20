import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.mailbux.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "lipapoint@tunzaassets.co.ke",
    pass: process.env.SMTP_PASS || "",
  },
});

const FROM = process.env.SMTP_FROM || "LipaPoint <lipapoint@tunzaassets.co.ke>";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, replyTo }: EmailOptions) {
  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html: wrapTemplate(html),
      replyTo,
    });
    return { success: true };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error };
  }
}

function wrapTemplate(body: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .header { background: #0a0a0f; padding: 24px; text-align: center; }
    .header h1 { color: #d4a843; margin: 0; font-size: 20px; font-weight: 700; }
    .body { padding: 32px 24px; color: #333; line-height: 1.6; }
    .body h2 { color: #0a0a0f; margin-top: 0; }
    .btn { display: inline-block; background: #d4a843; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }
    .footer { background: #f9f9f9; padding: 16px 24px; text-align: center; color: #888; font-size: 12px; border-top: 1px solid #eee; }
    .info-row { background: #f5f5f5; padding: 12px 16px; border-radius: 8px; margin: 8px 0; }
    .info-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-value { font-size: 16px; font-weight: 600; color: #0a0a0f; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>LipaPoint</h1></div>
    <div class="body">${body}</div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} LipaPoint POS &middot; Built for Kenyan businesses</p>
      <p>lipapoint@tunzaassets.co.ke</p>
    </div>
  </div>
</body>
</html>`;
}

// --- Email Templates ---

export function welcomeEmail(name: string, businessName: string, tier: string, slug: string) {
  return {
    subject: `Welcome to LipaPoint - Your ${tier.toLowerCase()} account is ready!`,
    html: `
      <h2>Welcome aboard, ${name}!</h2>
      <p>Your business <strong>${businessName}</strong> is now set up on LipaPoint with the <strong>${tier}</strong> plan.</p>
      <p>Here's what you can do next:</p>
      <ul>
        <li>Add your products and set prices</li>
        <li>Configure your M-Pesa paybill/till number</li>
        <li>Invite your team members</li>
        <li>Start processing sales</li>
      </ul>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/${slug}/dashboard" class="btn">Go to Dashboard</a>
      <p style="color:#666;font-size:13px;">Your 14-day free trial has started. No charges until it ends.</p>
    `,
  };
}

export function passwordResetEmail(name: string, resetUrl: string) {
  return {
    subject: "Reset your LipaPoint password",
    html: `
      <h2>Password Reset</h2>
      <p>Hi ${name},</p>
      <p>We received a request to reset your password. Click the button below to create a new one:</p>
      <a href="${resetUrl}" class="btn">Reset Password</a>
      <p style="color:#666;font-size:13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `,
  };
}

export function planUpgradeEmail(name: string, businessName: string, tier: string) {
  return {
    subject: `Plan upgraded to ${tier}`,
    html: `
      <h2>Plan Upgrade Confirmed</h2>
      <p>Hi ${name},</p>
      <p><strong>${businessName}</strong> has been upgraded to the <strong>${tier}</strong> plan.</p>
      <p>Your new features are active immediately. Thank you for growing with LipaPoint!</p>
    `,
  };
}

export function planExpiryWarningEmail(name: string, businessName: string, daysLeft: number) {
  return {
    subject: `Your LipaPoint trial ends in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`,
    html: `
      <h2>Trial Ending Soon</h2>
      <p>Hi ${name},</p>
      <p>Your free trial for <strong>${businessName}</strong> ends in <strong>${daysLeft} day${daysLeft > 1 ? "s" : ""}</strong>.</p>
      <p>To continue using LipaPoint without interruption, please upgrade your subscription.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/settings?tab=billing" class="btn">Upgrade Now</a>
    `,
  };
}

export function receiptEmail(customerName: string, orderNo: string, receiptHtml: string) {
  return {
    subject: `Receipt for order ${orderNo} - LipaPoint`,
    html: `
      <h2>Your Receipt</h2>
      <p>Hi${customerName ? ` ${customerName}` : ""},</p>
      <p>Here's your receipt for order <strong>${orderNo}</strong>:</p>
      <div style="border:1px solid #eee;border-radius:8px;padding:20px;font-family:monospace;font-size:12px;background:#fafafa;">
        ${receiptHtml}
      </div>
      <p style="color:#666;font-size:13px;margin-top:16px;">Thank you for your purchase!</p>
    `,
  };
}

export function contactFormEmail(name: string, email: string, phone: string, subject: string, message: string) {
  return {
    subject: `[Contact Form] ${subject}`,
    html: `
      <h2>New Contact Form Submission</h2>
      <div class="info-row"><span class="info-label">Name</span><br><span class="info-value">${name}</span></div>
      <div class="info-row"><span class="info-label">Email</span><br><span class="info-value">${email}</span></div>
      <div class="info-row"><span class="info-label">Phone</span><br><span class="info-value">${phone || "Not provided"}</span></div>
      <div class="info-row"><span class="info-label">Subject</span><br><span class="info-value">${subject}</span></div>
      <div style="margin-top:16px;"><strong>Message:</strong><p>${message}</p></div>
    `,
  };
}

export function lowStockAlertEmail(name: string, products: { name: string; stock: number; threshold: number }[]) {
  const rows = products.map(p => `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${p.name}</td><td style="padding:8px;border-bottom:1px solid #eee;color:#dc2626;font-weight:600;">${p.stock}</td><td style="padding:8px;border-bottom:1px solid #eee;">${p.threshold}</td></tr>`).join("");
  return {
    subject: `Low Stock Alert - ${products.length} product${products.length > 1 ? "s" : ""} need restock`,
    html: `
      <h2>Low Stock Alert</h2>
      <p>Hi ${name}, the following products are running low:</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#f5f5f5;"><th style="padding:8px;text-align:left;">Product</th><th style="padding:8px;text-align:left;">Current Stock</th><th style="padding:8px;text-align:left;">Threshold</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:16px;">Please restock these items to avoid disruptions.</p>
    `,
  };
}

export function paymentFailedEmail(name: string, businessName: string) {
  return {
    subject: "Payment failed - Action needed",
    html: `
      <h2>Payment Failed</h2>
      <p>Hi ${name},</p>
      <p>We were unable to process the subscription payment for <strong>${businessName}</strong>.</p>
      <p>Please update your payment method to avoid service interruption.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/settings?tab=billing" class="btn">Update Payment</a>
    `,
  };
}
