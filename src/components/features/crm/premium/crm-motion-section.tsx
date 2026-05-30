"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { sectionVariants } from "./variants";

type CrmMotionSectionProps = {
  children: React.ReactNode;
  /**
   * Per-child stagger delay in seconds.
   * Works when direct children are motion components with matching variants
   * (e.g. CrmKpiCard). Defaults to 0.05 s.
   */
  stagger?: number;
  /** Additional delay before the stagger starts, in ms */
  delay?: number;
  className?: string;
};

/**
 * Soft fade-up + stagger entrance wrapper for CRM workspace sections.
 *
 * Direct children that are motion components with `variants` (e.g. CrmKpiCard)
 * will be staggered individually. Other children fade up as a group.
 *
 * Respects prefers-reduced-motion – renders a plain div when set.
 */
export function CrmMotionSection({
  children,
  stagger = 0.05,
  delay = 0,
  className,
}: CrmMotionSectionProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  const variants = {
    ...sectionVariants,
    visible: {
      ...sectionVariants.visible,
      transition: {
        staggerChildren: stagger,
        delayChildren: delay / 1000, // convert ms → s for motion
      },
    },
  };

  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="visible"
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
