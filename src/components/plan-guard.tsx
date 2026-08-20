"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface PlanStatus {
  tier: string;
  expired: boolean;
  readonly: boolean;
  trial: { expired: boolean; daysLeft: number | null };
  usage: {
    products: { used: number; limit: number; exceeded: boolean };
    locations: { used: number; limit: number; exceeded: boolean };
    staff: { used: number; limit: number; exceeded: boolean };
  };
}

const PlanContext = createContext<PlanStatus | null>(null);

export function usePlan() {
  return useContext(PlanContext);
}

export function PlanProvider({ children, tenantSlug }: { children: React.ReactNode; tenantSlug: string }) {
  const [plan, setPlan] = useState<PlanStatus | null>(null);

  useEffect(() => {
    fetch("/api/plan")
      .then(r => r.json())
      .then(data => { if (!data.error) setPlan(data); })
      .catch(() => {});
  }, []);

  return (
    <PlanContext.Provider value={plan}>
      {plan?.expired && <PlanExpiredBanner tenantSlug={tenantSlug} />}
      {plan && plan.trial.daysLeft !== null && plan.trial.daysLeft <= 3 && plan.trial.daysLeft > 0 && (
        <TrialWarningBanner daysLeft={plan.trial.daysLeft} tenantSlug={tenantSlug} />
      )}
      {children}
    </PlanContext.Provider>
  );
}

function PlanExpiredBanner({ tenantSlug }: { tenantSlug: string }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-[150] bg-red-500/95 text-white px-4 py-2.5 flex items-center justify-center gap-3 text-sm">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>Your plan has expired. You can view data but cannot create orders or modify records.</span>
      <Link href={`/${tenantSlug}/settings?tab=billing`}>
        <Button size="sm" variant="outline" className="border-white/40 text-white hover:bg-white/10 ml-2">
          <CreditCard className="h-3 w-3 mr-1" /> Renew Plan
        </Button>
      </Link>
    </div>
  );
}

function TrialWarningBanner({ daysLeft, tenantSlug }: { daysLeft: number; tenantSlug: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[150] bg-amber-500/95 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>Your trial ends in {daysLeft} day{daysLeft > 1 ? "s" : ""}. Subscribe to avoid interruption.</span>
      <Link href={`/${tenantSlug}/settings?tab=billing`}>
        <Button size="sm" variant="outline" className="border-white/40 text-white hover:bg-white/10">Subscribe</Button>
      </Link>
      <button onClick={() => setDismissed(true)} className="text-white/70 hover:text-white ml-1 text-xs">Dismiss</button>
    </div>
  );
}
