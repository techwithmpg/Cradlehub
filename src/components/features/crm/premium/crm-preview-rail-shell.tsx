"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { railVariants, railVariantsStill } from "./variants";

type CrmPreviewRailShellProps = {
  /** When false the desktop rail is hidden (AnimatePresence exits it) */
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional title shown in the desktop rail header */
  title?: string;
  /** Reserved for future variable-width rails */
  width?: string;
  /** Controls mobile Sheet open state */
  isMobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  className?: string;
};

/**
 * Reusable CRM right preview rail shell.
 *
 * Desktop (lg+): AnimatePresence spring slide-in from the right.
 *   Close button uses Button variant="ghost" size="icon-sm" –
 *   matching AdminDialog / AdminDrawer project convention.
 *
 * Mobile: shadcn Sheet from the right (unchanged behaviour).
 *
 * Respects prefers-reduced-motion.
 */
export function CrmPreviewRailShell({
  isOpen,
  onClose,
  children,
  title,
  isMobileOpen = false,
  onMobileOpenChange,
  className,
}: CrmPreviewRailShellProps) {
  const shouldReduceMotion = useReducedMotion();
  const vars = shouldReduceMotion ? railVariantsStill : railVariants;

  if (!isOpen && !isMobileOpen) return null;

  return (
    <>
      {/* Desktop rail – lg+ only */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            key="crm-preview-rail"
            variants={vars}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "hidden lg:flex lg:w-[340px] lg:shrink-0 lg:flex-col",
              className
            )}
          >
            <div className="cs-card sticky top-4 flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden">
              {title && (
                <div className="flex shrink-0 items-center justify-between border-b border-[var(--cs-border-soft)] px-4 py-3">
                  <span className="text-sm font-semibold text-[var(--cs-text)]">
                    {title}
                  </span>
                  {/* Matches AdminDialog / AdminDrawer close button convention */}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onClose}
                    className="text-[var(--cs-text-muted)] hover:text-[var(--cs-text-secondary)]"
                  >
                    <XIcon />
                    <span className="sr-only">Close preview</span>
                  </Button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto">{children}</div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile Sheet – shadcn handles its own animation */}
      <Sheet open={isMobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="right"
          className="w-full p-0 sm:max-w-sm bg-[var(--cs-surface)]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{title ?? "Preview"}</SheetTitle>
            <SheetDescription>Details for selected record</SheetDescription>
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    </>
  );
}
