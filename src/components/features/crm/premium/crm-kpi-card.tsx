"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { CountUpNumber } from "@/components/features/crm/today/count-up-number";
import { itemVariants, itemVariantsStill } from "./variants";
import type { LucideIcon } from "lucide-react";

type CrmKpiCardProps = {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  /** Adds a top accent bar using --cs-sand */
  accent?: boolean;
  /** Reserved – future custom accent colour token */
  accentColor?: string;
  trend?: string;
  className?: string;
};

/**
 * Premium KPI card for CRM workspace sections.
 *
 * – Uses .cs-metric base class for surface/border/hover-shadow
 * – Participates in CrmMotionSection stagger (variants: hidden → visible)
 * – whileHover lifts 2 px when no reduced-motion preference
 * – CountUpNumber animates numeric values
 */
export function CrmKpiCard({
  label,
  value,
  icon: Icon,
  accent,
  trend,
  className,
}: CrmKpiCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const vars = shouldReduceMotion ? itemVariantsStill : itemVariants;

  return (
    <motion.div
      variants={vars}
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      className={cn(
        "cs-metric flex items-center gap-3",
        accent && "border-t-[3px] border-t-[var(--cs-sand)]",
        className
      )}
    >
      {Icon && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--cs-sand-mist)] text-[var(--cs-sand)]">
          <Icon size={16} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cs-text-muted)]">
          {label}
        </div>
        <div className="mt-0.5 text-lg font-semibold leading-tight text-[var(--cs-text)] tabular-nums">
          {typeof value === "number" ? (
            <CountUpNumber value={value} />
          ) : (
            value
          )}
        </div>
        {trend && (
          <div className="mt-0.5 text-[10.5px] text-[var(--cs-text-muted)]">
            {trend}
          </div>
        )}
      </div>
    </motion.div>
  );
}
