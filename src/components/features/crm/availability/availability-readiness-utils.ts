/**
 * availability-readiness-utils.ts
 *
 * Pure helpers that map CrmAvailabilitySummary data → ReadinessIssue[].
 * No React. No server-only APIs. Works in both server and client contexts.
 *
 * Key separation rule:
 *   - Check-in/check-out warnings  → scope "daily"    → walk-ins, dispatch, same-day ops
 *   - Schedule warnings            → scope "schedule"  → online booking visibility
 *   - Pending booking warnings     → scope "payment"   → CRM confirmation follow-up
 *
 * Exported functions:
 *   buildAvailabilityReadinessIssues  — page-level strip (after health summary cards)
 *   buildServiceStaffNoScheduleIssue  — ScheduleIssuesView tab banner (service staff)
 *   buildOpsStaffNoScheduleIssue      — ScheduleIssuesView tab banner (other staff)
 */

import type { ReadinessIssue } from "@/types/readiness";
import type { CrmAvailabilitySummary } from "@/lib/queries/crm-availability";

// ── Page-level availability issues ───────────────────────────────────────────

/**
 * Derives ReadinessIssue[] from the availability snapshot summary.
 *
 * Issues emitted (when applicable):
 *   1. Pending online bookings needing CRM action
 *   2. Service staff with no schedule (affects online booking)
 *   3. Scheduled staff not checked in (affects walk-ins and dispatch only)
 *   4. No drivers ready for dispatch
 */
export function buildAvailabilityReadinessIssues(
  summary: CrmAvailabilitySummary
): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];

  // ── Pending online bookings ────────────────────────────────────────────────
  if (summary.pendingOnlineBookings > 0) {
    const c = summary.pendingOnlineBookings;
    const pl = c !== 1;
    issues.push({
      id: "availability:pending-online-bookings",
      scope: "payment",
      severity: "warning",
      title: `${c} online booking${pl ? "s" : ""} need${pl ? "" : "s"} CRM follow-up`,
      problem: `${c} booking${pl ? "s are" : " is"} waiting for payment confirmation or CRM action.`,
      impact:
        "Bookings left in pending status may expire or block the slot from being re-used until actioned.",
      fix: "Open CRM Bookings and confirm payment, cancel, or reschedule each pending booking.",
      actionLabel: "Open CRM Bookings",
      actionHref: "/crm/bookings",
      source: "CrmAvailabilitySummary",
      entityType: "booking",
      count: c,
    });
  }

  // ── Service staff with no weekly schedule (online booking impact) ──────────
  if (summary.serviceStaffNoSchedule > 0) {
    const c = summary.serviceStaffNoSchedule;
    const pl = c !== 1;
    issues.push({
      id: "availability:service-staff-no-schedule",
      scope: "schedule",
      severity: "warning",
      title: `${c} therapist${pl ? "s" : ""} / service provider${pl ? "s" : ""} ${pl ? "have" : "has"} no schedule set up`,
      problem: `${c} service staff member${pl ? "s have" : " has"} no weekly schedule rows configured.`,
      impact:
        "These therapists will not appear in the online booking engine until schedule rows are added. Online booking uses saved schedules — not daily check-in.",
      fix: "Go to Schedule Setup Center and add a weekly schedule pattern for each affected therapist.",
      actionLabel: "Open Schedule Setup",
      actionHref: "/crm/staff-availability",
      source: "CrmAvailabilitySummary",
      entityType: "staff",
      count: c,
    });
  }

  // ── Non-service staff with no schedule (operations only) ──────────────────
  const opsStaffNoSchedule = summary.needsAttention - summary.serviceStaffNoSchedule;
  if (opsStaffNoSchedule > 0) {
    const c = opsStaffNoSchedule;
    const pl = c !== 1;
    issues.push({
      id: "availability:ops-staff-no-schedule",
      scope: "daily",
      severity: "info",
      title: `${c} non-service staff member${pl ? "s" : ""} ${pl ? "have" : "has"} no saved schedule for today`,
      problem: `${c} active staff member${pl ? "s (drivers, CSR, or utility)" : " (driver, CSR, or utility)"} ${pl ? "have" : "has"} no schedule configured for today.`,
      impact:
        "These staff will not appear in the live availability board. Online booking is not affected.",
      fix: "Review schedule setup for drivers, CSR, and utility staff.",
      actionLabel: "Open Schedule Setup",
      actionHref: "/crm/staff-availability",
      source: "CrmAvailabilitySummary",
      entityType: "staff",
      count: c,
    });
  }

  // ── Not checked in (daily ops — walk-ins and dispatch only) ───────────────
  if (summary.notCheckedIn > 0) {
    const c = summary.notCheckedIn;
    const pl = c !== 1;
    issues.push({
      id: "availability:not-checked-in",
      scope: "daily",
      severity: "warning",
      title: `${c} scheduled staff member${pl ? "s" : ""} ${pl ? "have" : "has"} not checked in`,
      problem: `${c} staff member${pl ? "s are" : " is"} scheduled for today but ${pl ? "have" : "has"} not been marked present yet.`,
      impact:
        "These staff are not available for walk-ins, in-house bookings, or dispatch until checked in. Online booking still follows saved schedules and is not affected.",
      fix: "Check in arrived staff using the Staff List tab, or mark unavailable staff as absent.",
      actionLabel: "Open Staff List",
      actionHref: "/crm/availability",
      source: "CrmAvailabilitySummary",
      entityType: "staff",
      count: c,
    });
  }

  // ── Drivers not ready for dispatch ────────────────────────────────────────
  if (summary.driversTotal > 0 && summary.driversReady === 0) {
    issues.push({
      id: "availability:drivers-not-ready",
      scope: "dispatch",
      severity: "warning",
      title: "No drivers are ready for dispatch",
      problem:
        "None of the branch drivers are checked in and available for home-service dispatch.",
      impact:
        "Home-service dispatch cannot start until at least one driver is checked in. Online home-service booking slots are not affected — only same-day dispatch assignment.",
      fix: "Check in available drivers using the Driver Readiness tab.",
      actionLabel: "Open Driver Readiness",
      actionHref: "/crm/availability",
      source: "CrmAvailabilitySummary",
      count: summary.driversTotal,
    });
  }

  return issues;
}

// ── Schedule Issues tab banners ───────────────────────────────────────────────

/**
 * Builds a ReadinessIssue for service staff (therapists, nail techs, etc.) with no weekly schedule.
 * This directly affects online booking visibility.
 */
export function buildServiceStaffNoScheduleIssue(count: number): ReadinessIssue {
  const pl = count !== 1;
  return {
    id: "availability:service-staff-schedule-issues",
    scope: "schedule",
    severity: "warning",
    title: `${count} therapist${pl ? "s" : ""} / service provider${pl ? "s" : ""} ${pl ? "have" : "has"} no weekly schedule`,
    problem: `${count} service staff member${pl ? "s" : ""} listed below ${pl ? "have" : "has"} no weekly schedule configured.`,
    impact:
      "These therapists will not appear in the online booking engine. Online booking uses saved schedules, not daily check-in.",
    fix: "Go to Schedule Setup Center and add a weekly pattern or assign them to a schedule group.",
    actionLabel: "Open Schedule Setup",
    actionHref: "/crm/staff-availability",
    source: "ScheduleIssuesView",
    entityType: "staff",
    count,
  };
}

/**
 * Builds a ReadinessIssue for non-service staff (drivers, CSR, utility) with no weekly schedule.
 * Affects CRM live availability and operations — does not affect online booking.
 */
export function buildOpsStaffNoScheduleIssue(count: number): ReadinessIssue {
  const pl = count !== 1;
  return {
    id: "availability:ops-staff-schedule-issues",
    scope: "daily",
    severity: "info",
    title: `${count} non-service staff member${pl ? "s" : ""} ${pl ? "have" : "has"} no weekly schedule`,
    problem: `${count} staff member${pl ? "s (drivers, CSR, utility)" : " (driver, CSR, or utility)"} listed below ${pl ? "have" : "has"} no weekly schedule configured.`,
    impact:
      "These staff will not appear in the live availability board. Online booking is not affected.",
    fix: "Go to Schedule Setup Center and add schedule rows for operational staff.",
    actionLabel: "Open Schedule Setup",
    actionHref: "/crm/staff-availability",
    source: "ScheduleIssuesView",
    entityType: "staff",
    count,
  };
}
