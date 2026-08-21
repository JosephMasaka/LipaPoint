import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us — Get POS Support & Sales Inquiries",
  description:
    "Contact LipaPoint for POS system demos, pricing questions, technical support or partnership inquiries. Based in Nairobi, Kenya. Call, email or WhatsApp us.",
  alternates: { canonical: "https://lipapoint.co.ke/contact" },
  openGraph: {
    title: "Contact LipaPoint — POS System Support Kenya",
    description: "Reach our team for demos, support or sales. Nairobi-based, available 24/7.",
    url: "https://lipapoint.co.ke/contact",
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
