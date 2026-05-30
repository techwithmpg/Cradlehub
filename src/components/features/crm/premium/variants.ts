/**
 * Shared Framer Motion / Motion variants for the CRM premium work-area layer.
 *
 * Rules:
 *  – duration 0.15 – 0.30 s
 *  – stagger 0.04 – 0.07 s
 *  – spring panels: stiffness 300–360, damping 28–32
 *  – no bounce (damping ≥ 28 keeps overshoot invisible in operational UI)
 *
 * These variants are used by CrmMotionSection (container) and CrmKpiCard
 * (stagger child) so the two files stay in sync.
 */

import type { Variants } from "motion/react";

/** easing that matches --cs-ease cubic-bezier(0.25, 0.46, 0.45, 0.94) */
export const CS_EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

// ─── Section / container ──────────────────────────────────────────────────────

/** Stagger container – fades up, then staggers direct motion children */
export const sectionVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0,
    },
  },
};

// ─── Individual items (KPI cards, list rows, etc.) ───────────────────────────

/** Fade-up item – used inside a stagger container */
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.26, ease: CS_EASE },
  },
};

/** Instant item – for reduced-motion; starts visible */
export const itemVariantsStill: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0 },
};

// ─── Rail / panel slide-in ────────────────────────────────────────────────────

export const railVariants: Variants = {
  hidden: { opacity: 0, x: 16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 340, damping: 30, mass: 0.8 },
  },
  exit: {
    opacity: 0,
    x: 16,
    transition: { duration: 0.18, ease: CS_EASE },
  },
};

export const railVariantsStill: Variants = {
  hidden:  { opacity: 1, x: 0 },
  visible: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: 0, transition: { duration: 0 } },
};

// ─── Empty state ──────────────────────────────────────────────────────────────

export const emptyStateVariants: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: CS_EASE } },
};

export const emptyStateVariantsStill: Variants = {
  hidden:  { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0 },
};

// ─── Tab indicator spring ─────────────────────────────────────────────────────

export const TAB_INDICATOR_SPRING = {
  type: "spring" as const,
  stiffness: 350,
  damping: 30,
  mass: 0.6,
};
