import Link from "next/link";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-surface/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10">
              <Store className="h-5 w-5 text-gold" />
            </div>
            <span className="text-lg font-bold text-text-primary">LipaPoint</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/features" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              Features
            </Link>
            <Link href="/pricing" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              Pricing
            </Link>
            <Link href="/contact" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              Contact
            </Link>
            <Link href="/demo-request" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
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

      <footer className="border-t border-border/50 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Store className="h-5 w-5 text-gold" />
                <span className="font-bold text-text-primary">LipaPoint</span>
              </div>
              <p className="text-sm text-text-muted">
                Enterprise-grade POS system built for Kenyan businesses.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-3">Product</h4>
              <div className="space-y-2">
                <Link href="/features" className="block text-sm text-text-muted hover:text-text-secondary">Features</Link>
                <Link href="/pricing" className="block text-sm text-text-muted hover:text-text-secondary">Pricing</Link>
                <Link href="/demo-request" className="block text-sm text-text-muted hover:text-text-secondary">Request Demo</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-3">Company</h4>
              <div className="space-y-2">
                <Link href="/contact" className="block text-sm text-text-muted hover:text-text-secondary">Contact</Link>
                <span className="block text-sm text-text-muted">Terms of Service</span>
                <span className="block text-sm text-text-muted">Privacy Policy</span>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-3">Support</h4>
              <div className="space-y-2">
                <span className="block text-sm text-text-muted">help@lipapoint.co.ke</span>
                <span className="block text-sm text-text-muted">+254 700 123 456</span>
                <span className="block text-sm text-text-muted">Nairobi, Kenya</span>
              </div>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-6 text-center">
            <p className="text-xs text-text-muted">&copy; 2026 LipaPoint. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
