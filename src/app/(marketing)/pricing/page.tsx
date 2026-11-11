import type { Metadata } from "next";
import { ogImage } from "@/lib/og";
import { PricingClient } from "./pricing-client";

export const metadata: Metadata = {
  title: "Pricing — ERP Plans from KSh 999/month",
  description:
    "LipaPoint ERP pricing for retail, restaurants & barbershops. Plans from KSh 999/mo; Enterprise adds accounting, KRA eTIMS invoicing, payroll & asset management — and every app, or individual features inside one, can be bought separately. No setup fees. Cancel anytime.",
  alternates: { canonical: "https://lipapoint.co.ke/pricing" },
  openGraph: {
    title: "LipaPoint ERP Pricing — Plans for Every Business Type",
    description: "Industry-specific ERP plans from KSh 999/month. POS, accounting, payroll and eTIMS. Retail, restaurants, barbershops. No setup fees. Cancel anytime.",
    url: "https://lipapoint.co.ke/pricing",
    images: ogImage("pricing", "LipaPoint ERP plans and pricing"),
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
