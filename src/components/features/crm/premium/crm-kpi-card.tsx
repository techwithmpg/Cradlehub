"use client";

import { motion, useReducedMotion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { CrmStatCard, type CrmCardTone } from "@/components/features/crm/shared/crm-cards";
import { CountUpNumber } from "@/components/features/crm/today/count-up-number";
import { itemVariants, itemVariantsStill } from "./variants";

type CrmKpiCardProps = {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  tone?: CrmCardTone;
  /** Adds subtle emphasis when highlighted as the lead KPI */
  accent?: boolean;
  /** Reserved – future custom accent colour token */
  accentColor?: string;
  trend?: string;
  subtitle?: string;
  className?: string;
};

/**
 * Animated KPI card for CRM workspace sections, backed by canonical CrmStatCard.
 */
export function CrmKpiCard({
  label,
  value,
  icon: Icon,
  tone,
  accent,
  trend,
  subtitle,
  className,
}: CrmKpiCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const vars = shouldReduceMotion ? itemVariantsStill : itemVariants;
  const resolvedTone: CrmCardTone = tone ?? (accent ? "success" : "neutral");

  return (
    <motion.div
      variants={vars}
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      className="h-full"
    >
      <CrmStatCard
        title={label}
        value={typeof value === "number" ? <CountUpNumber value={value} /> : value}
        subtitle={subtitle ?? trend}
        icon={Icon ? <Icon className="size-4.5" aria-hidden="true" /> : undefined}
        tone={resolvedTone}
        className={className ? `h-full ${className}` : "h-full"}
      />
    </motion.div>
  );
}
