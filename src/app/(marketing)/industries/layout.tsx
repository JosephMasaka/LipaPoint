import type { Metadata } from "next";
import { breadcrumbJsonLd, canonical, keywords, jsonLdGraph, serializeJsonLd } from "@/lib/seo";

const titleDefault = "ERP by Industry — Retail, Restaurants, Pharmacy, Payroll & More";
const description =
  "LipaPoint ERP configured for your industry: retail and supermarkets, restaurants, bars and lodges, pharmacies, barbershops and salons, wholesale, warehousing, schools, professional services, HR and payroll, finance and asset management. POS, M-Pesa, stock, accounting and KRA eTIMS included.";

export const metadata: Metadata = {
  // The default covers the index page; the template brands every industry
  // page that sets its own title.
  title: {
    default: titleDefault,
    template: "%s | LipaPoint ERP Kenya",
  },
  description,
  keywords: keywords("industries", "pos", "inventory", "finance", "payroll", "compliance"),
  alternates: { canonical: canonical("/industries") },
  openGraph: {
    title: "LipaPoint ERP by Industry",
    description:
      "Industry-specific ERP setups for Kenyan businesses — retail, hospitality, pharmacy, wholesale, logistics, education, professional services, HR and finance.",
    url: canonical("/industries"),
    images: [{ url: "/images/og/industries.png", width: 1200, height: 630, alt: "LipaPoint ERP industries" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LipaPoint ERP by Industry",
    description: "ERP setups for retail, hospitality, pharmacy, wholesale, logistics, education and finance.",
    images: ["/images/og/industries.png"],
  },
};

const jsonLd = serializeJsonLd(
  jsonLdGraph(
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Industries", path: "/industries" },
    ]),
    {
      "@type": "CollectionPage",
      name: titleDefault,
      description,
      url: canonical("/industries"),
      isPartOf: { "@id": `${canonical("/")}/#website` },
    }
  )
);

export default function IndustriesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      {children}
    </>
  );
}
