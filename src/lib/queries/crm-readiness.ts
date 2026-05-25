/**
 * CRM Operations Readiness Aggregator — Phase 9C
 *
 * Collects existing readiness signals from all CRM data sources and converts
 * them into a single ReadinessResult using the canonical ReadinessIssue type.
 *
 * Sources used:
 *   1. getCrmSetupHealth()       — setup, service, dispatch, space, daily
 *   2. getCrmTodaySnapshot()     — staff check-in, dispatch, payment signals
 *      (getCrmTodaySnapshot internally calls getCrmAvailabilitySnapshot, so
 *       availability data is obtained once through the today snapshot)
 *
 * Sources deferred to Phase 9E:
 *   - Service provider public/non-public distinction (needs staff_type filter)
 *   - Resource conflict detection (spaces-rules-utils — per-booking compute)
 *   - Schedule coverage issues (schedule-coverage-issues — per-staff detail)
 *   - 14 missing checks identified in CRM_READINESS_AUDIT.md Section E
 *
 * Do NOT modify:
 *   src/lib/actions/online-booking.ts
 *   src/lib/actions/inhouse-booking.ts
 *   src/lib/engine/availability.ts
 *   src/lib/engine/resource-availability.ts
 *   src/lib/bookings/dispatch-conflict.ts
 *   src/lib/bookings/dispatch-slot-filter.ts
 *   supabase/migrations/*
 */

import { getCrmSetupHealth, type SetupIssue } from "./crm-setup";
import { getCrmTodaySnapshot } from "./crm-today";
import type { CrmAvailabilitySummary } from "./crm-availability";
import type { DispatchStats } from "./dispatch-queries";
import {
  buildReadinessResult,
  sortReadinessIssues,
  type ReadinessIssue,
  type ReadinessSeverity,
  type ReadinessScope,
  type ReadinessResult,
} from "@/types/readiness";

// ── Severity map ──────────────────────────────────────────────────────────────

/**
 * Maps legacy SetupIssue severity vocab to ReadinessSeverity.
 * "error" and "danger" both map to "critical" per the canonical scale.
 */
function mapSetupSeverity(s: SetupIssue["severity"]): ReadinessSeverity {
  if (s === "error") return "critical";
  if (s === "warning") return "warning";
  return "info";
}

// ── Scope map ─────────────────────────────────────────────────────────────────

const SETUP_SCOPE_MAP: Record<string, ReadinessScope> = {
  "no-schedule": "schedule",
  "no-staff-for-service": "service",
  "no-drivers": "dispatch",
  "no-resources": "space",
  "default-rules": "setup",
  "unassigned-bookings": "daily",
};

function mapSetupScope(issueId: string): ReadinessScope {
  return SETUP_SCOPE_MAP[issueId] ?? "setup";
}

// ── Fix advice derivation ─────────────────────────────────────────────────────

const SETUP_FIX_MAP: Record<string, string> = {
  "no-schedule": "Add at least one weekly schedule row for each service staff member.",
  "no-staff-for-service": "Assign at least one eligible therapist to each active service.",
  "no-drivers": "Add an active driver-type staff member to enable home-service dispatch.",
  "no-resources": "Add at least one active room or resource in Spaces & Rules.",
  "default-rules": "Review and save custom booking rules for this branch.",
  "unassigned-bookings": "Open the bookings queue and assign a therapist to each confirmed booking.",
};

function deriveSetupFix(issueId: string): string {
  return SETUP_FIX_MAP[issueId] ?? "Review and resolve this issue in the relevant settings page.";
}

// ── Deduplication ─────────────────────────────────────────────────────────────

const DEDUPE_SEVERITY_RANK: Record<ReadinessSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  success: 3,
};

/**
 * Deduplicates issues by id, keeping the higher-severity version on collision.
 * Returns a freshly sorted array — does not mutate the input.
 */
function dedupeReadinessIssues(issues: ReadinessIssue[]): ReadinessIssue[] {
  const byId = new Map<string, ReadinessIssue>();

  for (const issue of issues) {
    const existing = byId.get(issue.id);
    if (!existing) {
      byId.set(issue.id, issue);
      continue;
    }
    // Keep the entry with higher severity (lower rank number wins)
    const existingRank = DEDUPE_SEVERITY_RANK[existing.severity] ?? 3;
    const newRank = DEDUPE_SEVERITY_RANK[issue.severity] ?? 3;
    if (newRank < existingRank) {
      byId.set(issue.id, issue);
    }
  }

  return sortReadinessIssues([...byId.values()]);
}

// ── Source-failure issue factory ──────────────────────────────────────────────

/**
 * Creates a system-scoped warning issue when a readiness data source fails.
 * Informs operators that some checks are unavailable without exposing raw errors.
 */
function createSourceFailureIssue(params: {
  sourceKey: string;
  title: string;
  problem: string;
  actionHref: string;
  actionLabel: string;
}): ReadinessIssue {
  return {
    id: `system:failure:${params.sourceKey}`,
    scope: "system",
    severity: "warning",
    title: params.title,
    problem: params.problem,
    impact: "Some readiness issues may not appear until the page refreshes.",
    fix: "Refresh the page or check the relevant section directly.",
    actionLabel: params.actionLabel,
    actionHref: params.actionHref,
    source: "getCrmReadiness",
  };
}

// ── Mapper: SetupIssue[] → ReadinessIssue[] ───────────────────────────────────

/**
 * Maps the six SetupIssue records produced by getCrmSetupHealth into the
 * canonical ReadinessIssue shape.
 *
 * Issue id prefixed with "setup:" to avoid collisions with other sources.
 */
function mapSetupIssuesToReadinessIssues(issues: SetupIssue[]): ReadinessIssue[] {
  return issues.map((issue) => ({
    id: `setup:${issue.id}`,
    scope: mapSetupScope(issue.id),
    severity: mapSetupSeverity(issue.severity),
    title: issue.title,
    problem: issue.detail,
    impact: issue.impact,
    fix: deriveSetupFix(issue.id),
    actionLabel: issue.fixLabel,
    actionHref: issue.fixHref,
    source: "getCrmSetupHealth",
  }));
}

// ── Mapper: CrmAvailabilitySummary → ReadinessIssue[] ────────────────────────

/**
 * Maps live availability summary metrics to readiness issues.
 *
 * Covers:
 *   - Scheduled staff not yet checked in (daily / warning)
 *   - Staff with no schedule at all (schedule / warning)
 *   - No drivers ready for dispatch (dispatch / warning)
 *
 * Uses the staffReadiness field from CrmTodaySnapshot to avoid running a
 * separate getCrmAvailabilitySnapshot call in parallel.
 */
function mapStaffReadinessToReadinessIssues(
  summary: CrmAvailabilitySummary
): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];

  // Staff scheduled today but not yet checked in
  if (summary.notCheckedIn > 0) {
    const n = summary.notCheckedIn;
    issues.push({
      id: "availability:not-checked-in",
      scope: "daily",
      severity: "warning",
      title: `${n} scheduled staff ${n === 1 ? "has" : "have"} not checked in`,
      problem: `${n} staff member${n === 1 ? "" : "s"} scheduled today ${n === 1 ? "has" : "have"} not been marked present.`,
      impact: "CRM cannot rely on them for walk-ins, in-house bookings, or dispatch until they check in.",
      fix: "Mark arrived staff as checked in or update their status in Live Availability.",
      actionLabel: "Open Live Availability",
      actionHref: "/crm/availability",
      source: "getCrmAvailabilitySnapshot",
      count: n,
    });
  }

  // Staff with no schedule row — needs attention beyond just check-in
  if (summary.needsAttention > 0) {
    const n = summary.needsAttention;
    issues.push({
      id: "availability:needs-attention",
      scope: "schedule",
      severity: "warning",
      title: `${n} staff ${n === 1 ? "member needs" : "members need"} schedule attention`,
      problem: `${n} active staff member${n === 1 ? "" : "s"} ${n === 1 ? "has" : "have"} no saved schedule for today.`,
      impact: "They will not appear in online booking and cannot be assigned to sessions without a schedule.",
      fix: "Add individual schedule rows for each affected staff member in Schedule Setup.",
      actionLabel: "Open Schedule Setup",
      actionHref: "/crm/staff-availability",
      source: "getCrmAvailabilitySnapshot",
      count: n,
    });
  }

  // Drivers exist but none are ready — only meaningful if the branch has drivers
  if (summary.driversTotal > 0 && summary.driversReady === 0) {
    issues.push({
      id: "availability:drivers-not-ready",
      scope: "dispatch",
      severity: "warning",
      title: "No drivers are ready for dispatch",
      problem: `This branch has ${summary.driversTotal} driver${summary.driversTotal === 1 ? "" : "s"}, but none are currently checked in and available.`,
      impact: "Home-service trips cannot depart until at least one driver is checked in.",
      fix: "Check in an available driver or confirm their readiness in Live Availability.",
      actionLabel: "Open Dispatch",
      actionHref: "/crm/dispatch",
      source: "getCrmAvailabilitySnapshot",
      count: summary.driversTotal,
    });
  }

  return issues;
}

// ── Mapper: DispatchStats → ReadinessIssue[] ─────────────────────────────────

/**
 * Maps dispatch statistics to readiness issues.
 * Only emits an issue when home-service bookings are awaiting driver assignment.
 */
function mapDispatchStatsToReadinessIssues(stats: DispatchStats): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];

  if (stats.awaitingDispatch > 0) {
    const n = stats.awaitingDispatch;
    issues.push({
      id: "dispatch:awaiting-driver",
      scope: "dispatch",
      severity: "warning",
      title: `${n} home-service booking${n === 1 ? "" : "s"} awaiting driver assignment`,
      problem: `${n} confirmed home-service booking${n === 1 ? "" : "s"} ${n === 1 ? "has" : "have"} no driver assigned yet.`,
      impact: "Home-service trips cannot depart until a driver is assigned.",
      fix: "Open Dispatch and assign a driver to each pending trip.",
      actionLabel: "Open Dispatch",
      actionHref: "/crm/dispatch",
      source: "getCrmTodaySnapshot",
      count: n,
    });
  }

  return issues;
}

// ── Mapper: payment summary → ReadinessIssue[] ───────────────────────────────

/**
 * Maps daily payment summary data to readiness issues.
 * Payment data may be null if the payment query failed or columns are missing
 * (the schema supports graceful degradation for payment fields).
 */
function mapPaymentSummaryToReadinessIssues(
  payment: { unpaid_count: number } | null
): ReadinessIssue[] {
  if (!payment || payment.unpaid_count === 0) return [];

  const n = payment.unpaid_count;
  return [
    {
      id: "payment:unpaid-bookings",
      scope: "payment",
      severity: "warning",
      title: `${n} booking${n === 1 ? "" : "s"} pending payment review`,
      problem: `${n} active booking${n === 1 ? "" : "s"} ${n === 1 ? "has" : "have"} an unpaid or pending payment status.`,
      impact: "Revenue tracking and booking confirmation may be delayed or inaccurate.",
      fix: "Review payment status in the bookings list and confirm payments where needed.",
      actionLabel: "Review Bookings",
      actionHref: "/crm/bookings",
      source: "getCrmTodaySnapshot",
      count: n,
    },
  ];
}

// ── Main exports ──────────────────────────────────────────────────────────────

/**
 * getCrmReadinessIssues
 *
 * Runs existing CRM data sources in parallel and maps their results into a
 * deduplicated, sorted list of ReadinessIssue records.
 *
 * Error handling:
 *   - If a source fails, a system-scoped warning issue is emitted in its place.
 *   - The aggregator never throws — partial results are always returned.
 *   - Raw Supabase errors are never surfaced to callers.
 *
 * @param branchId  The branch to check readiness for.
 */
export async function getCrmReadinessIssues(
  branchId: string
): Promise<ReadinessIssue[]> {
  const today = new Date().toISOString().split("T")[0]!;
  const allIssues: ReadinessIssue[] = [];

  // Run the two primary sources in parallel.
  // getCrmTodaySnapshot already calls getCrmAvailabilitySnapshot internally,
  // so we obtain availability data through the today snapshot to avoid a
  // redundant second call to getCrmAvailabilitySnapshot.
  const [setupResult, todayResult] = await Promise.allSettled([
    getCrmSetupHealth(branchId),
    getCrmTodaySnapshot({ branchId, date: today }),
  ]);

  // ── Source 1: Setup health ─────────────────────────────────────────────────
  if (setupResult.status === "fulfilled") {
    allIssues.push(
      ...mapSetupIssuesToReadinessIssues(setupResult.value.issues)
    );
  } else {
    allIssues.push(
      createSourceFailureIssue({
        sourceKey: "setup",
        title: "Setup readiness could not be checked",
        problem: "The readiness engine could not load setup health data. Some configuration issues may not be visible.",
        actionHref: "/crm/setup",
        actionLabel: "Open Setup",
      })
    );
  }

  // ── Source 2: Today snapshot (availability + dispatch + payment) ───────────
  if (todayResult.status === "fulfilled") {
    const snap = todayResult.value;

    // 2a. Staff availability / check-in
    allIssues.push(...mapStaffReadinessToReadinessIssues(snap.staffReadiness));

    // 2b. Dispatch stats
    allIssues.push(...mapDispatchStatsToReadinessIssues(snap.dispatchStats));

    // 2c. Payment summary (payment field may be null if query gracefully failed)
    allIssues.push(...mapPaymentSummaryToReadinessIssues(snap.payment));
  } else {
    // Today snapshot failure covers availability + dispatch + payment
    allIssues.push(
      createSourceFailureIssue({
        sourceKey: "today",
        title: "Daily operational readiness could not be checked",
        problem: "The readiness engine could not load today's operational snapshot. Staff check-in, dispatch, and payment issues may not appear.",
        actionHref: "/crm/today",
        actionLabel: "Open Today",
      })
    );
  }

  return dedupeReadinessIssues(allIssues);
}

/**
 * getCrmReadiness
 *
 * Convenience wrapper that returns a full ReadinessResult (issues + status).
 * Use getCrmReadinessIssues if you only need the issue list.
 *
 * @param branchId  The branch to check readiness for.
 */
export async function getCrmReadiness(
  branchId: string
): Promise<ReadinessResult> {
  const issues = await getCrmReadinessIssues(branchId);
  return buildReadinessResult(issues);
}
