"use client";

import { cn } from "@/lib/utils";

type CrmInlineActionButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type CrmInlineActionButtonProps = {
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
  disabled?: boolean;
  variant?: CrmInlineActionButtonVariant;
  size?: "sm" | "md";
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  className?: string;
};

/** Minimal inline spinner that matches the button text colour */
function MiniSpinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
    />
  );
}

const VARIANT_CLASS: Record<CrmInlineActionButtonVariant, string> = {
  primary:   "cs-btn-primary",
  secondary: "cs-btn-secondary",
  ghost:     "cs-btn-ghost",
  danger:    "cs-btn-danger",
};

/**
 * Inline loading button for CRM actions.
 * Shows a spinner + loading text while the action is in-flight.
 * Only disables itself – does not freeze the surrounding workspace.
 *
 * Uses .cs-btn system (project standard) rather than wrapping shadcn Button,
 * as shadcn Button's CVA Tailwind utilities conflict with the cs-btn CSS layer.
 * Behaviour improvements are applied directly:
 *   – disabled:pointer-events-none  (prevents ghost clicks on disabled state)
 *   – active:translate-y-[1px]      (subtle press feedback, matches shadcn default)
 */
export function CrmInlineActionButton({
  loading,
  loadingText,
  children,
  disabled,
  variant = "primary",
  size = "sm",
  onClick,
  type = "button",
  className,
}: CrmInlineActionButtonProps) {
  const isDisabled = loading === true || disabled === true;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={cn(
        "cs-btn",
        VARIANT_CLASS[variant],
        size === "sm" && "cs-btn-sm",
        // Behaviour parity with shadcn Button without visual conflicts
        "active:translate-y-[1px] disabled:pointer-events-none",
        className
      )}
    >
      {loading ? (
        <>
          <MiniSpinner />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
