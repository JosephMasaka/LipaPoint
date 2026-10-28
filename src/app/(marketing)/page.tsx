import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { twMerge } from "tailwind-merge";
import {
  ArrowRight,
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
  ShieldCheck,
  Banknote,
  Landmark,
} from "lucide-react";

export const metadata: Metadata = {
  title: "LipaPoint — #1 POS System for Kenyan Businesses | M-Pesa, Inventory & Analytics",
  description:
    "Kenya's top-rated POS system. Accept M-Pesa & card payments, track inventory, run statutory payroll, submit KRA eTIMS invoices and keep the books. For restaurants, bars, retail, supermarkets & pharmacies. No setup fees. Cancel anytime.",
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
      description:
        "All-in-one Point of Sale and ERP system for Kenyan businesses. M-Pesa integration, inventory management, real-time analytics, KRA eTIMS invoicing, statutory payroll and multi-location support.",
      url: "https://lipapoint.co.ke",
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "KES",
        price: "KES 0",
        offerCurrency: "KES",
        eligibleRegion: "KE",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        ratingCount: "3,200+",
        bestRating: "5",
        worstRating: "1",
      },
      seller: {
        "@type": "Organization",
        name: "LipaPoint",
        url: "https://lipapoint.co.ke",
      },
    },
    {
      "@type": "Organization",
      name: "LipaPoint",
      url: "https://lipapoint.co.ke",
      logo: "https://lipapoint.co.ke/icon.svg",
      sameAs: [
        "https://www.facebook.com/lipapoint",
        "https://twitter.com/lipapoint",
        "https://www.instagram.com/lipapoint",
      ],
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="relative min-h-screen bg-background">
        {/* ---- Trust strip ---- */}
        <div className="border-border bg-background">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 py-5 text-sm text-text-secondary">
            <span className="text-text-primary font-semibold">Trusted across Kenya</span>
            <a
              href="https://www.facebook.com/lipapoint"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-text-primary hover:underline"
            >
              <span className="inline-block h-6 w-6 overflow-hidden rounded-full bg-surface-elevated">
                <img
                  className="h-full w-full"
                  alt="LipaPoint Facebook"
                  src="https://commons.wikimedia.org/wiki/Special:FilePath/Facebook%20icon%202013.svg"
                  width={20}
                  height={20}
                  loading="lazy"
                />
              </span>
              <span>Facebook</span>
            </a>
            <a
              href="https://twitter.com/lipapoint"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-text-primary hover:underline"
            >
              <span className="inline-block h-6 w-6 overflow-hidden rounded-full bg-surface-elevated">
                <img
                  className="h-full w-full"
                  alt="LipaPoint X / Twitter"
                  src="https://upload.wikimedia.org/wikipedia/commons/6/6f/Logo_of_Twitter.svg"
                  width={20}
                  height={20}
                  loading="lazy"
                />
              </span>
              <span>X</span>
            </a>
            <a
              href="https://www.instagram.com/lipapoint"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-text-primary hover:underline"
            >
              <span className="inline-block h-6 w-6 overflow-hidden rounded-full bg-surface-elevated">
                <img
                  className="h-full w-full"
                  alt="LipaPoint Instagram"
                  src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png"
                  width={20}
                  height={20}
                  loading="lazy"
                />
              </span>
              <span>Instagram</span>
            </a>
          </div>
        </div>

        <div className="mx-auto flex max-w-6xl flex-col items-center px-6 pt-14 text-center">
          {/* ---- Pre-headline module image panels ---- */}
          <div className="mb-10 w-full max-w-3xl overflow-hidden rounded-2xl bg-surface-elevated p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-border bg-background p-4 text-center">
                <ShoppingCart className="h-5 w-5 text-text-muted" />
                <p className="mt-1 text-sm text-text-secondary">Inventory</p>
                <span className="mt-2 rounded-lg bg-brand-solid px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">Stock</span>
              </div>
              <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-border bg-background p-4 text-center">
                <Banknote className="h-5 w-5 text-text-muted" />
                <p className="mt-1 text-sm text-text-secondary">Payroll & Finance</p>
                <span className="mt-2 rounded-lg bg-brand-solid px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">Payroll</span>
              </div>
              <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-border bg-background p-4 text-center">
                <CreditCard className="h-5 w-5 text-text-muted" />
                <p className="mt-1 text-sm text-text-secondary">Payments</p>
                <span className="mt-2 rounded-lg bg-brand-solid px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">M-Pesa</span>
              </div>
            </div>
          </div>

          {/*
            ============================================================
            Headline block
            ============================================================
            */}
          <div className="mb-11 w-full max-w-3xl">
            <span className="mb-3 inline-block rounded-full bg-brand-solid px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
              Built for Kenyan business
            </span>
            <h1 className="text-balance leading-tight text-text-primary sm:text-5xl md:text-6xl lg:text-7xl">
              Run your business from one system
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-text-secondary sm:text-xl">
              Point of sale, stock, payroll, banking, eTIMS invoicing and more —
              one platform, M-Pesa ready.
            </p>
          </div>

          {/* ---- CTAs ---- */}
          <div className="mb-12 flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-black transition-colors hover:bg-gold/90 shadow-lg shadow-gold/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              See plans & pricing
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/demo-request"
              className="rounded-full border border-border bg-background px-8 py-3.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary"
            >
              Request a demo
            </Link>
          </div>

          {/* ---- Hero visual ---- */}
          <div className="relative w-full max-w-4xl">
            <div
              className="bordered-shadow-card overflow-hidden rounded-2xl ring-1 ring-black/10 ring-offset-4 ring-offset-background"
              style={{ maxHeight: "460px" }}
            >
              <img
                src="/images/lipapoint-shop-owner.jfif"
                alt="A Kenyan shop owner using LipaPoint on a tablet"
                width={1470}
                height={950}
                loading="eager"
                className="bordered-shadow-card-foreground object-cover"
                fetchPriority="high"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
            </div>
            <div className="absolute left-4 top-4 rounded-xl bg-background px-3 py-2 shadow-lg">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-solid text-[10px] font-semibold text-white">
                  LP
                </div>
                <span className="text-sm font-semibold text-text-primary">LipaPoint</span>
              </div>
            </div>
          </div>
        </div>

{/* ---- Proof strip ---- */}
<section className="relative mt-16 border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-8 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-text-muted">
              From shops to supermarkets
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-text-secondary">
              <span className="text-lg font-semibold text-text-primary">Restaurants</span>
              <span className="text-lg font-semibold text-text-primary">Bars & Hotels</span>
              <span className="text-lg font-semibold text-text-primary">Retail</span>
              <span className="text-lg font-semibold text-text-primary">Supermarkets</span>
              <span className="text-lg font-semibold text-text-primary">Pharmacies</span>
            </div>
          </div>
        </section>

{/* ============ HERO END ============ */}

{/* ============ THE PROBLEM ============ */}
<section className="mt-24 bg-surface-elevated py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-4xl text-center">
              <span className="mb-3 inline-block rounded-full bg-brand-solid px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
                The real problem
              </span>
              <h2 className="text-balance text-text-primary text-2xl font-semibold sm:text-3xl md:text-4xl">
                Kenyan SMEs are stitching together too many tools
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-text-secondary text-lg">
                Most businesses are running separate systems for sales, stock, payroll and
                compliance — and manually trying to reconcile them at month end.
              </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-start rounded-xl border border-border bg-background p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated">
                  <ShoppingCart className="h-5 w-5 text-text-secondary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-primary">Inventory chaos</h3>
                <p className="mt-2 text-text-secondary">
                  Stock counts don&apos;t match sales, reorders are late, and you&apos;re forced to
                  run inventory from a spreadsheet.
                </p>
                <span className="mt-3 rounded-lg bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
                  Stockouts & overstock
                </span>
              </div>

              <div className="flex flex-col items-start rounded-xl border border-border bg-background p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated">
                  <Banknote className="h-5 w-5 text-text-secondary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-primary">Payroll headaches</h3>
                <p className="mt-2 text-text-secondary">
                  Statutory deductions, NSSF, NHIF, PAYE — calculated by hand and re-keyed into
                  bank transfers.
                </p>
                <span className="mt-3 rounded-lg bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
                  Manual payroll runs
                </span>
              </div>

              <div className="flex flex-col items-start rounded-xl border border-border bg-background p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated">
                  <CreditCard className="h-5 w-5 text-text-secondary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-primary">Cash application</h3>
                <p className="mt-2 text-text-secondary">
                  M-Pesa payments land in your phone and you manually key them into the system
                  days later.
                </p>
                <span className="mt-3 rounded-lg bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
                  Mismatched payments
                </span>
              </div>

              <div className="flex flex-col items-start rounded-xl border border-border bg-background p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated">
                  <Package className="h-5 w-5 text-text-secondary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-primary">eTIMS compliance</h3>
                <p className="mt-2 text-text-secondary">
                  KRA wants eTIMS-compliant invoices. Without them, you&apos;re either missing
                  receipts or scrambling at month end.
                </p>
                <span className="mt-3 rounded-lg bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
                  KRA eTIMS
                </span>
              </div>

              <div className="flex flex-col items-start rounded-xl border border-border bg-background p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated">
                  <Landmark className="h-5 w-5 text-text-secondary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-primary">Multi-location blur</h3>
                <p className="mt-2 text-text-secondary">
                  Branches, outlets and warehouses are all tracked separately — until you need a
                  single true view.
                </p>
                <span className="mt-3 rounded-lg bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
                  Fragmented reporting
                </span>
              </div>

              <div className="flex flex-col items-start rounded-xl border border-border bg-background p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated">
                  <Banknote className="h-5 w-5 text-text-secondary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-primary">Reporting gap</h3>
                <p className="mt-2 text-text-secondary">
                  You know the sales happened, but getting clean P&L, stock movement and payroll
                  reports is still manual work.
                </p>
                <span className="mt-3 rounded-lg bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
                  No real-time reports
                </span>
              </div>
            </div>
          </div>
        </section>

{/* ============================================================
            WHY LIPAPOINT
            ============================================================ */}
<section className="mt-24 bg-background py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-4xl text-center">
              <span className="mb-3 inline-block rounded-full bg-brand-solid px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
                One system, every department
              </span>
              <h2 className="text-balance text-text-primary text-2xl font-semibold sm:text-3xl md:text-4xl">
                Built for how Kenyan businesses actually run
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-text-secondary text-lg">
                Point of sale, inventory, payroll, finance, assets, eTIMS and more — on one
                platform, in one place, with M-Pesa built in.
              </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={<ShoppingCart className="h-5 w-5" />}
                title="Point of Sale"
                description="Accept M-Pesa and card payments, track sales by item, register and cashier, and keep your front-of-house moving."
              />
              <FeatureCard
                icon={<Package className="h-5 w-5" />}
                title="Inventory"
                description="Track stock across locations, set reorder points, manage suppliers and purchase orders, and keep counts accurate."
              />
              <FeatureCard
                icon={<Banknote className="h-5 w-5" />}
                title="Payroll & Finance"
                description="Run statutory payroll, post journals, manage bank accounts and reconciliation, and keep the books clean."
              />
              <FeatureCard
                icon={<CreditCard className="h-5 w-5" />}
                title="Payments"
                description="M-Pesa STK Push, B2C, B2B and customer payments flow straight into your sales and bank records."
              />
              <FeatureCard
                icon={<Landmark className="h-5 w-5" />}
                title="Multi-location"
                description="Run shops, branches, bars and warehouses from one tenant — with location-level sales, stock and reporting."
              />
              <FeatureCard
                icon={<ShieldCheck className="h-5 w-5" />}
                title="eTIMS compliance"
                description="Issue eTIMS-compliant receipts and invoices, and stay aligned with KRA requirements as the rules evolve."
              />
            </div>
          </div>
        </section>

{/* ============================================================
            FOR EVERY KIND OF KENYAN BUSINESS
            ============================================================ */}
<section className="mt-24 bg-surface-elevated py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-4xl text-center">
              <span className="mb-3 inline-block rounded-full bg-brand-solid px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
                Made for Kenya
              </span>
              <h2 className="text-balance text-text-primary text-2xl font-semibold sm:text-3xl md:text-4xl">
                For every kind of Kenyan business
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-text-secondary text-lg">
                Whether you run a kiosk, a restaurant, a supermarket or a pharmacy, LipaPoint
                adapts to the way you work.
              </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-start rounded-xl border border-border bg-background p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-elevated">
                  <Store className="h-5 w-5 text-text-secondary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-primary">Retail & Supermarkets</h3>
                <p className="mt-2 text-text-secondary">
                  High-volume sales, barcode-driven stock, multi-rack inventory and purchase
                  ordering — built for shelves and reorders.
                </p>
                <span className="mt-3 rounded-lg bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
                  Inventory-led retail
                </span>
              </div>

              <div className="flex flex-col items-start rounded-xl border border-border bg-background p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-elevated">
                  <Package className="h-5 w-5 text-text-secondary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-primary">Pharmacy</h3>
                <p className="mt-2 text-text-secondary">
                  Prescription-style sales, expiry tracking, stock movement and controlled
                  inventory — with the reporting pharmacists need.
                </p>
                <span className="mt-3 rounded-lg bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
                  Stock & expiry control
                </span>
              </div>

              <div className="flex flex-col items-start rounded-xl border border-border bg-background p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-elevated">
                  <ShoppingCart className="h-5 w-5 text-text-secondary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-primary">Restaurants & Hospitality</h3>
                <p className="mt-2 text-text-secondary">
                  Table and order management, menu-driven sales, kitchen flow and payroll for
                  back-of-house — in one system.
                </p>
                <span className="mt-3 rounded-lg bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
                  Restaurant operations
                </span>
              </div>

              <div className="flex flex-col items-start rounded-xl border border-border bg-background p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-elevated">
                  <CreditCard className="h-5 w-5 text-text-secondary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-primary">Bars & Lodges</h3>
                <p className="mt-2 text-text-secondary">
                  Nightly sales, payment capture, stock tracking for drinks and stocktakes —
                  without the clipboard chaos.
                </p>
                <span className="mt-3 rounded-lg bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
                  Nightly sales & stock
                </span>
              </div>

              <div className="flex flex-col items-start rounded-xl border border-border bg-background p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-elevated">
                  <Users className="h-5 w-5 text-text-secondary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-primary">Service businesses</h3>
                <p className="mt-2 text-text-secondary">
                  Appointment-style businesses, field services and small teams that need
                  scheduling, notes and payments in one place.
                </p>
                <span className="mt-3 rounded-lg bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
                  Scheduling & service
                </span>
              </div>

              <div className="flex flex-col items-start rounded-xl border border-border bg-background p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-elevated">
                  <Globe className="h-5 w-5 text-text-secondary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-primary">General trade</h3>
                <p className="mt-2 text-text-secondary">
                  Wholesalers, dealers and general traders who need purchases, stock, sales and
                  finance connected across locations.
                </p>
                <span className="mt-3 rounded-lg bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
                  Trade & distribution
                </span>
              </div>
            </div>
          </div>
        </section>

{/* ============================================================
            HOW IT WORKS / PLATFORM PILLARS
            ============================================================ */}
<section className="mt-24 bg-background py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-4xl text-center">
              <span className="mb-3 inline-block rounded-full bg-brand-solid px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
                Platform pillars
              </span>
              <h2 className="text-balance text-text-primary text-2xl font-semibold sm:text-3xl md:text-4xl">
                Everything you need, nothing you don&apos;t
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-text-secondary text-lg">
                Add the modules you need, choose your plan, and only pay for what your business
                actually needs.
              </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-start rounded-xl border border-border bg-surface-elevated p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated">
                  <Shield className="h-5 w-5 text-text-secondary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-primary">Only pay for what you use</h3>
                <p className="mt-2 text-text-secondary">
                  Choose your modules, choose your plan, and only pay for what your business
                  actually needs.
                </p>
              </div>

              <div className="flex flex-col items-start rounded-xl border border-border bg-surface-elevated p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated">
                  <Wifi className="h-5 w-5 text-text-secondary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-primary">SaaS, from day one</h3>
                <p className="mt-2 text-text-secondary">
                  Cloud-hosted, multi-location, multi-user — ready to go without hardware setup
                  beyond a tablet or terminal.
                </p>
              </div>

              <div className="flex flex-col items-start rounded-xl border border-border bg-surface-elevated p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated">
                  <Clock className="h-5 w-5 text-text-secondary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-primary">Fast to start</h3>
                <p className="mt-2 text-text-secondary">
                  No setup fees — pay securely with M-Pesa at sign-up. Get a tenant, add items, and start
                  selling the same day.
                </p>
              </div>
            </div>
          </div>
        </section>

{/* ============================================================
            PRICING TEASER — card grid
            ============================================================ */}
<section className="mt-24 bg-surface-elevated py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="mb-3 inline-block rounded-full bg-brand-solid px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
                Plans & pricing
              </span>
              <h2 className="text-balance text-text-primary text-2xl font-semibold sm:text-3xl md:text-4xl">
                Pay only for what you need.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-text-secondary text-lg">
                Pick your apps up front, choose a plan, and add more whenever your
                business grows.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <PlanCard
                name="Starter"
                tagline="For small shops & lorries"
                price={1500}
                period="KES / month"
                ctaHref="/register"
                ctaLabel="Get started"
                features={[
                  "Point of Sale",
                  "Inventory basics",
                  "M-Pesa payments",
                  "1 location",
                  "Up to 3 users",
                  "Email support",
                ]}
                highlight={false}
              />
              <PlanCard
                name="Growth"
                tagline="For growing businesses"
                price={3500}
                period="KES / month"
                ctaHref="/register"
                ctaLabel="Get started"
                features={[
                  "Everything in Starter",
                  "Payroll & Finance",
                  "More locations",
                  "More users",
                  "Reports & dashboards",
                  "Priority support",
                ]}
                highlight={true}
              />
              <PlanCard
                name="Pro"
                tagline="For high-volume SMEs"
                price={7000}
                period="KES / month"
                ctaHref="/register"
                ctaLabel="Get started"
                features={[
                  "Everything in Growth",
                  "Advanced reporting",
                  "Full module access",
                  "All locations",
                  "All users",
                  "Priority support",
                ]}
                highlight={false}
              />
            </div>

            <p className="mt-8 text-center text-sm text-text-muted">
              Additional modules available à la carte. Pricing and modules shown are
              indicative — see checkout for final pricing.
            </p>
          </div>
        </section>

{/* ============================================================
            SECTIONS: WHY CHOOSE / PAGINATION/QUICK START
            ============================================================ */}

{/* ---- Proof / why-choose strip ---- */}
<section className="mt-24 bg-background py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-4xl text-center">
              <span className="mb-3 inline-block rounded-full bg-brand-solid px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
                Trusted by Kenyan businesses
              </span>
              <h2 className="text-balance text-text-primary text-2xl font-semibold sm:text-3xl md:text-4xl">
                Why teams choose LipaPoint
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-text-secondary text-lg">
                One platform, real compliance, simpler operations — from day one.
              </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-start rounded-xl border border-border bg-surface-elevated p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated">
                  <ShieldCheck className="h-5 w-5 text-text-secondary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-primary">Compliance, built in</h3>
                <p className="mt-2 text-text-secondary">
                  Statutory payroll, eTIMS-ready invoicing and KRA-aligned reporting — so you
                  spend less time worrying and more time running the business.
                </p>
              </div>

              <div className="flex flex-col items-start rounded-xl border border-border bg-surface-elevated p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated">
                  <Banknote className="h-5 w-5 text-text-secondary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-primary">Kenyan payments, first-class</h3>
                <p className="mt-2 text-text-secondary">
                  M-Pesa STK Push, customer payments, B2C and B2B — settled into your records
                  the way Kenyan businesses actually transact.
                </p>
              </div>

              <div className="flex flex-col items-start rounded-xl border border-border bg-surface-elevated p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated">
                  <Users className="h-5 w-5 text-text-secondary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text-primary">Grows with you</h3>
                <p className="mt-2 text-text-secondary">
                  Start with one module, add more as you need them. One location today, many
                  tomorrow — same platform, same team.
                </p>
              </div>
            </div>
          </div>
        </section>

{/* ============================================================
            GETTING STARTED / ONBOARDING PLACEHOLDER
            ============================================================ */}
<section className="mt-24 bg-surface-elevated py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-4xl text-center">
              <span className="mb-3 inline-block rounded-full bg-brand-solid px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
                Getting started
              </span>
              <h2 className="text-balance text-text-primary text-2xl font-semibold sm:text-3xl md:text-4xl">
                Live in days, not months
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-text-secondary text-lg">
                No hardware to install, no long implementation. Create your tenant, load your
                items, and start selling.
              </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-3">
              <StepCard number="1" title="Create your tenant" description="Sign up, pick your modules, and go live the same day." />
              <StepCard number="2" title="Add your items" description="Load products, services, prices and tax setup once — then sell everywhere." />
              <StepCard number="3" title="Start selling" description="Accept M-Pesa and card payments, track stock and run payroll from one place." />
            </div>
          </div>
        </section>

{/* ============================================================
            FINAL CTA — REGISTER
            ============================================================ */}
<section className="bg-brand-solid py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <h2 className="text-balance text-white text-2xl font-semibold sm:text-3xl md:text-4xl">
              Ready to run your business from one system?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/70 text-lg">
              Sign up with M-Pesa — apply your coupon code at sign-up.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-black transition-colors hover:bg-gold/90 shadow-lg shadow-gold/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                Get started
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/demo-request"
                className="rounded-full border border-white/30 px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                Request a demo
              </Link>
            </div>
          </div>
        </section>

{/* ============================================================
            FOOTER
            ============================================================ */}
        {/*<footer className="border-t border-border bg-background">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:py-14">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row">
              <Link
                href="/"
                className="flex items-center gap-2 text-text-primary font-semibold"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-solid text-[11px] font-semibold text-white">
                  LP
                </span>
                LipaPoint
              </Link>
              <p className="text-sm text-text-muted">
                All-in-one POS and ERP for Kenyan businesses.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Product</p>
                <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                  <li>
                    <Link
                      href="/features"
                      className="transition-colors hover:text-text-primary hover:underline"
                    >
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/pricing"
                      className="transition-colors hover:text-text-primary hover:underline"
                    >
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/register"
                      className="transition-colors hover:text-text-primary hover:underline"
                    >
                      Get started
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Company</p>
                <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                  <li>
                    <Link
                      href="/"
                      className="transition-colors hover:text-text-primary hover:underline"
                    >
                      Home
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/contact"
                      className="transition-colors hover:text-text-primary hover:underline"
                    >
                      Contact
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/demo-request"
                      className="transition-colors hover:text-text-primary hover:underline"
                    >
                      Demo request
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Support</p>
                <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                  <li>
                    <Link
                      href="/login"
                      className="transition-colors hover:text-text-primary hover:underline"
                    >
                      Log in
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/forgot-password"
                      className="transition-colors hover:text-text-primary hover:underline"
                    >
                      Forgot password
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/reset-password"
                      className="transition-colors hover:text-text-primary hover:underline"
                    >
                      Reset password
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Legal</p>
                <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                  <li>
                    <a
                      href="/privacy"
                      className="transition-colors hover:text-text-primary hover:underline"
                    >
                      Privacy policy
                    </a>
                  </li>
                  <li>
                    <a
                      href="/terms"
                      className="transition-colors hover:text-text-primary hover:underline"
                    >
                      Terms of service
                    </a>
                  </li>
                </ul>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Industries</p>
                <ul className="mt-3 space-y-2 text-sm text-text-secondary">
                  <li>
                    <Link
                      href="/industries/retail"
                      className="transition-colors hover:text-text-primary hover:underline"
                    >
                      Retail & Supermarkets
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/industries/pharmacy"
                      className="transition-colors hover:text-text-primary hover:underline"
                    >
                      Pharmacy
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/industries/restaurant"
                      className="transition-colors hover:text-text-primary hover:underline"
                    >
                      Restaurants & Hospitality
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/industries/bar"
                      className="transition-colors hover:text-text-primary hover:underline"
                    >
                      Bars & Lodges
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/industries/barbershop"
                      className="transition-colors hover:text-text-primary hover:underline"
                    >
                      Barbershop & Salon
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/industries/hr-payroll"
                      className="transition-colors hover:text-text-primary hover:underline"
                    >
                      HR & Payroll
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/industries/asset-management"
                      className="transition-colors hover:text-text-primary hover:underline"
                    >
                      Asset Management
                    </Link>
                  </li>
                </ul>
              </div>
              </div>
            </div>

            <div className="border-t border-border pt-6 text-center text-xs text-text-muted">
              © {new Date().getFullYear()} LipaPoint. All rights reserved.
            </div>
          </div>
        </footer>*/}
      </main>
    </>
  );
}

function SubscriptionPeriodBadge({ tier }: { tier: string }) {
  // Compute "MMM yyyy" from the first of next month using native JS
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthly = months[nextMonth.getMonth()];
  const year = nextMonth.getFullYear();
  return (
    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-text-secondary">
      <Clock className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
      Billed monthly · renews {monthly} {year}
    </span>
  );
}

function PlanCard({
  name,
  tagline,
  price,
  period,
  ctaHref,
  ctaLabel,
  features,
  highlight,
}: {
  name: string;
  tagline: string;
  price: number;
  period: string;
  ctaHref: string;
  ctaLabel: string;
  features: string[];
  highlight?: boolean;
}) {
  const tier = name.toLowerCase() as "starter" | "growth" | "pro";
  return (
    <div
      className={twMerge(
        "relative flex flex-col rounded-2xl border bg-background p-6 transition-shadow",
        highlight
          ? "border-gold/50 shadow-xl ring-1 ring-gold/20"
          : "border-border shadow-sm",
      )}
    >
      {highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-solid px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
          Most popular
        </span>
      )}

      <div className="flex col">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-text-primary">{name}</span>
          <SubscriptionPeriodBadge tier={tier} />
        </div>

        <p className="mt-1 text-sm text-text-muted">{tagline}</p>

        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-3xl font-semibold text-text-primary">
            KES {price.toLocaleString()}
          </span>
          <span className="text-text-muted">/{period.replace(" / ", "")}</span>
        </div>

        <ul className="mt-6 space-y-3 text-sm text-text-secondary">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <Link
            href={ctaHref}
            className={twMerge(
              "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-solid px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-solid-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary",
              highlight ? "" : "border border-border text-text-secondary hover:bg-surface-elevated hover:text-text-primary",
            )}
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-start rounded-xl border border-border bg-background p-6">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-elevated">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold text-text-primary">{title}</h3>
      <p className="mt-2 text-text-secondary">{description}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-start rounded-xl border border-border bg-background p-6 text-center sm:text-left">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-solid text-sm font-semibold text-white">
        {number}
      </span>
      <h3 className="mt-4 text-lg font-semibold text-text-primary">{title}</h3>
      <p className="mt-2 text-text-secondary">{description}</p>
    </div>
  );
}

function CheckCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
