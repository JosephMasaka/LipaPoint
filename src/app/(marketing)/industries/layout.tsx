import type { Metadata } from "next";
import { ogImage } from "@/lib/og";

export const metadata: Metadata = {
  title: {
    default: "Industry ERP Solutions in Kenya",
    template: "%s | LipaPoint ERP Kenya",
  },
  description:
    "Industry-ready ERP for Kenyan businesses: retail, hospitality, pharmacy, finance, payroll, logistics and professional services — sales, stock, staff and books in one system.",
  alternates: { canonical: "https://lipapoint.co.ke/industries" },
  openGraph: {
    title: "LipaPoint ERP — Built for How Kenya Runs Business",
    description:
      "Industry-ready ERP for retail, hospitality, pharmacy, services and logistics — one platform for sales, stock, staff and books.",
    url: "https://lipapoint.co.ke/industries",
    images: ogImage("industries", "LipaPoint ERP industry solutions"),
  },
};

export default function IndustriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
