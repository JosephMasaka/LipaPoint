import type { Metadata } from "next";
import { canonical, keywords } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Request a Free ERP Demo — POS, Stock, Payroll & eTIMS",
  description:
    "Book a free walkthrough of LipaPoint ERP for your shop, restaurant, bar, pharmacy, salon, school or firm. See POS, M-Pesa, stock control, accounting, statutory payroll and KRA eTIMS working on your own products.",
  keywords: keywords("brand", "pos", "inventory", "finance", "payroll", "compliance", "industries"),
  alternates: { canonical: canonical("/demo-request") },
  openGraph: {
    title: "Request a Free LipaPoint ERP Demo",
    description:
      "A free, no-obligation walkthrough of POS, M-Pesa, stock, accounting, payroll and KRA eTIMS for your business.",
    url: canonical("/demo-request"),
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Request a LipaPoint demo" }],
  },
};

export default function DemoRequestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
