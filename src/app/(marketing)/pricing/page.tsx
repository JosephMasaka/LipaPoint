import type { Metadata } from "next";
import { PricingClient } from "./pricing-client";

export const metadata: Metadata = {
  title: "Pricing — POS Plans from KSh 1,999/month",
  description:
    "LipaPoint POS pricing for retail, restaurants & barbershops. Plans from KSh 1,999/mo; Enterprise adds accounting, KRA eTIMS invoicing, payroll & asset management. No setup fees. Cancel anytime.",
  alternates: { canonical: "https://lipapoint.co.ke/pricing" },
  openGraph: {
    title: "LipaPoint Pricing — POS Plans for Every Business Type",
    description: "Industry-specific POS plans from KSh 1,999/month. Retail, restaurants, barbershops. No setup fees. 14-day free trial.",
    url: "https://lipapoint.co.ke/pricing",
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
