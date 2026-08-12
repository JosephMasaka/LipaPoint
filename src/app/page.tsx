import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Store, ArrowRight, Zap, Shield, Globe } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Nav */}
      <header className="border-b border-zinc-800/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10">
              <Store className="h-5 w-5 text-gold" />
            </div>
            <span className="text-lg font-bold text-zinc-100">LipaPoint</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/demo/dashboard" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
              Demo
            </Link>
            <Button size="sm">Get Started</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-4 py-1.5">
            <Zap className="h-3.5 w-3.5 text-gold" />
            <span className="text-xs font-medium text-gold">Enterprise-Grade POS Platform</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-zinc-100 leading-[1.1]">
            The POS system
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold to-gold-light">
              built for scale
            </span>
          </h1>

          <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Multi-tenant, offline-first point of sale platform designed for retail stores,
            restaurants, and bars. Real-time sync, advanced analytics, and premium experiences.
          </p>

          <div className="flex items-center justify-center gap-4 pt-4">
            <Link href="/demo/pos">
              <Button size="xl">
                Launch POS Demo
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/demo/dashboard">
              <Button variant="secondary" size="xl">
                View Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="max-w-5xl mx-auto mt-24 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Globe,
              title: "Multi-Tenant",
              description: "Isolated data per business. Support retail, restaurant, and bar configurations from one platform.",
            },
            {
              icon: Zap,
              title: "Offline-First",
              description: "Never lose a sale. Transactions persist locally and sync automatically when connectivity returns.",
            },
            {
              icon: Shield,
              title: "Enterprise Security",
              description: "Role-based access, audit logging, and compliance-ready tax calculations for every region.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 hover:border-zinc-700 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 mb-4">
                <feature.icon className="h-5 w-5 text-gold" />
              </div>
              <h3 className="text-base font-semibold text-zinc-100 mb-2">{feature.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 py-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <p className="text-xs text-zinc-600">LipaPoint Enterprise POS &copy; 2026</p>
          <div className="flex gap-4">
            <span className="text-xs text-zinc-600">Lite $29/mo</span>
            <span className="text-xs text-gold">Pro $79/mo</span>
            <span className="text-xs text-zinc-600">Enterprise $199/mo</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
