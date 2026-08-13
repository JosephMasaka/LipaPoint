import Link from "next/link";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <header className="sticky top-0 z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10">
              <Store className="h-5 w-5 text-gold" />
            </div>
            <span className="text-lg font-bold text-zinc-100">LipaPoint</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/features" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
              Features
            </Link>
            <Link href="/pricing" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
              Pricing
            </Link>
            <Link href="/contact" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
              Contact
            </Link>
            <Link href="/demo-request" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
              Request Demo
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-zinc-800/50 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Store className="h-5 w-5 text-gold" />
                <span className="font-bold text-zinc-100">LipaPoint</span>
              </div>
              <p className="text-sm text-zinc-500">
                Enterprise-grade POS system built for Kenyan businesses.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-zinc-200 mb-3">Product</h4>
              <div className="space-y-2">
                <Link href="/features" className="block text-sm text-zinc-500 hover:text-zinc-300">Features</Link>
                <Link href="/pricing" className="block text-sm text-zinc-500 hover:text-zinc-300">Pricing</Link>
                <Link href="/demo-request" className="block text-sm text-zinc-500 hover:text-zinc-300">Request Demo</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-zinc-200 mb-3">Company</h4>
              <div className="space-y-2">
                <Link href="/contact" className="block text-sm text-zinc-500 hover:text-zinc-300">Contact</Link>
                <span className="block text-sm text-zinc-500">Terms of Service</span>
                <span className="block text-sm text-zinc-500">Privacy Policy</span>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-zinc-200 mb-3">Support</h4>
              <div className="space-y-2">
                <span className="block text-sm text-zinc-500">help@lipapoint.co.ke</span>
                <span className="block text-sm text-zinc-500">+254 700 123 456</span>
                <span className="block text-sm text-zinc-500">Nairobi, Kenya</span>
              </div>
            </div>
          </div>
          <div className="border-t border-zinc-800 mt-8 pt-6 text-center">
            <p className="text-xs text-zinc-600">&copy; 2026 LipaPoint. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
