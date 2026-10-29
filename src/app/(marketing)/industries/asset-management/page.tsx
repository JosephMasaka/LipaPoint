import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Package, Users, Shield, Banknote } from "lucide-react";

export const metadata: Metadata = {
  title: "LipaPoint for Asset Management — Track Your Equipment and Inventory",
  description:
    "LipaPoint's asset management solution: track equipment, vehicles, and fixed assets across all your business locations.",
  alternates: { canonical: "https://lipapoint.co.ke/industries/asset-management" },
  openGraph: {
    title: "LipaPoint Asset Management — Equipment and Inventory Tracking",
    description:
      "Track equipment, vehicles, and fixed assets across all your business locations with real-time visibility.",
    url: "https://lipapoint.co.ke/industries/asset-management",
  },
};

export default function AssetManagementIndustryPage() {
  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            Built for Asset Management
          </h1>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            Track your company&apos;s equipment, vehicles, and fixed assets with real-time
            visibility and comprehensive reporting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Package className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Asset Registry
            </h3>
            <p className="text-text-secondary">
              Create a centralized registry for all your equipment, vehicles, and
              fixed assets. Assign assets to locations and tag them for easy
              identification.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Users className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Assignment & Tracking
            </h3>
            <p className="text-text-secondary">
              Assign assets to employees or locations. Track location history,
              status changes, and maintenance schedules in real time.
            </p>
          </div>

          <div className="rounded-2xl border-border bg-surface-elevated p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
              <Banknote className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Depreciation & Valuation
            </h3>
            <p className="text-text-secondary">
              Automatically calculate depreciation based on asset type and age.
              Track current value and plan for asset replacement or disposal.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border-border bg-surface-elevated p-8">
          <h3 className="text-2xl font-bold text-text-primary mb-4">
            Multi-Location Visibility
          </h3>
          <p className="text-text-secondary mb-6">
            View asset status across all your business locations. Compare asset
            utilization and identify underutilized or redundant equipment.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-semibold">Locations</p>
              <p className="text-lg text-text-secondary">All locations</p>
            </div>
            <div>
              <p className="font-semibold">Assets tracked</p>
              <p className="text-lg text-text-secondary">Real-time</p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link href="/register">
            <Button size="lg">Get started</Button>
          </Link>
          <p className="mt-4">
            <Link href="/pricing?category=ASSET_MANAGEMENT" className="text-sm text-gold hover:underline">
              See Asset Management pricing →
            </Link>
          </p>
          <p className="mt-4 text-sm text-text-muted">
            Sign up with M-Pesa — apply your coupon code at sign-up.
          </p>
        </div>
      </div>
    </section>
  );
}