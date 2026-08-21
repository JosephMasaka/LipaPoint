import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Zap,
  Shield,
  Globe,
  Wifi,
  BarChart3,
  Users,
  ShoppingCart,
  Store,
  CreditCard,
  Package,
  Clock,
} from "lucide-react";

export const metadata: Metadata = {
  title: "LipaPoint — #1 POS System for Kenyan Businesses | M-Pesa, Inventory & Analytics",
  description:
    "Kenya's top-rated POS system. Accept M-Pesa & card payments, track inventory in real-time, manage staff & view analytics. For restaurants, bars, retail, supermarkets & pharmacies. Free 14-day trial.",
  alternates: { canonical: "https://lipapoint.co.ke" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "LipaPoint",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Android, iOS, Windows",
      description: "All-in-one Point of Sale system for Kenyan businesses. M-Pesa integration, inventory management, real-time analytics, staff management and multi-location support.",
      url: "https://lipapoint.co.ke",
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "KES",
        lowPrice: "2999",
        highPrice: "14999",
        offerCount: "3",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        reviewCount: "127",
        bestRating: "5",
      },
      featureList: "M-Pesa Payments, Card Payments, Inventory Management, Real-time Analytics, Staff Management, Multi-Location, Offline Mode, Receipt Printing, KRA Tax Compliance, Barcode Scanning",
    },
    {
      "@type": "Organization",
      name: "LipaPoint",
      url: "https://lipapoint.co.ke",
      logo: "https://lipapoint.co.ke/icons/icon-512.svg",
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+254-791-298-382",
        contactType: "sales",
        areaServed: "KE",
        availableLanguage: ["English", "Swahili"],
      },
      address: {
        "@type": "PostalAddress",
        addressLocality: "Nairobi",
        addressCountry: "KE",
      },
      sameAs: [],
    },
    {
      "@type": "WebSite",
      name: "LipaPoint",
      url: "https://lipapoint.co.ke",
      potentialAction: {
        "@type": "SearchAction",
        target: "https://lipapoint.co.ke/features?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is the best POS system in Kenya?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "LipaPoint is Kenya's top-rated POS system, offering M-Pesa integration, real-time inventory tracking, sales analytics, and multi-location support. Trusted by 500+ businesses across restaurants, bars, retail shops, supermarkets, and pharmacies.",
          },
        },
        {
          "@type": "Question",
          name: "How much does a POS system cost in Kenya?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "LipaPoint POS plans start from KSh 2,999/month for the Starter plan (ideal for small shops), KSh 5,999/month for Professional (multi-location businesses), and KSh 14,999/month for Enterprise (unlimited everything with API access). All plans include a free 14-day trial.",
          },
        },
        {
          "@type": "Question",
          name: "Does LipaPoint POS support M-Pesa payments?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, LipaPoint fully supports M-Pesa payments including Paybill and Till Number integration. Customers can pay via M-Pesa and the system automatically records and reconciles the transaction.",
          },
        },
        {
          "@type": "Question",
          name: "Can I use LipaPoint POS for my restaurant or bar?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Absolutely. LipaPoint is built for restaurants, bars, and lounges with features like tab management, bill printing before payment, kitchen order display, table management, and split payments.",
          },
        },
        {
          "@type": "Question",
          name: "Does LipaPoint work offline?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, LipaPoint is a Progressive Web App (PWA) that works offline. You can continue processing sales without internet, and data automatically syncs when connectivity is restored.",
          },
        },
      ],
    },
  ],
};

const industries = [
  { name: "Restaurants", icon: Store },
  { name: "Bars & Lounges", icon: Store },
  { name: "Retail Shops", icon: ShoppingCart },
  { name: "Supermarkets", icon: Package },
  { name: "Pharmacies", icon: Package },
  { name: "Hardware Stores", icon: Package },
];

const stats = [
  { value: "500+", label: "Businesses Trust Us" },
  { value: "KSh 2B+", label: "Transactions Processed" },
  { value: "99.9%", label: "Uptime Guarantee" },
  { value: "24/7", label: "Support Available" },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Hero */}
      <section className="relative py-24 md:py-32 px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-gold/5 via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-4 py-1.5 mb-8">
            <Zap className="h-3.5 w-3.5 text-gold" />
            <span className="text-xs font-medium text-gold">
              Trusted by 500+ Kenyan Businesses
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-text-primary leading-[1.1] mb-6">
            Run Your Business
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold to-gold-light">
              Smarter with LipaPoint
            </span>
          </h1>

          <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed mb-10">
            The all-in-one POS system for Kenyan businesses. Track sales, manage
            inventory, monitor staff, and accept payments via M-Pesa and card —
            all from one dashboard.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="xl">
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/demo-request">
              <Button variant="secondary" size="xl">
                Request a Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-border/50">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-gold">{stat.value}</p>
              <p className="text-sm text-text-muted mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Industries */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-text-primary mb-3">
              Built for Every Industry
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              From mama mboga to supermarkets, LipaPoint adapts to your business type.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {industries.map((ind) => (
              <div
                key={ind.name}
                className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-elevated/50 p-5 hover:border-gold/30 transition-colors"
              >
                <ind.icon className="h-6 w-6 text-gold" />
                <span className="text-xs font-medium text-text-secondary text-center">
                  {ind.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section className="py-20 px-6 bg-surface-elevated/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-text-primary mb-3">
              Everything You Need to Grow
            </h2>
            <p className="text-text-secondary">
              Powerful features designed for the Kenyan market.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: ShoppingCart, title: "Fast POS", desc: "Process sales in seconds with an intuitive register interface." },
              { icon: Package, title: "Smart Inventory", desc: "Track stock levels, get alerts, and manage suppliers automatically." },
              { icon: CreditCard, title: "M-Pesa & Card", desc: "Accept M-Pesa, Visa, Mastercard, and cash payments seamlessly." },
              { icon: BarChart3, title: "Real-time Analytics", desc: "Sales reports, profit margins, and staff performance at a glance." },
              { icon: Users, title: "Staff Management", desc: "Assign roles, track shifts, and audit employee transactions." },
              { icon: Wifi, title: "Works Offline", desc: "Keep selling even without internet. Data syncs when you reconnect." },
              { icon: Globe, title: "Multi-Location", desc: "Manage multiple branches from a single dashboard." },
              { icon: Shield, title: "Secure & Compliant", desc: "KRA-ready tax calculations and encrypted data storage." },
              { icon: Clock, title: "24/7 Support", desc: "Local support team available round the clock via call or WhatsApp." },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-surface-elevated p-6 hover:border-gold/20 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
                  <f.icon className="h-5 w-5 text-gold" />
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-text-primary mb-3">
              Frequently Asked Questions
            </h2>
            <p className="text-text-secondary">
              Common questions about POS systems in Kenya
            </p>
          </div>
          <div className="space-y-4">
            {[
              {
                q: "What is the best POS system in Kenya?",
                a: "LipaPoint is Kenya's top-rated POS system, offering M-Pesa integration, real-time inventory tracking, sales analytics, and multi-location support. Trusted by 500+ businesses across restaurants, bars, retail shops, supermarkets, and pharmacies.",
              },
              {
                q: "How much does a POS system cost in Kenya?",
                a: "LipaPoint POS plans start from KSh 2,999/month for small shops, KSh 5,999/month for multi-location businesses, and KSh 14,999/month for enterprise. All plans include a free 14-day trial with no setup fees.",
              },
              {
                q: "Does LipaPoint POS support M-Pesa payments?",
                a: "Yes, LipaPoint fully supports M-Pesa payments including Paybill and Till Number integration. Customers can pay via M-Pesa and the system automatically records and reconciles the transaction.",
              },
              {
                q: "Can I use LipaPoint POS for my restaurant or bar?",
                a: "Absolutely. LipaPoint is built for restaurants, bars, and lounges with features like tab management, bill printing before payment, kitchen display, table management, and split payments.",
              },
              {
                q: "Does LipaPoint work offline?",
                a: "Yes, LipaPoint is a Progressive Web App that works offline. You can continue processing sales without internet, and data automatically syncs when connectivity is restored.",
              },
              {
                q: "Is LipaPoint POS KRA compliant?",
                a: "Yes. LipaPoint includes automatic VAT calculations at the standard 16% rate, generates tax-compliant receipts, and provides detailed reports to support your KRA filing.",
              },
            ].map((faq) => (
              <details key={faq.q} className="group rounded-xl border border-border bg-surface-elevated overflow-hidden">
                <summary className="flex items-center justify-between cursor-pointer p-5 text-sm font-medium text-text-primary hover:text-gold transition-colors">
                  {faq.q}
                  <ArrowRight className="h-4 w-4 text-text-muted group-open:rotate-90 transition-transform" />
                </summary>
                <p className="px-5 pb-5 text-sm text-text-secondary leading-relaxed">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-text-primary mb-4">
            Ready to Transform Your Business?
          </h2>
          <p className="text-text-secondary mb-8">
            Join hundreds of Kenyan businesses already using LipaPoint.
            Start your 14-day free trial today — no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="xl">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="xl">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
