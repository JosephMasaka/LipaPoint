"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Store, CreditCard, Bell, Shield,
  Receipt, Save, CheckCircle,
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
}

export default function SettingsPage() {
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) setSettings(data);
      })
      .catch(() => {});
  }, []);

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
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "general", label: "General", icon: Store },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "receipts", label: "Receipts", icon: Receipt },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Shield },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-14 lg:pt-8 max-w-4xl mx-auto space-y-6">
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

      {/* Billing */}
      {activeTab === "billing" && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Plan</CardTitle>
              <CardDescription>Your current plan and billing details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated/50 p-5">
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
                <Button variant="outline">Upgrade Plan</Button>
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
              {/* Receipt Preview */}
              <div className="rounded-lg border border-border bg-surface-elevated/50 p-6 font-mono text-xs text-text-secondary text-center space-y-1">
                <p className="font-bold text-text-primary">{settings.receiptHeader || settings.name}</p>
                <p>================================</p>
                <p>Item 1 ............ KSh 500</p>
                <p>Item 2 ............ KSh 300</p>
                <p>================================</p>
                <p className="font-bold text-text-primary">TOTAL: KSh 800</p>
                <p className="mt-2 italic">{settings.receiptFooter}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Notifications */}
      {activeTab === "notifications" && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose what alerts you receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Low stock alerts", desc: "Get notified when product stock falls below threshold" },
                { label: "Daily sales summary", desc: "Receive end-of-day sales report via email" },
                { label: "New order notifications", desc: "Alert when a new order is placed" },
                { label: "Payment failures", desc: "Get notified about failed subscription payments" },
              ].map((n) => (
                <div key={n.label} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{n.label}</p>
                    <p className="text-xs text-text-muted mt-0.5">{n.desc}</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="h-5 w-9 rounded-full bg-surface-hover peer-checked:bg-gold transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
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
