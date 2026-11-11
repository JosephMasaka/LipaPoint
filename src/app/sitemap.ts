import type { MetadataRoute } from "next";

const INDUSTRY_SLUGS = [
  "retail",
  "restaurant",
  "bar",
  "barbershop",
  "pharmacy",
  "hr-payroll",
  "finance",
  "asset-management",
  "logistics-warehousing",
  "procurement-wholesale",
  "education-training",
  "professional-services",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://lipapoint.co.ke";
  const lastModified = new Date();

  const industryPages: MetadataRoute.Sitemap = INDUSTRY_SLUGS.map((slug) => ({
    url: `${baseUrl}/industries/${slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.8,
    images: [`${baseUrl}/images/og/${slug}.png`],
  }));

  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
      images: [`${baseUrl}/og-image.png`],
    },
    {
      url: `${baseUrl}/features`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
      images: [`${baseUrl}/images/og/features.png`],
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
      images: [`${baseUrl}/images/og/pricing.png`],
    },
    {
      url: `${baseUrl}/pricing/features`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/industries`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
      images: [`${baseUrl}/images/og/industries.png`],
    },
    ...industryPages,
    {
      url: `${baseUrl}/contact`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/demo-request`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
