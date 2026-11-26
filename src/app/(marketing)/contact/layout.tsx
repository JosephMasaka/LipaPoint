import type { Metadata } from "next";
import { canonical, keywords } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact LipaPoint — Sales, Onboarding & Support in Kenya",
  description:
    "Talk to the LipaPoint team about POS, M-Pesa, inventory, accounting, payroll and KRA eTIMS for your business. Book onboarding, ask about pricing, or get support — we reply from Nairobi, Kenya.",
  keywords: keywords("pos", "payroll", "compliance", "industries", "counties"),
  alternates: { canonical: canonical("/contact") },
  openGraph: {
    title: "Contact LipaPoint ERP Kenya",
    description:
      "Sales, onboarding and support for LipaPoint ERP — POS, M-Pesa, inventory, accounting, payroll and KRA eTIMS.",
    url: canonical("/contact"),
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Contact LipaPoint ERP" }],
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
