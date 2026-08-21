"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authSlug, setAuthSlug] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.tenant?.slug) setAuthSlug(d.user.tenant.slug);
      })
      .catch(() => {});
  }, []);

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
            {authSlug ? (
              <Link href={`/${authSlug}/dashboard`}>
                <Button size="sm">Go to Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/50 py-12" role="contentinfo">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Store className="h-5 w-5 text-gold" />
                <span className="font-bold text-text-primary">LipaPoint</span>
              </div>
              <p className="text-sm text-text-muted">
                Kenya&apos;s #1 Point of Sale system for restaurants, bars, retail shops, supermarkets and pharmacies.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-3">POS Solutions</h4>
              <nav aria-label="Product navigation" className="space-y-2">
                <Link href="/features" className="block text-sm text-text-muted hover:text-text-secondary">POS Features</Link>
                <Link href="/pricing" className="block text-sm text-text-muted hover:text-text-secondary">POS Pricing</Link>
                <Link href="/demo-request" className="block text-sm text-text-muted hover:text-text-secondary">Request Free Demo</Link>
                <Link href="/register" className="block text-sm text-text-muted hover:text-text-secondary">Start Free Trial</Link>
              </nav>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-3">Industries</h4>
              <nav aria-label="Industries navigation" className="space-y-2">
                <span className="block text-sm text-text-muted">Restaurant POS</span>
                <span className="block text-sm text-text-muted">Bar & Lounge POS</span>
                <span className="block text-sm text-text-muted">Retail Shop POS</span>
                <span className="block text-sm text-text-muted">Supermarket POS</span>
                <span className="block text-sm text-text-muted">Pharmacy POS</span>
              </nav>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-3">Contact</h4>
              <address className="space-y-2 not-italic">
                <Link href="/contact" className="block text-sm text-text-muted hover:text-text-secondary">Contact Us</Link>
                <a href="mailto:lipapoint@tunzaassets.co.ke" className="block text-sm text-text-muted hover:text-text-secondary">lipapoint@tunzaassets.co.ke</a>
                <a href="tel:+254791298382" className="block text-sm text-text-muted hover:text-text-secondary">+254 791 298 382</a>
                <span className="block text-sm text-text-muted">Nairobi, Kenya</span>
              </address>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-text-muted">&copy; 2026 LipaPoint. All rights reserved.</p>
            <p className="text-xs text-text-muted">
              POS System Kenya | Point of Sale Software | M-Pesa POS
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
