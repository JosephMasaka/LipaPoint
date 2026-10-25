"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { ModuleList } from "@/components/ui/module-list";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Calculator,
  Globe,
  HandCoins,
  Truck,
  Boxes,
  Users,
  X,
  Save,
} from "lucide-react";
import { getEnabledModules, isModuleEnabled, grantModule, revokeModule } from "@/lib/modules";
import type { ModuleKey } from "@/lib/modules";
import { SessionUser } from "@/lib/api-guards";
import { getSessionUser } from "@/lib/session-client";

interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "commerce" | "backoffice";
}

const MODULE_DEFS: ModuleDefinition[] = [
  {
    key: "pos",
    label: "Point of Sale",
    description: "Orders, tabs, kitchen display and receipts — the face of the business.",
    icon: LayoutDashboard,
    group: "commerce",
  },
  {
    key: "inventory",
    label: "Inventory & Stock",
    description: "Stock levels, movements, reorder alerts and stock valuation.",
    icon: Package,
    group: "commerce",
  },
  {
    key: "crm",
    label: "Customers & Loyalty",
    description: "Customer ledger, statements and loyalty points.",
    icon: Users,
    group: "commerce",
  },
  {
    key: "finance",
    label: "Finance / Accounting",
    description: "Chart of accounts, general ledger and bank & cash wallets.",
    icon: Calculator,
    group: "backoffice",
  },
  {
    key: "procurement",
    label: "Procurement & Suppliers",
    description: "Purchase orders, GRNs, supplier invoices and payments.",
    icon: Truck,
    group: "backoffice",
  },
  {
    key: "etims",
    label: "KRA eTIMS Tax Compliance",
    description: "Real-time OSCU invoice submission and compliance dashboard.",
    icon: Globe,
    group: "backoffice",
  },
  {
    key: "payroll",
    label: "Payroll",
    description: "Kenyan statutory payroll — PAYE/NSSF/SHIF/Housing Levy, P9, staff loans.",
    icon: HandCoins,
    group: "backoffice",
  },
  {
    key: "assets",
    label: "Asset Management",
    description: "Fixed asset register, straight-line depreciation and disposal.",
    icon: Boxes,
    group: "backoffice",
  },
];

type ChangeAction = "grant" | "revoke";

export default function ModulesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<Set<ModuleKey>>(new Set());
  const [user, setUser] = useState<SessionUser | null>(null);
  const [pendingChange, setPendingChange] = useState<{
    moduleKey: ModuleKey;
    action: ChangeAction;
    workId: string;
  } | null>(null);

  async function fetchState(user: SessionUser | null) {
    setLoading(true);
    setError(null);
    try {
      if (!user) {
        setEnabled(new Set() as Set<ModuleKey>);
        return;
      }
      const en = await getEnabledModules(user.tenantId);
      setEnabled(new Set(en) as Set<ModuleKey>);
      // Pre-load pending grants from the pending changes queue.
      if (pendingChange) {
        const stillEnabled = await isModuleEnabled(user.tenantId, pendingChange.moduleKey);
        setEnabled((prev) => {
          const next = new Set<ModuleKey>(prev);
          const key = pendingChange.moduleKey;
          if (pendingChange.action === "grant" && !stillEnabled) {
            next.add(key);
          } else if (pendingChange.action === "revoke" && stillEnabled) {
            next.delete(key);
          }
          return next;
        });
      }
    } catch (e) {
      setError("Failed to load module state. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getSessionUser().then((u: SessionUser | null) => {
      setUser(u);
      if (u) fetchState(u);
    });
  }, []);

  function pendingChangeKey(moduleKey: ModuleKey, action: ChangeAction): string {
    return `${moduleKey}:${action}`;
  }

  async function scheduleChange(moduleKey: ModuleKey, action: ChangeAction) {
    setPendingChange({ moduleKey, action, workId: pendingChangeKey(moduleKey, action) });
    try {
      await fetchState(user);
    } finally {
      setPendingChange(null);
    }
  }

  async function confirmChange() {
    if (!pendingChange || !user) return;
    const { moduleKey, action } = pendingChange;
    try {
      if (action === "grant") {
        await grantModule(user.tenantId, moduleKey);
      } else {
        await revokeModule(user.tenantId, moduleKey);
      }
      await fetchState(user);
    } catch (err) {
      setError("Could not update modules. Check the tenant has the correct permissions and try again.");
    } finally {
      setPendingChange(null);
    }
  }

  if (error && !loading && !enabled.size) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-text-muted">{error}</p>          <Button variant="outline" className="mt-4" onClick={() => getSessionUser().then((u) => fetchState(u))}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Module setup</h1>
          <p className="text-text-secondary">
            Give each ERP module its own on/off switch. Turn modules on or off per
            tenant — they work independently, and when all are on they form one
            unified system below it.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Back to dashboard
          </Link>
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader size="lg" label="Loading module setup..." />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-sky-500" />
                  Commerce modules
                </CardTitle>
                <p className="text-sm text-text-secondary">
                  Sales, stock, customers and loyalty. Each can be switched on or off
                  without affecting the back office.
                </p>
              </CardHeader>
              <CardContent>
                <ModuleList
                  items={MODULE_DEFS.filter((m) => m.group === "commerce").map((m) => ({
                    ...m,
                    enabled: enabled.has(m.key),
                    id: m.key,
                  }))}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Boxes className="h-5 w-5 text-emerald-500" />
                  Back-office modules
                </CardTitle>
                <p className="text-sm text-text-secondary">
                  Accounting, procurement, eTIMS, payroll and assets. All require
                  Finance, so Finance is the key you actually toggle first.
                </p>
              </CardHeader>
              <CardContent>
                <ModuleList
                  items={MODULE_DEFS.filter((m) => m.group === "backoffice").map((m) => ({
                    ...m,
                    enabled: enabled.has(m.key),
                    id: m.key,
                  }))}
                />
              </CardContent>
            </Card>
          </div>

          {pendingChange && (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-4">
                <div>
                  <p className="font-medium text-text-primary">
                    {pendingChange.action === "grant"
                      ? "Module turned on"
                      : "Module turned off"}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {pendingChange.moduleKey}{" "}
                    {pendingChange.action === "grant" ? "enabled" : "disabled"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPendingChange(null)}
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={confirmChange}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Confirm {pendingChange.action === "grant" ? "Enable" : "Disable"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
