"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

/** Shared by the desktop bar and the mobile dropdown so the two can never
 *  drift — below `md` the desktop nav is hidden, the dropdown is the only
 *  way to reach these links. */
const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/industries", label: "Industries" },
  { href: "/contact", label: "Contact" },
  { href: "/demo-request", label: "Request Demo" },
] as const;

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authSlug, setAuthSlug] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Navigating (from the dropdown or anywhere else) closes it, so a tap on
  // a link never leaves the panel open over the page you just opened.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
              <Logo size={22} className="text-gold" />
            </div>
            <span className="text-lg font-bold text-text-primary">LipaPoint</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-gold/30 transition-colors"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="marketing-mobile-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
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

        {menuOpen && (
          <nav
            id="marketing-mobile-nav"
            aria-label="Main navigation"
            className="md:hidden border-t border-border/50 bg-surface px-4 py-3 space-y-1"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-elevated hover:text-text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {authSlug && (
              <Link
                href={`/${authSlug}/dashboard`}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-gold hover:bg-gold/10 transition-colors"
              >
                Go to Dashboard
              </Link>
            )}
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/50 py-12" role="contentinfo">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Logo size={22} className="text-gold" />
                <span className="font-bold text-text-primary">LipaPoint</span>
              </div>
              <p className="text-sm text-text-muted">
                Kenya&apos;s all-in-one ERP: point of sale, inventory, payroll, finance, assets and eTIMS — for restaurants, bars, retail shops, supermarkets and pharmacies.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-3">ERP Solutions</h4>
              <nav aria-label="Product navigation" className="space-y-2">
                <Link href="/features" className="block text-sm text-text-muted hover:text-text-secondary">ERP Features</Link>
                <Link href="/pricing" className="block text-sm text-text-muted hover:text-text-secondary">ERP Pricing</Link>
                <Link href="/demo-request" className="block text-sm text-text-muted hover:text-text-secondary">Request Free Demo</Link>
                <Link href="/register" className="block text-sm text-text-muted hover:text-text-secondary">Get started</Link>
              </nav>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-3">Industries</h4>
              <nav aria-label="Industries navigation" className="space-y-2">
                <span className="block text-sm text-text-muted">Restaurant & Hospitality</span>
                <span className="block text-sm text-text-muted">Bar & Lounge</span>
                <span className="block text-sm text-text-muted">Retail Shop</span>
                <span className="block text-sm text-text-muted">Supermarket</span>
                <span className="block text-sm text-text-muted">Pharmacy</span>
                <span className="block text-sm text-text-muted">Barbershop & Salon</span>
                <span className="block text-sm text-text-muted">HR & Payroll</span>
                <span className="block text-sm text-text-muted">Asset Management</span>
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
              ERP System Kenya | Point of Sale Software | M-Pesa Integration
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
