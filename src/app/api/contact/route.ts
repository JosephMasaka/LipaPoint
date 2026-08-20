import { NextRequest, NextResponse } from "next/server";
import { sendEmail, contactFormEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { name, email, phone, subject, message } = await request.json();

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: "Name, email, subject, and message are required" }, { status: 400 });
    }

    const emailContent = contactFormEmail(name, email, phone || "", subject, message);
    await sendEmail({
      to: "lipapoint@tunzaassets.co.ke",
      subject: emailContent.subject,
      html: emailContent.html,
      replyTo: email,
    });

    await sendEmail({
      to: email,
      subject: "We received your message - LipaPoint",
      html: `
        <h2>Thanks for reaching out, ${name}!</h2>
        <p>We've received your message and will get back to you within 24 hours.</p>
        <p><strong>Your message:</strong></p>
        <blockquote style="border-left:3px solid #d4a843;padding-left:12px;color:#666;">${message}</blockquote>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
