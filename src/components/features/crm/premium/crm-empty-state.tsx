"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Inbox, Search, SlidersHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { emptyStateVariants, emptyStateVariantsStill } from "./variants";

type CrmEmptyStateVariant = "default" | "search" | "filtered";

type CrmEmptyStateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type CrmEmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: CrmEmptyStateAction;
  variant?: CrmEmptyStateVariant;
  className?: string;
};

const VARIANT_ICON: Record<CrmEmptyStateVariant, LucideIcon> = {
  default:  Inbox,
  search:   Search,
  filtered: SlidersHorizontal,
};

/**
 * Premium CRM empty state with spa-themed icon circle.
 * Replaces emoji-only empty states.
 * Variants: default | search | filtered.
 * Respects prefers-reduced-motion.
 */
export function CrmEmptyState({
  title,
  description,
  icon: IconProp,
  action,
  variant = "default",
  className,
}: CrmEmptyStateProps) {
  const shouldReduceMotion = useReducedMotion();
  const vars = shouldReduceMotion ? emptyStateVariantsStill : emptyStateVariants;
  const Icon = IconProp ?? VARIANT_ICON[variant];

  return (
    <motion.div
      variants={vars}
      initial="hidden"
      animate="visible"
      className={cn(
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        className
      )}
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--cs-sand-mist)]">
        <Icon size={18} className="text-[var(--cs-sand)]" />
      </div>

      <p className="text-sm font-semibold text-[var(--cs-text-secondary)]">
        {title}
      </p>

      {description && (
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-[var(--cs-text-muted)]">
          {description}
        </p>
      )}

      {action && (
        <div className="mt-5">
          {action.href ? (
            <Link href={action.href} className="cs-btn cs-btn-secondary cs-btn-sm">
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="cs-btn cs-btn-secondary cs-btn-sm"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
