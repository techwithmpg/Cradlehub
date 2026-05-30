"use client";

/**
 * CrmPremiumLoader — CradleHub-themed wrapper around the Kokonut Loader.
 *
 * Changes from the source Kokonut component:
 *  – All ring colours use CSS var(--cs-sand / --cs-sand-dark / --cs-border)
 *    instead of hardcoded rgb(0,0,0).  CSS custom properties are resolved at
 *    paint time so inline style strings accept var() correctly in all modern
 *    browsers.
 *  – Four `dark:block` duplicate rings removed (CRM is light-mode only).
 *  – Title/subtitle use --cs-text / --cs-text-muted tokens.
 *  – useReducedMotion() respected: static rings + gentle CSS pulse when set.
 *  – role="status" + aria-live="polite" on the root for screen-reader compat.
 *
 * NOTE: inline `style` is kept only for the properties that CANNOT be
 * expressed as Tailwind utilities (conic-gradient + radial-gradient mask).
 * Opacity, colours, and motion all use Tailwind or motion/react values.
 *
 * Use for:   full CRM route loading, setup readiness scan, heavy section wait.
 * Do NOT use for: button saves, row actions, toggles, modal save, small inline
 *                 actions — those must keep CrmInlineActionButton / local spinners.
 */

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type CrmPremiumLoaderProps = {
  title?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CONFIG = {
  sm: {
    container:    "size-20",
    titleClass:   "text-sm/tight font-medium",
    subtitleClass:"text-xs/relaxed",
    spacing:      "space-y-2",
    maxWidth:     "max-w-48",
  },
  md: {
    container:    "size-32",
    titleClass:   "text-base/snug font-medium",
    subtitleClass:"text-sm/relaxed",
    spacing:      "space-y-3",
    maxWidth:     "max-w-56",
  },
  lg: {
    container:    "size-40",
    titleClass:   "text-lg/tight font-semibold",
    subtitleClass:"text-base/relaxed",
    spacing:      "space-y-4",
    maxWidth:     "max-w-64",
  },
} as const;

// ─── Reduced-motion fallback ──────────────────────────────────────────────────

function StaticRings({
  config,
}: {
  config: (typeof SIZE_CONFIG)[keyof typeof SIZE_CONFIG];
}) {
  return (
    <div className={cn("relative animate-pulse", config.container)}>
      {/* Outermost static ring */}
      <div className="absolute inset-0 rounded-full border-2 border-[var(--cs-border)]" />
      {/* Primary static ring – sand accent */}
      <div className="absolute inset-[6px] rounded-full border border-[var(--cs-sand)] opacity-70" />
      {/* Inner accent ring */}
      <div className="absolute inset-[14px] rounded-full border border-[var(--cs-sand-dark)] opacity-40" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CrmPremiumLoader({
  title    = "Preparing CRM workspace...",
  subtitle = "Loading bookings, staff, services, and today's operations.",
  size     = "md",
  className,
}: CrmPremiumLoaderProps) {
  const shouldReduceMotion = useReducedMotion();
  const config = SIZE_CONFIG[size];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-8 p-8",
        className
      )}
    >
      {/* ── Ring cluster ─────────────────────────────────────────────────── */}
      {shouldReduceMotion ? (
        <StaticRings config={config} />
      ) : (
        <motion.div
          animate={{ scale: [1, 1.02, 1] }}
          className={cn("relative", config.container)}
          transition={{
            duration: 4,
            repeat: Number.POSITIVE_INFINITY,
            ease: [0.4, 0, 0.6, 1],
          }}
        >
          {/* Outer thin ring — fast sweep */}
          <motion.div
            animate={{ rotate: [0, 360] }}
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, var(--cs-sand) 90deg, transparent 180deg)",
              mask:
                "radial-gradient(circle at 50% 50%, transparent 35%, black 37%, black 39%, transparent 41%)",
              WebkitMask:
                "radial-gradient(circle at 50% 50%, transparent 35%, black 37%, black 39%, transparent 41%)",
              opacity: 0.75,
            }}
            transition={{
              duration: 3,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />

          {/* Primary ring — main spinner, slightly slower */}
          <motion.div
            animate={{ rotate: [0, 360] }}
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, var(--cs-sand) 120deg, var(--cs-sand-mist) 240deg, transparent 360deg)",
              mask:
                "radial-gradient(circle at 50% 50%, transparent 42%, black 44%, black 48%, transparent 50%)",
              WebkitMask:
                "radial-gradient(circle at 50% 50%, transparent 42%, black 44%, black 48%, transparent 50%)",
              opacity: 0.9,
            }}
            transition={{
              duration: 2.5,
              repeat: Number.POSITIVE_INFINITY,
              ease: [0.4, 0, 0.6, 1],
            }}
          />

          {/* Secondary ring — counter-rotation, darker sand */}
          <motion.div
            animate={{ rotate: [0, -360] }}
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 180deg, transparent 0deg, var(--cs-sand-dark) 45deg, transparent 90deg)",
              mask:
                "radial-gradient(circle at 50% 50%, transparent 52%, black 54%, black 56%, transparent 58%)",
              WebkitMask:
                "radial-gradient(circle at 50% 50%, transparent 52%, black 54%, black 56%, transparent 58%)",
              opacity: 0.3,
            }}
            transition={{
              duration: 4,
              repeat: Number.POSITIVE_INFINITY,
              ease: [0.4, 0, 0.6, 1],
            }}
          />

          {/* Outermost accent particle — border colour, very subtle */}
          <motion.div
            animate={{ rotate: [0, 360] }}
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 270deg, transparent 0deg, var(--cs-border) 20deg, transparent 40deg)",
              mask:
                "radial-gradient(circle at 50% 50%, transparent 61%, black 62%, black 63%, transparent 64%)",
              WebkitMask:
                "radial-gradient(circle at 50% 50%, transparent 61%, black 62%, black 63%, transparent 64%)",
              opacity: 0.5,
            }}
            transition={{
              duration: 3.5,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        </motion.div>
      )}

      {/* ── Typography ───────────────────────────────────────────────────── */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className={cn("text-center", config.spacing, config.maxWidth)}
        initial={{ opacity: 0, y: 12 }}
        transition={{
          delay: shouldReduceMotion ? 0 : 0.4,
          duration: shouldReduceMotion ? 0 : 0.9,
          ease: [0.4, 0, 0.2, 1],
        }}
      >
        {title && (
          <motion.p
            animate={{ opacity: shouldReduceMotion ? 1 : [0.9, 0.72, 0.9] }}
            className={cn(
              config.titleClass,
              "tracking-[-0.02em] antialiased text-[var(--cs-text)]"
            )}
            transition={
              shouldReduceMotion
                ? undefined
                : {
                    delay: 0.5,
                    duration: 3,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: [0.4, 0, 0.6, 1],
                  }
            }
          >
            {title}
          </motion.p>
        )}

        {subtitle && (
          <motion.p
            animate={{ opacity: shouldReduceMotion ? 0.7 : [0.6, 0.42, 0.6] }}
            className={cn(
              config.subtitleClass,
              "font-normal tracking-[-0.01em] antialiased text-[var(--cs-text-muted)]"
            )}
            transition={
              shouldReduceMotion
                ? undefined
                : {
                    delay: 0.7,
                    duration: 4,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: [0.4, 0, 0.6, 1],
                  }
            }
          >
            {subtitle}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}
