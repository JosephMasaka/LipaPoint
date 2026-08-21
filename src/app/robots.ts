import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/login", "/register", "/forgot-password", "/reset-password"],
      },
    ],
    sitemap: "https://lipapoint.co.ke/sitemap.xml",
  };
}
