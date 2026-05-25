/**
 * Operations Readiness Engine — canonical types.
 *
 * Every readiness check in CradleHub, regardless of which page or query
 * produced it, should map to ReadinessIssue.  The type is a superset of the
 * seven divergent warning shapes found in the Phase 9A audit:
 *
 *   SetupIssue         → severity "error"   → maps to "critical"
 *   ActionableWarning  → severity "danger"   → maps to "critical"
 *   OperationalWarning → severity "critical" → maps to "critical"
 *   TodayAlert         → label/href          → maps to title/actionHref
 *   DispatchAlert      → description         → maps to problem
 *   ManagerSettingsWarning → no action       → actionHref still required here
 *   ScheduleHealthIssue    → no action       → actionHref still required here
 *
 * Phase 9A audit: docs/CRM_READINESS_AUDIT.md
 */

// ── Severity ───────────────────────────────────────────────────────────────────

/**
 * Unified severity scale.
 *
 * Maps from legacy vocabulary:
 *   "error" | "danger" | "critical"  → "critical"
 *   "warning"                         → "warning"
 *   "info" | "notice"                 → "info"
 *   "ok" | "healthy" | "success"     → "success"
 */
export type ReadinessSeverity = "critical" | "warning" | "info" | "success";

// ── Scope ──────────────────────────────────────────────────────────────────────

/**
 * The domain this issue belongs to.
 * Used for filtering, grouping, and routing in the global readiness strip.
 */
export type ReadinessScope =
  | "setup"     // Branch config: services, rules, resources
  | "schedule"  // Staff schedules, overrides, blocked time
  | "daily"     // Same-day ops: check-in, unassigned, attendance
  | "service"   // Service / provider assignment
  | "space"     // Rooms, resources, capacity
  | "dispatch"  // Home-service, driver, routing
  | "payment"   // Payment status, overdue
  | "system";   // Env config, external APIs, infrastructure

// ── Status ─────────────────────────────────────────────────────────────────────

/** Overall health status derived from a collection of issues. */
export type ReadinessStatus = "ok" | "warning" | "critical";

// ── Core types ─────────────────────────────────────────────────────────────────

/**
 * A single detected readiness issue.
 *
 * Every issue must answer:
 *   1. What is wrong?  → title
 *   2. More detail?    → problem
 *   3. Why care?       → impact
 *   4. How to fix?     → fix
 *   5. Where to go?    → actionLabel + actionHref
 */
export type ReadinessIssue = {
  /** Stable unique key for React lists, deduplication, and tracking. */
  id: string;

  /** Domain this issue belongs to. Used for grouping and filtering. */
  scope: ReadinessScope;

  /** Urgency level. */
  severity: ReadinessSeverity;

  /**
   * Short, specific problem statement.
   * Example: "3 services have no valid therapist assigned."
   */
  title: string;

  /**
   * One sentence describing what is wrong in more detail.
   * Example: "Customers cannot select a therapist during online booking."
   */
  problem: string;

  /**
   * One sentence describing the operational consequence if left unfixed.
   * Example: "Online bookings for these services may fail silently."
   */
  impact: string;

  /**
   * One sentence describing how to resolve the issue.
   * Example: "Assign at least one valid therapist to each service."
   */
  fix: string;

  /** Label for the CTA button/link. */
  actionLabel: string;

  /** Destination URL where the issue can be resolved. */
  actionHref: string;

  /**
   * Which query or function computed this issue.
   * Used for deduplication when multiple aggregators run.
   * Example: "getCrmSetupHealth", "getCrmAvailabilitySnapshot"
   */
  source: string;

  /** Optional: entity type affected (e.g. "service", "staff", "booking"). */
  entityType?: string;

  /** Optional: IDs of affected entities (for count badges or drill-down links). */
  entityIds?: string[];

  /**
   * Optional: explicit count when different from entityIds.length,
   * or when entityIds are not available.
   */
  count?: number;
};

/**
 * The output of any readiness aggregator query.
 * status is always derived from the highest severity across all issues.
 */
export type ReadinessResult = {
  issues: ReadinessIssue[];
  /** Derived via getReadinessStatusFromIssues — do not set manually. */
  status: ReadinessStatus;
};

/**
 * A single health metric for display in a ReadinessHealthGrid.
 *
 * Metrics are informational (counts, ratios, flags) — they are not the same
 * as issues.  A metric with status "warning" may accompany a ReadinessIssue,
 * but the metric itself does not prescribe a fix.
 */
export type ReadinessHealthMetric = {
  /** Stable key for React lists. */
  id: string;

  /** Short label shown beneath the value. */
  label: string;

  /** The primary value shown large (number or formatted string). */
  value: number | string;

  /** Optional sub-label or context description. */
  description?: string;

  /**
   * Visual status for the metric card.
   * - "critical" → red
   * - "warning"  → amber
   * - "ok"       → green
   * - "neutral"  → muted (informational, no urgency)
   */
  status?: ReadinessStatus | "neutral";

  /** Optional: clicking the card navigates to this URL. */
  href?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Derive an overall ReadinessStatus from a list of issues.
 * Returns "critical" if any issue is critical, "warning" if any is warning,
 * otherwise "ok".
 */
export function getReadinessStatusFromIssues(
  issues: ReadinessIssue[]
): ReadinessStatus {
  if (issues.some((issue) => issue.severity === "critical")) return "critical";
  if (issues.some((issue) => issue.severity === "warning")) return "warning";
  return "ok";
}

// Severity order used by sortReadinessIssues — lower = shown first.
const SEVERITY_RANK: Record<ReadinessSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  success: 3,
};

/**
 * Sort a list of readiness issues by severity (critical first), then
 * alphabetically by title within the same severity band.
 *
 * Returns a new array — does not mutate the original.
 */
export function sortReadinessIssues(
  issues: ReadinessIssue[]
): ReadinessIssue[] {
  return [...issues].sort((a, b) => {
    const aRank = SEVERITY_RANK[a.severity] ?? 3;
    const bRank = SEVERITY_RANK[b.severity] ?? 3;
    const diff = aRank - bRank;
    if (diff !== 0) return diff;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Build a ReadinessResult from a list of issues.
 * Convenience wrapper so callers don't have to derive status themselves.
 */
export function buildReadinessResult(issues: ReadinessIssue[]): ReadinessResult {
  return {
    issues: sortReadinessIssues(issues),
    status: getReadinessStatusFromIssues(issues),
  };
}

// ── Scope metadata (used by UI components) ────────────────────────────────────

export type ReadinessScopeMeta = {
  label: string;
  icon: string;
};

export const READINESS_SCOPE_META: Record<ReadinessScope, ReadinessScopeMeta> = {
  setup:    { label: "Setup",     icon: "⚙️" },
  schedule: { label: "Schedule",  icon: "📅" },
  daily:    { label: "Daily Ops", icon: "☀️" },
  service:  { label: "Services",  icon: "✨" },
  space:    { label: "Spaces",    icon: "🏠" },
  dispatch: { label: "Dispatch",  icon: "🚐" },
  payment:  { label: "Payment",   icon: "💳" },
  system:   { label: "System",    icon: "🖥️" },
};
