import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const moduleBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors border",
  {
    variants: {
      variant: {
        tier: "bg-gold/10 text-gold border-gold/20",
        backoffice: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        commerce: "bg-sky-500/10 text-sky-400 border-sky-500/20",
        default: "bg-surface-hover text-text-secondary border-border",
        enabled: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
        disabled: "bg-surface-elevated/60 text-text-muted border-border/60",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface ModuleBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof moduleBadgeVariants> {}

function ModuleBadge({
  className,
  variant,
  ...props
}: ModuleBadgeProps) {
  return (
    <div
      className={cn(moduleBadgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { ModuleBadge, moduleBadgeVariants };
