/**
 * dispatch-readiness-utils.ts
 *
 * Pure helpers that map DispatchAlert → ReadinessIssue[].
 * No React. No server-only APIs. Works in both server and client contexts.
 *
 * Exported functions:
 *   mapDispatchAlertToReadinessIssue  — single alert → ReadinessIssue
 *   buildAlertIssues                  — DispatchAlert[] → ReadinessIssue[]
 */

import type { ReadinessIssue } from "@/types/readiness";
import type { DispatchAlert } from "@/features/dispatch/types";

const ACTION_HREF = "/crm/dispatch";

/**
 * Maps a single DispatchAlert to a ReadinessIssue.
 *
 * Severity mapping:
 *   "danger"  → "critical"
 *   "warning" → "warning"
 *
 * problem is sourced from alert.description (preserves operational detail).
 * impact and fix are derived from the alert title pattern.
 */
export function mapDispatchAlertToReadinessIssue(alert: DispatchAlert): ReadinessIssue {
  const severity = alert.severity === "danger" ? "critical" : "warning";

  let impact: string;
  let fix: string;

  if (alert.title === "No Driver Assigned") {
    impact = "This trip cannot be dispatched until a driver is assigned.";
    fix = "Select a driver using the recommendation panel in the dispatch queue row.";
  } else if (alert.title === "Location Needs Confirmation") {
    impact = "Driver routing and live ETA calculation are blocked without a confirmed address.";
    fix = "Confirm the customer address before dispatching this trip.";
  } else if (alert.title === "Booking Running Late") {
    impact = "The customer may be waiting. Escalate if the driver has not updated progress.";
    fix = "Contact the driver for a status update and advance the booking progress manually if needed.";
  } else {
    impact = "This dispatch alert requires immediate attention.";
    fix = "Review the booking in the dispatch queue and resolve the issue.";
  }

  return {
    id: `dispatch:alert:${alert.id}`,
    scope: "dispatch",
    severity,
    title: `${alert.dispatchNumber} · ${alert.title}`,
    problem: alert.description,
    impact,
    fix,
    actionLabel: "Open Dispatch Queue",
    actionHref: ACTION_HREF,
    source: "computeAlerts",
    entityType: "booking",
    entityIds: [alert.bookingId],
  };
}

/**
 * Converts a list of DispatchAlerts to ReadinessIssue[].
 * Preserves original order (computeAlerts already orders by booking time).
 */
export function buildAlertIssues(alerts: DispatchAlert[]): ReadinessIssue[] {
  return alerts.map(mapDispatchAlertToReadinessIssue);
}
