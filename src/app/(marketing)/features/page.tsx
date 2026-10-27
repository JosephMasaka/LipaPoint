import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart, Package, CreditCard, BarChart3, Users, Wifi,
  Globe, Shield, Clock, Smartphone, Receipt, Bell,
  ArrowRight, Layers, Database, Zap,
  Landmark, Truck, ShieldCheck, Contact, Banknote, Boxes,
} from "lucide-react";

export const metadata: Metadata = {
  title: "POS Features — M-Pesa, Inventory, Payroll, KRA eTIMS & More",
  description:
    "Explore LipaPoint features: M-Pesa & card payments, inventory, sales analytics, KRA eTIMS invoicing, Kenyan statutory payroll (PAYE/NSSF/SHIF), HR & leave, accounting and asset depreciation. Best POS+ERP for Kenya.",
  alternates: { canonical: "https://lipapoint.co.ke/features" },
  openGraph: {
    title: "LipaPoint Features — POS, ERP and Tax Compliance in One",
    description: "M-Pesa payments, inventory, eTIMS invoicing, statutory payroll, accounting & asset depreciation. Built for Kenyan businesses.",
    url: "https://lipapoint.co.ke/features",
  },
};

const featureGroups = [
  {
    title: "Point of Sale",
    description: "Fast, intuitive sales processing",
    features: [
      { icon: ShoppingCart, name: "Quick Checkout", desc: "Process sales in under 5 seconds with barcode scanning and product search." },
      { icon: Receipt, name: "Receipt Printing", desc: "Print or send digital receipts via SMS and WhatsApp." },
      { icon: CreditCard, name: "Multi-Payment", desc: "Accept cash, M-Pesa, card, and split payments on a single order." },
      { icon: Smartphone, name: "Mobile POS", desc: "Turn any tablet or phone into a POS terminal." },
    ],
  },
  {
    title: "Inventory Management",
    description: "Never run out of stock",
    features: [
      { icon: Package, name: "Stock Tracking", desc: "Real-time stock levels across all locations with automatic deduction on sale." },
      { icon: Bell, name: "Low Stock Alerts", desc: "Get notified when products hit minimum levels. Set custom thresholds." },
      { icon: Layers, name: "Categories & Variants", desc: "Organize products with categories, images, and attribute variants." },
      { icon: Database, name: "Bulk Import", desc: "Import thousands of products via CSV. Export inventory reports anytime." },
    ],
  },
  {
    title: "Analytics & Reporting",
    description: "Data-driven decisions",
    features: [
      { icon: BarChart3, name: "Sales Analytics", desc: "Daily, weekly, monthly revenue reports. Compare periods and track growth." },
      { icon: Users, name: "Staff Reports", desc: "Track who sold what, when. Identify top performers and training needs." },
      { icon: Globe, name: "Multi-Branch", desc: "Compare performance across locations. Identify best and worst performers." },
      { icon: Zap, name: "Real-time Dashboard", desc: "Live sales ticker, hourly breakdown, and instant profit calculations." },
    ],
  },
  {
    title: "Accounting & ERP",
    description: "Back-office that closes the books",
    features: [
      { icon: Landmark, name: "Accounting & General Ledger", desc: "Chart of accounts with automatic, balanced journal entries from every sale, payroll run and depreciation — books without the spreadsheet." },
      { icon: Truck, name: "Procurement", desc: "Purchase orders, goods received notes and supplier invoices, with payments tracked against what you owe." },
      { icon: ShieldCheck, name: "KRA eTIMS Invoicing", desc: "Submit invoices to KRA's OSCU in real time, track CSIDs and reconcile declared VAT from the compliance dashboard." },
      { icon: Contact, name: "HR & Leave", desc: "Employee files with KRA PIN, NSSF and SHA numbers, annual leave balances, and staff loans repaid automatically through payroll." },
      { icon: Banknote, name: "Statutory Payroll", desc: "Kenyan payroll computing PAYE, NSSF, SHIF, Housing Levy and NITA for you — payslips, P9 extracts and bank payment batches." },
      { icon: Boxes, name: "Fixed Assets", desc: "Register till machines, fridges and delivery bikes — straight-line depreciation posts itself to the ledger every month." },
    ],
  },
  {
    title: "Security & Reliability",
    description: "Enterprise-grade protection",
    features: [
      { icon: Shield, name: "Role-Based Access", desc: "Owners, managers, cashiers, stock keepers — each sees only what they need." },
      { icon: Wifi, name: "Offline Mode", desc: "Keep selling when internet drops. Transactions sync automatically when back online." },
      { icon: Clock, name: "Audit Trail", desc: "Every action is logged. Track voids, discounts, refunds, and inventory changes." },
      { icon: Database, name: "Daily Backups", desc: "Automatic cloud backups. Your data is safe even if devices are lost or damaged." },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            ERP Features for Modern Businesses
          </h1>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            A complete ERP system for Kenyan businesses — point of sale, inventory, payroll, accounting, eTIMS compliance and more.
          </p>
          <p className="mt-4 text-sm text-text-muted max-w-2xl mx-auto">
            Every capability below is its own switch: start with one app, then add
            single features — Payroll without the rest of HR, Kitchen Display
            without a full restaurant bundle.
          </p>
        </div>

        <div className="mb-4 flex flex-col sm:flex-row items-center justify-center gap-3 rounded-2xl border border-gold/25 bg-gold/5 px-6 py-4 text-center">
          <p className="text-sm text-text-secondary">
            Want just one part of an app? Feature-level pricing is listed on our
            pricing page.
          </p>
          <Link href="/pricing" className="text-sm font-medium text-gold hover:underline shrink-0">
            See individual feature prices →
          </Link>
        </div>

        {featureGroups.map((group, i) => (
          <div key={group.title} className={`py-16 ${i > 0 ? "border-t border-border" : ""}`}>
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-text-primary mb-2">{group.title}</h2>
              <p className="text-text-secondary">{group.description}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {group.features.map((f) => (
                <div
                  key={f.name}
                  className="flex gap-4 rounded-xl border border-border bg-surface-elevated/50 p-6 hover:border-gold/20 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 shrink-0">
                    <f.icon className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text-primary mb-1">{f.name}</h3>
                    <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="text-center pt-12 border-t border-border">
          <h2 className="text-2xl font-bold text-text-primary mb-4">
            Ready to see it in action?
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg">
                Get started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/demo-request">
              <Button variant="secondary" size="lg">Request a Demo</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
