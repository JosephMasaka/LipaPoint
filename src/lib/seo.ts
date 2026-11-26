import { KENYA_COUNTIES } from "@/lib/kenya-counties";

/**
 * Shared SEO primitives for the public marketing site.
 *
 * Everything here is pure data + string building so it can be imported by
 * server pages and client components alike (the marketing layout is a client
 * component and still needs to emit structured data).
 */
export const SITE_URL = "https://lipapoint.co.ke";
export const SITE_NAME = "LipaPoint ERP";

/** Keyword clusters built from the modules the product actually ships, so a
 *  page only claims what its own copy can back up. */
export const KEYWORDS = {
  brand: ["LipaPoint", "LipaPoint ERP", "LipaPoint Kenya", "LipaPoint POS"],
  pos: [
    "POS system Kenya",
    "point of sale Kenya",
    "POS software Kenya",
    "cloud POS Kenya",
    "till system Kenya",
    "EPOS Kenya",
    "restaurant POS Kenya",
    "retail POS system",
    "bar POS system",
    "supermarket POS",
    "pharmacy POS Kenya",
    "M-Pesa POS",
    "M-Pesa STK Push",
    "barcode scanner POS",
    "offline POS Kenya",
    "best POS system Nairobi",
    "affordable POS Kenya",
  ],
  inventory: [
    "inventory management Kenya",
    "stock control software Kenya",
    "stock valuation",
    "expiry tracking",
    "stock take",
    "multi-location stock transfers",
    "reorder suggestions",
    "low stock alerts",
    "purchase orders Kenya",
    "supplier management",
  ],
  finance: [
    "accounting software Kenya",
    "general ledger",
    "trial balance",
    "bank reconciliation Kenya",
    "cash flow report",
    "profit and loss Kenya",
    "VAT reconciliation Kenya",
    "fixed asset register",
    "asset depreciation Kenya",
    "credit and debit notes",
  ],
  payroll: [
    "payroll software Kenya",
    "statutory payroll Kenya",
    "PAYE Kenya",
    "NSSF",
    "SHIF",
    "Housing Levy",
    "payslip generator Kenya",
    "HR software Kenya",
    "leave management Kenya",
    "staff scheduling",
    "time and attendance",
  ],
  compliance: [
    "KRA eTIMS",
    "eTIMS invoicing",
    "eTIMS compliant POS",
    "KRA compliant POS",
    "tax compliance software Kenya",
    "OSCU",
    "VSCU",
    "fiscal receipt Kenya",
  ],
  crm: [
    "customer management Kenya",
    "CRM for shops",
    "loyalty program Kenya",
    "discounts and coupons",
    "appointments and bookings",
    "queue management",
    "online ordering Kenya",
    "delivery management",
  ],
  ai: [
    "AI business assistant Kenya",
    "AI inventory forecasting",
    "business intelligence Kenya",
    "sales analytics Kenya",
    "demand forecasting",
    "MFumo wa biashara",
  ],
  integrations: [
    "LipaPoint Connect",
    "business app integrations Kenya",
    "eTIMS integration",
    "M-Pesa integration",
    "payments integration Kenya",
    "API integrations for SMEs",
  ],
  industries: [
    "ERP for retail Kenya",
    "ERP for restaurants Kenya",
    "ERP for bars Kenya",
    "salon POS Kenya",
    "barbershop software Kenya",
    "pharmacy software Kenya",
    "wholesale ERP Kenya",
    "warehouse management Kenya",
    "school management Kenya",
    "professional services billing",
    "ERP software Kenya",
    "business management system Kenya",
  ],
  counties: ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Kenya"],
} as const;

export const ALL_KEYWORDS: string[] = Array.from(
  new Set([
    ...KEYWORDS.brand,
    ...KEYWORDS.pos,
    ...KEYWORDS.inventory,
    ...KEYWORDS.finance,
    ...KEYWORDS.payroll,
    ...KEYWORDS.compliance,
    ...KEYWORDS.crm,
    ...KEYWORDS.ai,
    ...KEYWORDS.integrations,
    ...KEYWORDS.industries,
  ])
);

/** Canonical page path -> absolute URL. Always emit `canonical` so Google does
 *  not pick up tracking-parameter duplicates. */
export function canonical(path = "/"): string {
  const clean = path === "/" ? "/" : `/${path.replace(/^\/+|\/+$/g, "")}`;
  return `${SITE_URL}${clean === "/" ? "" : clean}`;
}

export function keywords(...groups: (keyof typeof KEYWORDS)[]): string[] {
  const out = new Set<string>([...KEYWORDS.brand]);
  for (const group of groups) for (const word of KEYWORDS[group]) out.add(word);
  return Array.from(out);
}

/* ── JSON-LD ─────────────────────────────────────────────────────────── */

export type JsonLd = Record<string, unknown>;

export const organizationJsonLd: JsonLd = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  legalName: "LipaPoint",
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon-192.svg`,
  image: `${SITE_URL}/og-image.png`,
  sameAs: [
    "https://www.facebook.com/lipapoint",
    "https://twitter.com/lipapoint",
    "https://www.instagram.com/lipapoint",
  ],
  description:
    "LipaPoint ERP is a Kenyan business management system: point of sale, M-Pesa payments, inventory, accounting, statutory payroll, fixed assets and KRA eTIMS invoicing in one platform.",
  areaServed: KENYA_COUNTIES.map((county) => ({
    "@type": "AdministrativeArea",
    name: `${county} County`,
  })),
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "sales",
      email: "sales@lipapoint.co.ke",
      availableLanguage: ["en", "sw"],
      areaServed: "KE",
    },
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "support@lipapoint.co.ke",
      availableLanguage: ["en", "sw"],
      areaServed: "KE",
    },
  ],
};

export const websiteJsonLd: JsonLd = {
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: SITE_NAME,
  inLanguage: "en-KE",
  publisher: { "@id": `${SITE_URL}/#organization` },
};

/** Business-software entity reused by the home, features and pricing pages. */
export const softwareApplicationJsonLd: JsonLd = {
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#software`,
  name: SITE_NAME,
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "ERP",
  operatingSystem: "Web, Android, iOS, Windows",
  url: SITE_URL,
  description:
    "All-in-one ERP for Kenyan businesses: POS with M-Pesa, inventory, purchasing, accounting, statutory payroll, fixed assets, CRM, KRA eTIMS invoicing and an AI business assistant.",
  featureList: [
    "Point of sale with M-Pesa, card and split payments",
    "Inventory, stock valuation, transfers and expiry tracking",
    "Purchase orders and supplier management",
    "Accounting: general ledger, bank reconciliation, VAT reconciliation",
    "KRA eTIMS invoicing (OSCU and VSCU)",
    "Kenyan statutory payroll: PAYE, NSSF, SHIF, Housing Levy",
    "Fixed asset register, depreciation and disposal",
    "CRM, loyalty, discounts, appointments and online ordering",
    "AI business assistant grounded in the business's own data",
    "LipaPoint Connect integrations and offline mode",
  ],
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "KES",
    lowPrice: "999",
    highPrice: "3999",
    offerCount: "3",
    availability: "https://schema.org/InStock",
    url: `${SITE_URL}/pricing`,
  },
};

export function breadcrumbJsonLd(trail: { name: string; path: string }[]): JsonLd {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonical(item.path),
    })),
  };
}

/** Wraps entries into a single `@graph` document, as Google prefers one blob. */
export function jsonLdGraph(...nodes: JsonLd[]): JsonLd {
  return { "@context": "https://schema.org", "@graph": nodes };
}

export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
