"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import {
  Store, CreditCard, Bell, Shield,
  Receipt, Save, CheckCircle, Check, Smartphone
} from "lucide-react";

interface TenantSettings {
  name: string;
  slug: string;
  type: string;
  tier: string;
  currency: string;
  taxRate: number;
  receiptHeader: string;
  receiptFooter: string;
  isActive: boolean;
  mpesaPaybill?: string;
  mpesaTill?: string;
  mpesaAccountName?: string;
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<TenantSettings>({
    name: "",
    slug: "",
    type: "RETAIL",
    tier: "STARTER",
    currency: "KES",
    taxRate: 16,
    receiptHeader: "",
    receiptFooter: "Thank you for shopping with us!",
    isActive: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [upgradingTier, setUpgradingTier] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const tierOrder = useMemo(() => ({ STARTER: 0, PROFESSIONAL: 1, ENTERPRISE: 2 }) as Record<string, number>, []);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) setSettings(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const upgraded = searchParams.get("upgraded");
    const reference = searchParams.get("reference") || searchParams.get("trxref");
    if (upgraded && reference) {
      setActiveTab("billing");
      fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setSettings((s) => ({ ...s, tier: data.tier }));
            notify("success", `Successfully upgraded to ${data.tier.toLowerCase()} plan!`);
          } else {
            notify("error", data.error || "Payment verification failed");
          }
        })
        .catch(() => notify("error", "Failed to verify payment"))
        .finally(() => window.history.replaceState({}, "", window.location.pathname));
    } else if (upgraded) {
      setActiveTab("billing");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      notify("error", "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "general", label: "General", icon: Store },
    { id: "payments", label: "Payments", icon: Smartphone },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "receipts", label: "Receipts", icon: Receipt },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Shield },
  ];

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 pt-12 lg:pt-6 max-w-4xl mx-auto">
        <Loader size="lg" label="Loading settings..." className="min-h-[60vh]" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-12 lg:pt-6 max-w-4xl mx-auto space-y-6 relative overflow-x-hidden">
      {notification && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm ${notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
          <p className="text-sm text-text-muted mt-1">Manage your business configuration</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saved ? <><CheckCircle className="h-4 w-4 mr-2" /> Saved</> : <><Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save Changes"}</>}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border pb-px scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-surface-elevated text-gold border-b-2 border-gold"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* General */}
      {activeTab === "general" && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>Basic details about your business</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="Business Name"
                  value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                />
                <Input
                  label="URL Slug"
                  value={settings.slug}
                  onChange={(e) => setSettings({ ...settings, slug: e.target.value })}
                  disabled
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Business Type</label>
                  <select
                    value={settings.type}
                    onChange={(e) => setSettings({ ...settings, type: e.target.value })}
                    className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2.5 text-sm text-text-primary"
                  >
                    <option value="RETAIL">Retail Shop</option>
                    <option value="RESTAURANT">Restaurant</option>
                    <option value="BAR">Bar & Lounge</option>
                    <option value="SUPERMARKET">Supermarket</option>
                    <option value="PHARMACY">Pharmacy</option>
                    <option value="HARDWARE">Hardware Store</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Currency</label>
                  <select
                    value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                    className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2.5 text-sm text-text-primary"
                  >
                    <option value="KES">KES - Kenya Shilling</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="UGX">UGX - Uganda Shilling</option>
                    <option value="TZS">TZS - Tanzania Shilling</option>
                  </select>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="Tax Rate (%)"
                  type="number"
                  value={settings.taxRate.toString()}
                  onChange={(e) => setSettings({ ...settings, taxRate: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payments */}
      {activeTab === "payments" && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>M-Pesa (Till / Paybill)</CardTitle>
              <CardDescription>
                Displayed at checkout so customers can pay directly — no Safaricom API setup required.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="Paybill Number"
                  value={settings.mpesaPaybill ?? ""}
                  onChange={(e) => setSettings({ ...settings, mpesaPaybill: e.target.value })}
                  placeholder="e.g. 400200"
                />
                <Input
                  label="Till Number"
                  value={settings.mpesaTill ?? ""}
                  onChange={(e) => setSettings({ ...settings, mpesaTill: e.target.value })}
                  placeholder="e.g. 5123456"
                />
              </div>
              <Input
                label="Account / Business Name"
                value={settings.mpesaAccountName ?? ""}
                onChange={(e) => setSettings({ ...settings, mpesaAccountName: e.target.value })}
                placeholder="Name shown to the customer for the paybill account"
              />
              <p className="text-xs text-text-muted">
                At checkout, staff will select &quot;M-Pesa&quot; and enter the confirmation code
                the customer reads from their SMS receipt.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Automatic Prompt (STK Push)</CardTitle>
              <CardDescription>
                Connect a payment aggregator to push an M-Pesa prompt directly to the customer&apos;s phone.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {[
                { id: "INTASEND", name: "IntaSend", desc: "Fast signup, no Safaricom paperwork" },
                { id: "PESAPAL", name: "Pesapal", desc: "Popular with East African merchants" },
                { id: "KOPOKOPO", name: "Kopo Kopo", desc: "M-Pesa-native, Kenya-focused" },
                { id: "DARAJA", name: "Safaricom Daraja (Direct)", desc: "Requires full business registration with Safaricom" },
              ].map((gw) => (
                <div key={gw.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{gw.name}</p>
                    <p className="text-xs text-text-muted mt-0.5">{gw.desc}</p>
                  </div>
                  <Button variant="outline" size="sm">Connect</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Billing */}
      {activeTab === "billing" && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Plan</CardTitle>
              <CardDescription>Your current plan and billing details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated/50 p-5 mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-text-primary capitalize">{settings.tier.toLowerCase()} Plan</h3>
                    <Badge variant="success">Active</Badge>
                  </div>
                  <p className="text-sm text-text-secondary">
                    {settings.tier === "STARTER" && "KSh 2,999/month"}
                    {settings.tier === "PROFESSIONAL" && "KSh 7,999/month"}
                    {settings.tier === "ENTERPRISE" && "KSh 19,999/month"}
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { tier: "STARTER", price: "2,999", features: ["Up to 100 products", "1 location", "2 staff", "Basic reports"] },
                  { tier: "PROFESSIONAL", price: "7,999", features: ["Unlimited products", "3 locations", "10 staff", "Advanced analytics", "Priority support"] },
                  { tier: "ENTERPRISE", price: "19,999", features: ["Unlimited everything", "Unlimited locations", "Unlimited staff", "Custom reports", "Dedicated support", "API access"] },
                ].map((plan) => (
                  <div
                    key={plan.tier}
                    className={`rounded-lg border p-5 space-y-3 ${settings.tier === plan.tier ? "border-gold bg-gold/5" : "border-border"}`}
                  >
                    <div>
                      <h4 className="font-bold text-text-primary capitalize">{plan.tier.toLowerCase()}</h4>
                      <p className="text-lg font-bold text-gold">KSh {plan.price}<span className="text-xs text-text-muted font-normal">/mo</span></p>
                    </div>
                    <ul className="space-y-1.5">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs text-text-secondary">
                          <Check className="h-3 w-3 text-gold shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                    {settings.tier === plan.tier ? (
                      <Badge variant="success" className="w-full justify-center">Current Plan</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant={(tierOrder[plan.tier] || 0) > (tierOrder[settings.tier] || 0) ? "default" : "outline"}
                        className="w-full"
                        disabled={upgradingTier === plan.tier}
                        onClick={async () => {
                          setUpgradingTier(plan.tier);
                          try {
                            const res = await fetch("/api/paystack/subscribe", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ tier: plan.tier }),
                            });
                            const data = await res.json();
                            if (data.url) {
                              window.location.href = data.url;
                            } else {
                              notify("error", data.error || "Failed to initiate upgrade");
                              setUpgradingTier(null);
                            }
                          } catch {
                            notify("error", "Network error");
                            setUpgradingTier(null);
                          }
                        }}
                      >
                        {upgradingTier === plan.tier ? (
                          <Loader size="sm" />
                        ) : (tierOrder[plan.tier] || 0) > (tierOrder[settings.tier] || 0) ? "Upgrade" : "Switch"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Receipts */}
      {activeTab === "receipts" && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Receipt Customization</CardTitle>
              <CardDescription>Customize what appears on printed receipts</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Receipt Header</label>
                <textarea
                  value={settings.receiptHeader}
                  onChange={(e) => setSettings({ ...settings, receiptHeader: e.target.value })}
                  rows={3}
                  placeholder="e.g. Business name, address, phone..."
                  className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Receipt Footer</label>
                <textarea
                  value={settings.receiptFooter}
                  onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                  rows={2}
                  placeholder="e.g. Thank you for shopping with us!"
                  className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none"
                />
              </div>
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Show &quot;Served by&quot; on receipts</p>
                    <p className="text-xs text-text-muted mt-0.5">Display the cashier/staff name who processed the sale</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="h-5 w-9 rounded-full bg-surface-hover peer-checked:bg-gold transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                </div>
              </div>
              {/* Receipt Preview */}
              <div className="rounded-lg border border-border bg-surface-elevated/50 p-6 font-mono text-xs text-text-secondary text-center space-y-1">
                <p className="font-bold text-text-primary">{settings.receiptHeader || settings.name}</p>
                <p>================================</p>
                <p className="text-left">Served by: Cashier Name</p>
                <p>================================</p>
                <p className="text-left">Item 1 x2 ........ KSh 1,000</p>
                <p className="text-left">Item 2 x1 .......... KSh 300</p>
                <p>================================</p>
                <p className="text-left">Subtotal .......... KSh 1,300</p>
                <p className="text-left">VAT ({settings.taxRate}%) ........ KSh {Math.round(1300 * settings.taxRate / 100)}</p>
                <p>================================</p>
                <p className="font-bold text-text-primary">TOTAL: KSh {Math.round(1300 * (1 + settings.taxRate / 100)).toLocaleString()}</p>
                {(settings.mpesaPaybill || settings.mpesaTill) && (
                  <>
                    <p>--------------------------------</p>
                    {settings.mpesaPaybill && <p>Paybill: {settings.mpesaPaybill}</p>}
                    {settings.mpesaTill && <p>Till No: {settings.mpesaTill}</p>}
                  </>
                )}
                <p className="mt-2 italic">{settings.receiptFooter}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Notifications */}
      {activeTab === "notifications" && (
        <NotificationsTab notify={notify} />
      )}

      {/* Security */}
      {activeTab === "security" && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Manage access and security for your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Two-Factor Authentication</p>
                    <p className="text-xs text-text-muted mt-0.5">Add extra security to your account</p>
                  </div>
                  <Button variant="outline" size="sm">Enable</Button>
                </div>
              </div>
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Session Timeout</p>
                    <p className="text-xs text-text-muted mt-0.5">Automatically log out after inactivity</p>
                  </div>
                  <select className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-text-primary">
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="480">8 hours</option>
                    <option value="0">Never</option>
                  </select>
                </div>
              </div>
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Change Password</p>
                    <p className="text-xs text-text-muted mt-0.5">Update your account password</p>
                  </div>
                  <Button variant="outline" size="sm">Change</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

const NOTIF_PREFS_KEY = "lipapoint-notification-prefs";
const NOTIF_OPTIONS = [
  { key: "lowStock", label: "Low stock alerts", desc: "Get notified when product stock falls below threshold" },
  { key: "dailySummary", label: "Daily sales summary", desc: "Receive end-of-day sales report via email" },
  { key: "newOrder", label: "New order notifications", desc: "Alert when a new order is placed" },
  { key: "paymentFailure", label: "Payment failures", desc: "Get notified about failed subscription payments" },
];

function NotificationsTab({ notify }: { notify: (type: string, msg: string) => void }) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem(NOTIF_PREFS_KEY);
      return saved ? JSON.parse(saved) : { lowStock: true, dailySummary: true, newOrder: true, paymentFailure: true };
    } catch { return { lowStock: true, dailySummary: true, newOrder: true, paymentFailure: true }; }
  });
  const [browserEnabled, setBrowserEnabled] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      setBrowserEnabled(Notification.permission === "granted");
    }
  }, []);

  const togglePref = (key: string) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(updated));
    notify("success", "Preference saved");
  };

  const enableBrowserNotifications = async () => {
    if (!("Notification" in window)) {
      notify("error", "Browser notifications not supported");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setBrowserEnabled(true);
      notify("success", "Browser notifications enabled");
      new Notification("LipaPoint", { body: "Notifications are now active!", icon: "/icons/icon-192.svg" });
    } else {
      notify("error", "Notification permission denied");
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Browser Notifications</CardTitle>
          <CardDescription>Enable system notifications for real-time alerts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-text-primary">Push notifications</p>
              <p className="text-xs text-text-muted mt-0.5">
                {browserEnabled ? "Enabled - you will receive desktop alerts" : "Enable to get real-time alerts on this device"}
              </p>
            </div>
            {browserEnabled ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Button size="sm" onClick={enableBrowserNotifications}>Enable</Button>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Email Notification Preferences</CardTitle>
          <CardDescription>Choose what email alerts you receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {NOTIF_OPTIONS.map((n) => (
            <div key={n.key} className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium text-text-primary">{n.label}</p>
                <p className="text-xs text-text-muted mt-0.5">{n.desc}</p>
              </div>
              <label className="relative inline-flex cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs[n.key] !== false}
                  onChange={() => togglePref(n.key)}
                  className="sr-only peer"
                />
                <div className="h-5 w-9 rounded-full bg-surface-hover peer-checked:bg-gold transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
