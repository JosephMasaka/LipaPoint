import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Building2 } from "lucide-react";

const tiers = [
  {
    name: "Lite",
    price: "$29",
    icon: Zap,
    current: false,
    features: ["1 Location", "3 Users", "Basic Reporting", "Email Support"],
  },
  {
    name: "Pro",
    price: "$79",
    icon: Crown,
    current: true,
    features: [
      "5 Locations",
      "Unlimited Users",
      "Advanced Analytics",
      "Inventory Sync",
      "Priority Support",
    ],
  },
  {
    name: "Enterprise",
    price: "$199",
    icon: Building2,
    current: false,
    features: [
      "Unlimited Locations",
      "Custom Integrations",
      "Dedicated Support",
      "Open API Access",
      "White-label Options",
      "SLA Guarantee",
    ],
  },
];

export default async function SettingsPage() {
  return (
    <div className="flex flex-col">
      <Header title="Settings" subtitle="Manage your subscription and preferences" />

      <div className="p-6 space-y-8">
        {/* Subscription Tiers */}
        <div>
          <h3 className="text-lg font-semibold text-zinc-100 mb-4">Subscription Plan</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tiers.map((tier) => (
              <Card
                key={tier.name}
                className={
                  tier.current
                    ? "border-gold/50 bg-gold/5 ring-1 ring-gold/20"
                    : ""
                }
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10">
                        <tier.icon className="h-4 w-4 text-gold" />
                      </div>
                      <CardTitle className="text-base">{tier.name}</CardTitle>
                    </div>
                    {tier.current && <Badge>Current</Badge>}
                  </div>
                  <CardDescription>
                    <span className="text-2xl font-bold text-zinc-100">{tier.price}</span>
                    <span className="text-zinc-500">/month</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-4">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-zinc-300">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={tier.current ? "secondary" : "default"}
                    className="w-full"
                    disabled={tier.current}
                  >
                    {tier.current ? "Current Plan" : "Upgrade"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
            <CardDescription>Update your business details and preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Business Name</label>
                <input
                  type="text"
                  defaultValue="Downtown Bistro"
                  className="flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus:ring-2 focus:ring-gold/50 focus:border-gold/50 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Business Type</label>
                <select className="flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus:ring-2 focus:ring-gold/50 outline-none transition-all">
                  <option value="restaurant">Restaurant</option>
                  <option value="retail">Retail</option>
                  <option value="bar">Bar</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Tax Rate (%)</label>
                <input
                  type="number"
                  defaultValue="16"
                  className="flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus:ring-2 focus:ring-gold/50 focus:border-gold/50 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Currency</label>
                <select className="flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus:ring-2 focus:ring-gold/50 outline-none transition-all">
                  <option value="USD">USD ($)</option>
                  <option value="KES">KES (KSh)</option>
                  <option value="EUR">EUR (&euro;)</option>
                  <option value="GBP">GBP (&pound;)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button>Save Changes</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
