"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { CS_EASE } from "./variants";

type CrmTableRowProps = {
  /** Row index – drives entrance stagger delay (capped at 7 × 40 ms = 280 ms) */
  index?: number;
  isSelected?: boolean;
  isPending?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
};

/**
 * Reusable animated/selectable CRM table row.
 * Renders as <motion.tr> (standard <tr> in the DOM).
 *
 * – Entrance: opacity 0 → 1 with per-row stagger delay.
 * – Selected state: warm sand-tint background + inset left border on first
 *   cell via the .crm-row-selected global CSS rule.
 * – Reduced-motion: no animation, still renders correct selected/hover styles.
 */
export function CrmTableRow({
  index = 0,
  isSelected,
  isPending,
  onClick,
  children,
  className,
}: CrmTableRowProps) {
  const shouldReduceMotion = useReducedMotion();
  // Stagger: 40 ms per row, capped at 280 ms
  const delayS = shouldReduceMotion ? 0 : Math.min(index * 0.04, 0.28);

  return (
    <motion.tr
      onClick={onClick}
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={
        shouldReduceMotion
          ? undefined
          : { delay: delayS, duration: 0.22, ease: CS_EASE }
      }
      className={cn(
        "transition-colors",
        onClick && "cursor-pointer",
        isSelected && "crm-row-selected bg-[var(--cs-sand-tint)]",
        !isSelected && onClick && "hover:bg-[var(--cs-sand-tint)]",
        isPending && "opacity-60",
        className
      )}
    >
      {children}
    </motion.tr>
  );
}
