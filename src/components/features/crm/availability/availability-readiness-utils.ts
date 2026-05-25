/**
 * availability-readiness-utils.ts
 *
 * Pure helpers that map CrmAvailabilitySummary data → ReadinessIssue[].
 * No React. No server-only APIs. Works in both server and client contexts.
 *
 * Exported functions:
 *   buildAvailabilityReadinessIssues  — page-level strip (after health summary cards)
 *   buildNoScheduleStaffIssue         — ScheduleIssuesView tab banner
 */

import type { ReadinessIssue } from "@/types/readiness";
import type { CrmAvailabilitySummary } from "@/lib/queries/crm-availability";

// ── Page-level availability issues ───────────────────────────────────────────

/**
 * Derives ReadinessIssue[] from the availability snapshot summary.
 * Emits up to 3 issues: not-checked-in, needs-attention (no schedule), drivers-not-ready.
 * Does not invent data — only emits when counts indicate a real problem.
 */
export function buildAvailabilityReadinessIssues(
  summary: CrmAvailabilitySummary
): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];

  // ── Not checked in ─────────────────────────────────────────────────────────
  if (summary.notCheckedIn > 0) {
    const c = summary.notCheckedIn;
    const s = c !== 1;
    issues.push({
      id: "availability:not-checked-in",
      scope: "daily",
      severity: "warning",
      title: `${c} scheduled staff member${s ? "s" : ""} ${s ? "have" : "has"} not checked in`,
      problem: `${c} staff member${s ? "s are" : " is"} scheduled for today but ${s ? "have" : "has"} not been marked present yet.`,
      impact:
        "CRM cannot rely on them for walk-ins, in-house bookings, or dispatch until their status is confirmed.",
      fix: "Check in arrived staff using the Staff List tab, or mark unavailable staff clearly.",
      actionLabel: "Open Staff List",
      actionHref: "/crm/availability",
      source: "CrmAvailabilitySummary",
      entityType: "staff",
      count: c,
    });
  }

  // ── Needs attention (no weekly schedule) ───────────────────────────────────
  if (summary.needsAttention > 0) {
    const c = summary.needsAttention;
    const s = c !== 1;
    issues.push({
      id: "availability:needs-attention",
      scope: "schedule",
      severity: "warning",
      title: `${c} staff member${s ? "s" : ""} ${s ? "have" : "has"} no weekly schedule`,
      problem: `${c} staff member${s ? "s have" : " has"} no weekly schedule configured.`,
      impact:
        "They may not appear correctly in live availability or booking assignment until a schedule is set.",
      fix: "Review schedule setup and add the missing schedule rules for each affected staff member.",
      actionLabel: "Open Schedule Setup",
      actionHref: "/crm/staff-availability",
      source: "CrmAvailabilitySummary",
      entityType: "staff",
      count: c,
    });
  }

  // ── Drivers not ready ──────────────────────────────────────────────────────
  if (summary.driversTotal > 0 && summary.driversReady === 0) {
    issues.push({
      id: "availability:drivers-not-ready",
      scope: "dispatch",
      severity: "warning",
      title: "No drivers are ready for dispatch",
      problem:
        "None of the branch drivers are checked in and available for home-service dispatch.",
      impact:
        "Home-service bookings may be delayed or require manual coordination if dispatched now.",
      fix: "Check in available drivers using the Driver Readiness tab.",
      actionLabel: "Open Driver Readiness",
      actionHref: "/crm/availability",
      source: "CrmAvailabilitySummary",
      count: summary.driversTotal,
    });
  }

  return issues;
}

// ── Schedule Issues tab banner ────────────────────────────────────────────────

/**
 * Builds a single ReadinessIssue for the ScheduleIssuesView tab.
 * Shows the count of staff with no weekly schedule configured.
 */
export function buildNoScheduleStaffIssue(count: number): ReadinessIssue {
  const s = count !== 1;
  return {
    id: "availability:schedule-issues",
    scope: "schedule",
    severity: "warning",
    title: `${count} staff member${s ? "s" : ""} ${s ? "have" : "has"} no weekly schedule`,
    problem: `${count} staff member${s ? "s" : ""} listed below ${s ? "have" : "has"} no weekly schedule configured.`,
    impact:
      "These staff will not appear in the booking engine or live availability until a schedule is set.",
    fix: "Go to Schedule Setup and add a weekly pattern or assign them to a schedule group.",
    actionLabel: "Open Schedule Setup",
    actionHref: "/crm/staff-availability",
    source: "ScheduleIssuesView",
    entityType: "staff",
    count,
  };
}
