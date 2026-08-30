"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import { Header } from "@/components/header";
import { formatCurrency } from "@/lib/utils";
import {
  Globe,
  Copy,
  Check,
  QrCode,
  Clock,
  Truck,
  ShoppingBag,
  UtensilsCrossed,
  Share2,
  ExternalLink,
  CheckCircle,
} from "lucide-react";

// ---- Types ----

interface Product {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  categoryId: string | null;
  category: { id: string; name: string; color: string } | null;
}

// ---- Component ----

export default function OnlineOrderingPage() {
  const pathname = usePathname();
  const tenantSlug = pathname.split("/")[1] || "";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Local configuration state (UI-ready, no backend persistence)
  const [isEnabled, setIsEnabled] = useState(false);
  const [orderTypes, setOrderTypes] = useState({
    pickup: true,
    delivery: false,
    dineIn: true,
  });
  const [minimumOrder, setMinimumOrder] = useState("");
  const [copied, setCopied] = useState(false);

  // Notification
  const [notification, setNotification] = useState<{
    type: string;
    message: string;
  } | null>(null);

  const notify = useCallback((type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const storefrontUrl = `https://order.lipapoint.com/${tenantSlug}`;

  // ---- Data fetching ----

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();
        if (Array.isArray(data)) {
          setProducts(data.filter((p: Product) => p.isActive));
        }
      } catch {
        notify("error", "Failed to load menu items");
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [notify]);

  // ---- Helpers ----

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(storefrontUrl);
      setCopied(true);
      notify("success", "Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify("error", "Failed to copy link");
    }
  };

  const toggleOrderType = (key: keyof typeof orderTypes) => {
    setOrderTypes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Group products by category
  const groupedProducts = products.reduce<
    Record<string, { name: string; color: string; items: Product[] }>
  >((acc, product) => {
    const key = product.category?.id || "uncategorized";
    if (!acc[key]) {
      acc[key] = {
        name: product.category?.name || "Other",
        color: product.category?.color || "#6b7280",
        items: [],
      };
    }
    acc[key].items.push(product);
    return acc;
  }, {});

  // ---- Render ----

  if (loading) {
    return (
      <div>
        <Header
          title="Online Ordering"
          subtitle="Configure your online storefront"
        />
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
          <Loader
            size="lg"
            label="Loading..."
            className="min-h-[60vh]"
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Online Ordering"
        subtitle="Configure your online storefront"
      />

      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm ${
            notification.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        {/* Status Card */}
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-xl ${
                    isEnabled
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-surface-hover text-text-muted"
                  }`}
                >
                  <Globe className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">
                    Online Ordering
                  </h2>
                  <p className="text-sm text-text-secondary mt-0.5">
                    {isEnabled
                      ? "Your online storefront is live"
                      : "Enable to start accepting online orders"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={isEnabled ? "success" : "secondary"}>
                  {isEnabled ? "Enabled" : "Disabled"}
                </Badge>
                <label className="relative inline-flex cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => setIsEnabled(!isEnabled)}
                    className="sr-only peer"
                  />
                  <div className="h-6 w-11 rounded-full bg-surface-hover peer-checked:bg-gold transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5" />
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Storefront Link */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-gold" />
              Storefront Link
            </CardTitle>
            <CardDescription>
              Share this link with customers to order online
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={storefrontUrl}
                  readOnly
                  className="w-full h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-secondary focus:outline-none"
                />
              </div>
              <Button
                variant={copied ? "success" : "outline"}
                onClick={copyLink}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Link
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Settings grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Order Types */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-gold" />
                Order Types
              </CardTitle>
              <CardDescription>
                Choose which order types to accept
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  key: "pickup" as const,
                  label: "Pickup",
                  desc: "Customer collects from your location",
                  icon: ShoppingBag,
                },
                {
                  key: "delivery" as const,
                  label: "Delivery",
                  desc: "Deliver to the customer's address",
                  icon: Truck,
                },
                {
                  key: "dineIn" as const,
                  label: "Dine-in",
                  desc: "Order ahead and eat at your restaurant",
                  icon: UtensilsCrossed,
                },
              ].map((type) => (
                <div
                  key={type.key}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <type.icon className="h-4 w-4 text-text-muted" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {type.label}
                      </p>
                      <p className="text-xs text-text-muted">{type.desc}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer">
                    <input
                      type="checkbox"
                      checked={orderTypes[type.key]}
                      onChange={() => toggleOrderType(type.key)}
                      className="sr-only peer"
                    />
                    <div className="h-5 w-9 rounded-full bg-surface-hover peer-checked:bg-gold transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Operating Hours */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gold" />
                Operating Hours
              </CardTitle>
              <CardDescription>
                When online orders can be placed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                  "Sunday",
                ].map((day) => (
                  <div
                    key={day}
                    className="flex items-center justify-between py-1.5 px-3 rounded-lg text-sm"
                  >
                    <span className="text-text-secondary font-medium">
                      {day}
                    </span>
                    <span className="text-text-muted">
                      8:00 AM - 10:00 PM
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-text-muted mt-3">
                Custom hours coming soon. Currently set to default schedule.
              </p>
            </CardContent>
          </Card>

          {/* Minimum Order */}
          <Card>
            <CardHeader>
              <CardTitle>Minimum Order Amount</CardTitle>
              <CardDescription>
                Set a minimum order value for online orders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                label="Minimum Amount (KSh)"
                type="number"
                placeholder="0"
                value={minimumOrder}
                onChange={(e) => setMinimumOrder(e.target.value)}
              />
              <p className="text-xs text-text-muted mt-2">
                {minimumOrder && parseFloat(minimumOrder) > 0
                  ? `Customers must order at least ${formatCurrency(parseFloat(minimumOrder))}`
                  : "No minimum order amount set"}
              </p>
            </CardContent>
          </Card>

          {/* QR Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-gold" />
                QR Code
              </CardTitle>
              <CardDescription>
                QR code for your online menu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-6 rounded-lg border border-dashed border-border bg-surface/50">
                <QrCode className="h-16 w-16 text-text-muted mb-3 opacity-40" />
                <p className="text-sm text-text-muted text-center">
                  QR code will be generated when online ordering is enabled
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled={!isEnabled}
                >
                  Download QR Code
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Share Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-gold" />
              Share Your Menu
            </CardTitle>
            <CardDescription>
              Spread the word about your online ordering
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Copy className="h-4 w-4 mr-1.5" />
                Copy Link
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `https://wa.me/?text=${encodeURIComponent(`Order online from us: ${storefrontUrl}`)}`,
                    "_blank"
                  )
                }
              >
                WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Order online from us: ${storefrontUrl}`)}`,
                    "_blank"
                  )
                }
              >
                Twitter / X
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(storefrontUrl)}`,
                    "_blank"
                  )
                }
              >
                Facebook
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Menu Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Menu Preview</CardTitle>
            <CardDescription>
              {products.length} active item{products.length !== 1 ? "s" : ""}{" "}
              will appear on your online menu
            </CardDescription>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <div className="text-center py-8">
                <UtensilsCrossed className="h-10 w-10 text-text-muted mx-auto mb-2 opacity-30" />
                <p className="text-sm text-text-muted">
                  No active menu items. Add items from Menu Management.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedProducts)
                  .sort(([, a], [, b]) => a.name.localeCompare(b.name))
                  .map(([key, group]) => (
                    <div key={key}>
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: group.color }}
                        />
                        <h4 className="text-sm font-semibold text-text-primary">
                          {group.name}
                        </h4>
                        <span className="text-xs text-text-muted">
                          ({group.items.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {group.items
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between rounded-lg border border-border p-3"
                            >
                              <span className="text-sm text-text-primary truncate">
                                {item.name}
                              </span>
                              <span className="text-sm font-medium text-gold shrink-0 ml-3">
                                {formatCurrency(item.price)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
