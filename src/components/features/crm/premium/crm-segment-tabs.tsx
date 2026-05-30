"use client";

import { useId } from "react";
import Link from "next/link";
import { motion, LayoutGroup, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { TAB_INDICATOR_SPRING } from "./variants";

export type CrmSegmentTab = {
  key: string;
  label: string;
  count?: number;
  href?: string;
};

type CrmSegmentTabsProps = {
  tabs: CrmSegmentTab[];
  activeKey: string;
  onSelect?: (key: string) => void;
  variant?: "pill" | "underline";
  className?: string;
};

/**
 * Unified CRM tab system.
 *
 * "underline" – active indicator slides smoothly between tabs via Framer Motion
 *   layoutId (spring-physics). Works with URL-based (Link) and button tabs.
 * "pill"     – active tab gets a filled background (no sliding indicator).
 *
 * – LayoutGroup scoped per instance via useId() to prevent cross-page conflicts.
 * – useReducedMotion respected: plain <span> replaces motion indicator.
 * – aria-current="page" on active Link tabs (correct ARIA for navigation).
 * – aria-selected on all tabs (tablist contract).
 */
export function CrmSegmentTabs({
  tabs,
  activeKey,
  onSelect,
  variant = "underline",
  className,
}: CrmSegmentTabsProps) {
  const layoutGroupId = useId();
  const shouldReduceMotion = useReducedMotion();

  const wrapperClass =
    variant === "pill"
      ? "flex gap-1 overflow-x-auto rounded-xl bg-[var(--cs-surface-warm)] p-1 scrollbar-hide"
      : "flex gap-0 overflow-x-auto border-b border-[var(--cs-border-soft)] scrollbar-hide";

  const nav = (
    <nav
      role="tablist"
      aria-label="Segments"
      className={cn(wrapperClass, className)}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;

        const countBadge = tab.count !== undefined && (
          <span
            className={cn(
              "ml-1.5 inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-semibold",
              isActive
                ? "bg-[var(--cs-sand-mist)] text-[var(--cs-sand)]"
                : "bg-[var(--cs-border)] text-[var(--cs-text-muted)]"
            )}
          >
            {tab.count}
          </span>
        );

        /* Active indicator – motion or plain based on reduced-motion + variant */
        const activeIndicator =
          variant === "underline" && isActive ? (
            shouldReduceMotion ? (
              <span
                className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[var(--cs-sand)]"
                aria-hidden="true"
              />
            ) : (
              <motion.span
                layoutId="crm-tab-indicator"
                className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[var(--cs-sand)]"
                transition={TAB_INDICATOR_SPRING}
                aria-hidden="true"
              />
            )
          ) : null;

        const pillClass = cn(
          "relative shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)]",
          isActive
            ? "bg-[var(--cs-surface)] text-[var(--cs-text)] shadow-[var(--cs-shadow-xs)]"
            : "text-[var(--cs-text-muted)] hover:text-[var(--cs-text-secondary)]"
        );

        const underlineClass = cn(
          "relative shrink-0 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)]",
          isActive
            ? "text-[var(--cs-text)]"
            : "text-[var(--cs-text-muted)] hover:text-[var(--cs-text-secondary)]"
        );

        const tabClass = variant === "pill" ? pillClass : underlineClass;

        if (tab.href) {
          return (
            <Link
              key={tab.key}
              href={tab.href}
              scroll={false}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              className={tabClass}
            >
              {tab.label}
              {countBadge}
              {activeIndicator}
            </Link>
          );
        }

        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect?.(tab.key)}
            className={tabClass}
          >
            {tab.label}
            {countBadge}
            {activeIndicator}
          </button>
        );
      })}
    </nav>
  );

  /*
   * LayoutGroup scopes the layoutId to this component instance so multiple
   * tab bars on the same page don't interfere with each other.
   */
  return (
    <LayoutGroup id={layoutGroupId}>
      {nav}
    </LayoutGroup>
  );
}
