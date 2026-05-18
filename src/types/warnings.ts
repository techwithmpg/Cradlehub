/**
 * System-wide actionable warning types.
 *
 * Every warning in CradleHub should be able to answer:
 *   1. What is wrong?         → title
 *   2. Why does it matter?    → description / impact
 *   3. Where do I fix it?     → target
 *   4. What happens on click? → actionLabel + target.type
 */

export type WarningSeverity = "info" | "success" | "warning" | "danger";

export type WarningActionType =
  | "scroll"       // smooth-scroll to sectionId on the current page
  | "focus"        // focus fieldId on the current page
  | "open-panel"   // open a drawer/sheet identified by panelId (caller provides onAction)
  | "navigate"     // router.push to href (with optional tab/query)
  | "modal"        // open a modal (caller provides onAction)
  | "custom";      // caller provides onAction; target is informational only

export type ActionableWarningTarget = {
  /** Discriminant — drives the click behaviour. */
  type: WarningActionType;

  /** For "scroll": id of the element to scroll into view. */
  sectionId?: string;

  /** For "focus": id of the form field to focus. */
  fieldId?: string;

  /** For "navigate": the destination path (no domain). */
  href?: string;

  /** For "navigate": adds ?tab=<tab> to href. */
  tab?: string;

  /** For "navigate": additional query-string key/value pairs. */
  query?: Record<string, string>;

  /**
   * For "open-panel": logical panel identifier the parent can match.
   * E.g. "service-editor", "booking-details", "scheduling-rules".
   */
  panelId?: string;
};

export type ActionableWarning = {
  /** Stable unique key for React lists and tracking. */
  id: string;

  severity: WarningSeverity;

  /** Short, specific problem statement shown as the warning heading. */
  title: string;

  /** One-sentence explanation of the problem or context. */
  description?: string;

  /**
   * One-sentence consequence if the warning is ignored.
   * Shown in a slightly subdued style below description.
   */
  impact?: string;

  /**
   * CTA label for the action button.
   * If omitted, no action button is rendered.
   */
  actionLabel?: string;

  target: ActionableWarningTarget;
};
