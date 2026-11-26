import type { Metadata } from "next";
import { ogImage } from "@/lib/og";
import { keywords } from "@/lib/seo";
import { breadcrumbJsonLd, canonical, jsonLdGraph, serializeJsonLd } from "@/lib/seo";
import { PRICING_FAQ } from "@/lib/pricing-faq";
import { PricingClient } from "./pricing-client";

export const metadata: Metadata = {
  keywords: keywords("pos", "finance", "payroll", "compliance", "industries"),
  title: "Pricing — ERP Plans from KSh 999/month",
  description:
    "LipaPoint ERP pricing for retail, restaurants & barbershops. Plans from KSh 999/mo; Enterprise adds accounting, KRA eTIMS invoicing, payroll & asset management — and every app, or individual features inside one, can be bought separately. The AI Business Assistant is included on Professional and Enterprise. No setup fees. Cancel anytime.",
  alternates: { canonical: "https://lipapoint.co.ke/pricing" },
  openGraph: {
    title: "LipaPoint ERP Pricing — Plans for Every Business Type",
    description: "Industry-specific ERP plans from KSh 999/month. POS, accounting, payroll and eTIMS. Retail, restaurants, barbershops. No setup fees. Cancel anytime.",
    url: "https://lipapoint.co.ke/pricing",
    images: ogImage("pricing", "LipaPoint ERP plans and pricing"),
  },
};

// FAQPage markup mirrors the visible FAQ rendered by PricingClient — both read
// src/lib/pricing-faq.ts, so a question can never be marked up without being
// on the page (which is what gets rich results dropped).
const jsonLd = serializeJsonLd(
  jsonLdGraph(
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Pricing", path: "/pricing" },
    ]),
    {
      "@type": "FAQPage",
      "@id": `${canonical("/pricing")}#faq`,
      url: canonical("/pricing"),
      mainEntity: PRICING_FAQ.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    }
  )
);

export default function PricingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <PricingClient />
    </>
  );
}
