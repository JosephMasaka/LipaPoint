import * as React from "react";
import { cn } from "@/lib/utils";
import { ModuleBadge, type ModuleBadgeProps } from "./module-badge";

interface ModuleListItemProps {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Whether this module is currently enabled for the tenant. */
  enabled: boolean;
  /** Back-office vs commerce grouping so the list can group rows. */
  group?: "backoffice" | "commerce";
  /** Optional key shown under the module name, e.g. the module key token. */
  key?: string;
  /** Optional extra badge shown at the right end of the row. */
  rightBadge?: ModuleBadgeProps["variant"];
}

interface ModuleListProps {
  items: ModuleListItemProps[];
  className?: string;
}

export function ModuleList({ items, className }: ModuleListProps) {
  const grouped = React.useMemo(() => {
    const map = new Map<string, ModuleListItemProps[]>();
    for (const item of items) {
      const key = item.group ?? "commerce";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [items]);

  return (
    <div className={cn("space-y-1", className)}>
      {Array.from(grouped.entries()).map(([group, rows]) => (
        <div key={group}>
          <h3 className="px-3 pt-3 pb-1 text-xs font-medium uppercase tracking-wider text-text-muted">
            {group === "backoffice" ? "Back office" : "Commerce"}
          </h3>
          <div className="space-y-0.5 px-3">
            {rows.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors",
                  item.enabled
                    ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                    : "bg-surface-hover/40"
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      item.enabled
                        ? "text-emerald-500"
                        : "text-text-muted"
                    )}
                  />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium truncate",
                        item.enabled
                          ? "text-text-primary"
                          : "text-text-secondary"
                      )}
                    >
                      {item.label}
                    </p>
                    <p
                      className={cn(
                        "text-[11px] truncate",
                        item.enabled
                          ? "text-text-muted"
                          : "text-text-muted"
                      )}
                    >
                      {item.description}
                    </p>
                    {item.key && (
                      <p
                        className="font-mono text-[10px] text-text-muted"
                      >
                        module:{item.key}
                      </p>
                    )}
                  </div>
                </div>
                <ModuleBadge
                  variant={
                    item.enabled
                      ? "enabled"
                      : item.rightBadge ?? "disabled"
                  }
                >
                  {item.enabled ? (
                    <>
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M1.5 5L4.5 8L8.5 2"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {item.key ? `on (${item.key})` : "on"}
                    </>
                  ) : (
                    <>
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle
                          cx="5"
                          cy="5"
                          r="3.5"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M4.5 4.5L5.5 5.5L6.5 4.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {item.key ? `off (${item.key})` : "off"}
                    </>
                  )}
                </ModuleBadge>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
