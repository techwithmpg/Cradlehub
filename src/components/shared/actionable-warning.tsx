"use client";

import { useRouter } from "next/navigation";
import { AlertTriangleIcon, AlertCircleIcon, CheckCircle2Icon, InfoIcon } from "lucide-react";
import { scrollToElement, focusElement, buildHref } from "@/lib/warnings/scroll-to-target";
import type { ActionableWarning as ActionableWarningType, WarningSeverity } from "@/types/warnings";

// ── Severity config ───────────────────────────────────────────────────────────

type SeverityConfig = {
  bg: string;
  border: string;
  textColor: string;
  actionBg: string;
  actionBorder: string;
  actionText: string;
  Icon: React.ComponentType<{ size?: number }>;
  role: "alert" | "status" | undefined;
};

const SEVERITY_CONFIG: Record<WarningSeverity, SeverityConfig> = {
  danger: {
    bg: "#FEF2F2",
    border: "#FECACA",
    textColor: "#991B1B",
    actionBg: "#FEF2F2",
    actionBorder: "#FECACA",
    actionText: "#991B1B",
    Icon: AlertCircleIcon,
    role: "alert",
  },
  warning: {
    bg: "#FFFBEB",
    border: "#FDE68A",
    textColor: "#92400E",
    actionBg: "#FFFBEB",
    actionBorder: "#FDE68A",
    actionText: "#92400E",
    Icon: AlertTriangleIcon,
    role: "alert",
  },
  success: {
    bg: "#F0FDF4",
    border: "#BBF7D0",
    textColor: "#15803D",
    actionBg: "#F0FDF4",
    actionBorder: "#BBF7D0",
    actionText: "#15803D",
    Icon: CheckCircle2Icon,
    role: "status",
  },
  info: {
    bg: "#EFF6FF",
    border: "#BFDBFE",
    textColor: "#1E40AF",
    actionBg: "#EFF6FF",
    actionBorder: "#BFDBFE",
    actionText: "#1D4ED8",
    Icon: InfoIcon,
    role: undefined,
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * A single actionable warning card.
 *
 * - Replaces hardcoded inline warning divs throughout the app.
 * - Every warning answers: what, why, impact, and where to fix.
 * - Action type determines click behaviour automatically.
 * - For "open-panel", "modal", and "custom" types, provide `onAction`.
 *
 * @example
 * <ActionableWarning
 *   warning={{
 *     id: "no-services",
 *     severity: "warning",
 *     title: "No services assigned",
 *     description: "Staff will use legacy scheduling until at least one service is set.",
 *     impact: "This staff member will not appear in service-specific booking matching.",
 *     actionLabel: "Edit services",
 *     target: warningTargets.staffServiceEditor(),
 *   }}
 *   onAction={() => setSheetOpen(true)}
 * />
 */
export function ActionableWarning({
  warning,
  onAction,
  compact = false,
}: {
  warning: ActionableWarningType;
  /**
   * Required for target types: "open-panel", "modal", "custom".
   * Called with the full warning object so the parent can dispatch
   * any state change needed to open the relevant panel/modal.
   */
  onAction?: (warning: ActionableWarningType) => void;
  /**
   * Compact mode: reduces padding, hides icon, shows only title + action.
   * Useful in dense list contexts.
   */
  compact?: boolean;
}) {
  const router = useRouter();
  const cfg = SEVERITY_CONFIG[warning.severity];
  const { Icon } = cfg;

  function handleAction() {
    const { target } = warning;

    switch (target.type) {
      case "scroll":
        if (target.sectionId) scrollToElement(target.sectionId);
        return;

      case "focus":
        if (target.fieldId) focusElement(target.fieldId);
        return;

      case "navigate": {
        if (!target.href) return;
        const href = buildHref(target.href, target.tab, target.query);
        router.push(href);
        return;
      }

      case "open-panel":
      case "modal":
      case "custom":
        onAction?.(warning);
        return;
    }
  }

  const hasAction = !!warning.actionLabel;
  const padding = compact ? "0.5rem 0.75rem" : "0.75rem 1rem";

  return (
    <div
      role={cfg.role}
      style={{
        display: "flex",
        alignItems: compact ? "center" : "flex-start",
        gap: "0.625rem",
        padding,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 8,
      }}
    >
      {/* Icon — hidden in compact mode to save space */}
      {!compact && (
        <span
          aria-hidden="true"
          style={{ color: cfg.textColor, marginTop: 2, flexShrink: 0, display: "flex" }}
        >
          <Icon size={16} />
        </span>
      )}

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: compact ? "0.8125rem" : "0.875rem",
            fontWeight: 600,
            color: cfg.textColor,
            lineHeight: 1.4,
          }}
        >
          {warning.title}
        </p>

        {!compact && warning.description && (
          <p
            style={{
              margin: "0.2rem 0 0",
              fontSize: "0.8125rem",
              color: cfg.textColor,
              opacity: 0.85,
              lineHeight: 1.4,
            }}
          >
            {warning.description}
          </p>
        )}

        {!compact && warning.impact && (
          <p
            style={{
              margin: "0.2rem 0 0",
              fontSize: "0.75rem",
              color: cfg.textColor,
              opacity: 0.7,
              fontStyle: "italic",
              lineHeight: 1.4,
            }}
          >
            {warning.impact}
          </p>
        )}
      </div>

      {/* Action button */}
      {hasAction && (
        <button
          onClick={handleAction}
          aria-label={`${warning.actionLabel} — ${warning.title}`}
          style={{
            flexShrink: 0,
            fontSize: "0.75rem",
            fontWeight: 700,
            color: cfg.actionText,
            backgroundColor: "transparent",
            border: `1px solid ${cfg.actionBorder}`,
            borderRadius: 6,
            padding: "0.2rem 0.625rem",
            cursor: "pointer",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          {warning.actionLabel}
          {/* Chevron for navigate targets to signal navigation */}
          {warning.target.type === "navigate" && (
            <span aria-hidden style={{ fontSize: "0.625rem" }}>→</span>
          )}
        </button>
      )}
    </div>
  );
}
