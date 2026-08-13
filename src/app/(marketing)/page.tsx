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

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-zinc-100 leading-[1.1] mb-6">
            Run Your Business
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold to-gold-light">
              Smarter with LipaPoint
            </span>
          </h1>

          <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10">
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
      <section className="py-12 border-y border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-gold">{stat.value}</p>
              <p className="text-sm text-zinc-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Industries */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-zinc-100 mb-3">
              Built for Every Industry
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              From mama mboga to supermarkets, LipaPoint adapts to your business type.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {industries.map((ind) => (
              <div
                key={ind.name}
                className="flex flex-col items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 hover:border-gold/30 transition-colors"
              >
                <ind.icon className="h-6 w-6 text-gold" />
                <span className="text-xs font-medium text-zinc-300 text-center">
                  {ind.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section className="py-20 px-6 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-zinc-100 mb-3">
              Everything You Need to Grow
            </h2>
            <p className="text-zinc-400">
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
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-zinc-700 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
                  <f.icon className="h-5 w-5 text-gold" />
                </div>
                <h3 className="text-base font-semibold text-zinc-100 mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-zinc-100 mb-4">
            Ready to Transform Your Business?
          </h2>
          <p className="text-zinc-400 mb-8">
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
