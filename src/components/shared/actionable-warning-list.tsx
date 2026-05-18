import { ActionableWarning } from "./actionable-warning";
import type { ActionableWarning as ActionableWarningType } from "@/types/warnings";

/**
 * Renders a vertical stack of ActionableWarning cards.
 *
 * Renders nothing when `warnings` is empty — safe to always include.
 *
 * @example
 * <ActionableWarningList
 *   warnings={[
 *     {
 *       id: "no-services",
 *       severity: "warning",
 *       title: "No services assigned",
 *       description: "Staff uses legacy scheduling until services are set.",
 *       actionLabel: "Edit services",
 *       target: warningTargets.staffServiceEditor(),
 *     },
 *     {
 *       id: "awaiting-approval",
 *       severity: "warning",
 *       title: "Awaiting approval",
 *       description: "Use Approve & Activate to make this staff member active.",
 *       target: warningTargets.scrollTo("approval-actions"),
 *     },
 *   ]}
 *   onAction={(w) => {
 *     if (w.target.panelId === "service-editor") setSheetOpen(true);
 *   }}
 * />
 */
export function ActionableWarningList({
  warnings,
  onAction,
  compact = false,
  gap = "0.5rem",
}: {
  warnings: ActionableWarningType[];
  /**
   * Forwarded to each ActionableWarning for "open-panel", "modal", "custom" targets.
   */
  onAction?: (warning: ActionableWarningType) => void;
  /** Pass through compact prop to every child. */
  compact?: boolean;
  /** CSS gap between cards. Defaults to "0.5rem". */
  gap?: string;
}) {
  if (warnings.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap,
      }}
    >
      {warnings.map((w) => (
        <ActionableWarning
          key={w.id}
          warning={w}
          onAction={onAction}
          compact={compact}
        />
      ))}
    </div>
  );
}
