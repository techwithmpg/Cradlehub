/**
 * schedule-readiness-utils.ts
 *
 * Pure helper functions that map schedule coverage data to ReadinessIssue objects.
 * Used by ScheduleCoverageIssues (client context) and ScheduleSetupHealthSummary (server).
 * No React. No server-only APIs.
 */

import type { ReadinessIssue } from "@/types/readiness";

const ACTION_HREF = "/crm/staff-availability";

/**
 * Warning banner used in ScheduleSetupHealthSummary.
 * N staff have no individual schedule — may still have group coverage.
 * Points to Coverage Issues tab for detail.
 */
export function buildMissingScheduleIssue(count: number): ReadinessIssue {
  const s = count !== 1;
  return {
    id: "schedule:missing-individual-schedule",
    scope: "schedule",
    severity: "warning",
    title: `${count} staff member${s ? "s" : ""} ${s ? "have" : "has"} no individual weekly schedule`,
    problem: "These staff do not have individual schedule rows configured.",
    impact:
      "They may still be covered by a group schedule rule — but if not, they will not appear in online booking or staff assignment.",
    fix: "Check the Coverage Issues tab to confirm group schedule coverage, or create individual schedules where needed.",
    actionLabel: "View Coverage Issues",
    actionHref: ACTION_HREF,
    source: "ScheduleSetupHealthSummary",
    entityType: "staff",
    count,
  };
}

/**
 * Critical: staff with no individual schedule AND no active group rules.
 * These staff have zero schedule coverage — affects online booking and availability.
 */
export function buildNoGroupOrIndividualIssue(count: number): ReadinessIssue {
  const s = count !== 1;
  return {
    id: "schedule:no-group-or-individual",
    scope: "schedule",
    severity: "critical",
    title: `${count} staff member${s ? "s" : ""} ${s ? "have" : "has"} no schedule coverage`,
    problem:
      "Some staff have neither an individual schedule nor an active group schedule rule.",
    impact:
      "They will not appear correctly in online booking, live availability, or staff assignment until a schedule is configured.",
    fix: "Assign each staff member to a schedule group or create an individual weekly schedule.",
    actionLabel: "Fix Schedule Coverage",
    actionHref: ACTION_HREF,
    source: "ScheduleCoverageIssues",
    entityType: "staff",
    count,
  };
}

/**
 * Warning: staff with no active individual schedule rows.
 * They may still have group schedule coverage — use Coverage Issues tab to confirm.
 */
export function buildNoActiveScheduleIssue(count: number): ReadinessIssue {
  const s = count !== 1;
  return {
    id: "schedule:no-active-schedule",
    scope: "schedule",
    severity: "warning",
    title: `${count} staff member${s ? "s" : ""} ${s ? "have" : "has"} no active individual schedule`,
    problem: "These staff have no active individual schedule rows configured.",
    impact:
      "If they are also not covered by a group schedule rule, they will not appear in online booking or staff assignment.",
    fix: "Review schedule group coverage or add individual schedules for each affected staff member.",
    actionLabel: "Review Schedule Groups",
    actionHref: ACTION_HREF,
    source: "ScheduleCoverageIssues",
    entityType: "staff",
    count,
  };
}

/**
 * Warning: staff scheduled today but with no opening shift type assigned.
 */
export function buildNoOpeningShiftIssue(count: number): ReadinessIssue {
  const s = count !== 1;
  return {
    id: "schedule:no-opening-shift-today",
    scope: "schedule",
    severity: "warning",
    title: `${count} scheduled staff member${s ? "s" : ""} ${s ? "have" : "has"} no opening shift today`,
    problem:
      "These staff are scheduled to work today but have no opening shift type assigned.",
    impact:
      "Opening-shift coverage may be incomplete — CRM may need to manually confirm who opens the branch today.",
    fix: "Review the opening-duty schedule or update the manual schedule import for today.",
    actionLabel: "Review Manual Schedule",
    actionHref: ACTION_HREF,
    source: "ScheduleCoverageIssues",
    entityType: "staff",
    count,
  };
}

/**
 * Info: staff with a day-off override for today.
 * Informational only — no action required unless an entry is incorrect.
 */
export function buildOnLeaveTodayIssue(count: number): ReadinessIssue {
  const s = count !== 1;
  return {
    id: "schedule:on-leave-today",
    scope: "schedule",
    severity: "info",
    title: `${count} staff member${s ? "s" : ""} ${s ? "are" : "is"} on leave today`,
    problem: "Some staff have a day-off override for today.",
    impact: "They will not be considered available for same-day in-house or home-service operations.",
    fix: "No action needed unless a leave entry is incorrect.",
    actionLabel: "Review Overrides",
    actionHref: ACTION_HREF,
    source: "ScheduleCoverageIssues",
    entityType: "staff",
    count,
  };
}
