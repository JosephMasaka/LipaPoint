import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Request a Free Demo — See LipaPoint POS in Action",
  description:
    "Book a free demo of LipaPoint POS system. See how M-Pesa integration, inventory management, and real-time analytics can transform your Kenyan business.",
  alternates: { canonical: "https://lipapoint.co.ke/demo-request" },
  openGraph: {
    title: "Request a Free POS Demo — LipaPoint Kenya",
    description: "Book a personalized demo. See M-Pesa payments, inventory, analytics & more in action.",
    url: "https://lipapoint.co.ke/demo-request",
  },
};

export default function DemoRequestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
