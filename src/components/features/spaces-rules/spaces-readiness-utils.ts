/**
 * spaces-readiness-utils.ts
 *
 * Pure helpers that map ResourceConflict → ReadinessIssue.
 * No React. No server-only APIs. Works in both server and client contexts.
 *
 * Two exported functions:
 *   mapResourceConflictToReadinessIssue — one issue per conflict (for ConflictsTab full list)
 *   buildConflictSummaryIssues          — one aggregate issue per conflict type (for OverviewTab alerts)
 */

import type { ReadinessIssue } from "@/types/readiness";
import type { ResourceConflict } from "./spaces-rules-utils";

const ACTION_HREF = "/crm/spaces-rules";

// ── Per-conflict mapping ──────────────────────────────────────────────────────

/**
 * Maps a single ResourceConflict to a ReadinessIssue.
 * The conflict's `description` field becomes the `problem` text so no
 * operational detail is lost.
 *
 * @param conflict  The conflict object from computeResourceConflicts()
 * @param index     Fallback index for generating a stable id on unknown types
 */
export function mapResourceConflictToReadinessIssue(
  conflict: ResourceConflict,
  index: number
): ReadinessIssue {
  if (conflict.type === "missing_assignment") {
    return {
      id: `space:missing-assignment:${conflict.bookingId}`,
      scope: "space",
      severity: "warning",
      title: "Booking is missing a room/resource assignment",
      problem: conflict.description,
      impact:
        "CRM may need to manually assign a room before the customer can be served smoothly.",
      fix: "Review the booking and assign an available room or resource.",
      actionLabel: "Review Spaces & Rules",
      actionHref: ACTION_HREF,
      source: "computeResourceConflicts",
      entityType: "booking",
      entityIds: [conflict.bookingId],
      count: 1,
    };
  }

  if (conflict.type === "overlap") {
    return {
      id: `space:overlap:${conflict.resourceId}:${conflict.bookingA}`,
      scope: "space",
      severity: "critical",
      title: "Room/resource booking overlap detected",
      problem: conflict.description,
      impact:
        "This creates a double-booking at the branch and can disrupt in-spa operations.",
      fix: "Move one booking to another resource or reschedule one of the affected bookings.",
      actionLabel: "Review Resource Conflicts",
      actionHref: ACTION_HREF,
      source: "computeResourceConflicts",
      entityType: "booking",
      entityIds: [conflict.bookingA, conflict.bookingB],
      count: 1,
    };
  }

  if (conflict.type === "capacity_overflow") {
    return {
      id: `space:capacity-overflow:${conflict.resourceId}`,
      scope: "space",
      severity: "critical",
      title: "Room/resource capacity overflow detected",
      problem: conflict.description,
      impact:
        "The branch may not have enough physical space to serve all bookings at the selected time.",
      fix: "Adjust booking assignments, increase resource capacity if correct, or reschedule affected bookings.",
      actionLabel: "Review Capacity",
      actionHref: ACTION_HREF,
      source: "computeResourceConflicts",
      entityType: "space",
      entityIds: [conflict.resourceId],
      count: 1,
    };
  }

  // Exhaustive fallback for any future conflict type
  return {
    id: `space:unknown:${index}`,
    scope: "space",
    severity: "warning",
    title: "Resource readiness needs review",
    problem: "A room/resource condition needs attention.",
    impact:
      "CRM may need to review room readiness before confirming operations.",
    fix: "Review spaces and booking rules.",
    actionLabel: "Review Spaces & Rules",
    actionHref: ACTION_HREF,
    source: "computeResourceConflicts",
    count: 1,
  };
}

// ── Aggregate summary mapping ─────────────────────────────────────────────────

/**
 * Aggregates all conflicts into one summary ReadinessIssue per conflict type.
 * Used for the Overview tab "Alerts" section where a compact summary is better
 * than one card per conflict.
 *
 * Critical types (overlap, capacity_overflow) are listed before warnings.
 */
export function buildConflictSummaryIssues(
  conflicts: ResourceConflict[]
): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];

  const overlapCount = conflicts.filter((c) => c.type === "overlap").length;
  const capacityCount = conflicts.filter(
    (c) => c.type === "capacity_overflow"
  ).length;
  const missingCount = conflicts.filter(
    (c) => c.type === "missing_assignment"
  ).length;

  if (overlapCount > 0) {
    const s = overlapCount !== 1;
    issues.push({
      id: "space:overlap:summary",
      scope: "space",
      severity: "critical",
      title: `${overlapCount} overlapping booking${s ? "s" : ""} detected`,
      problem: `${overlapCount} pair${s ? "s" : ""} of bookings ${s ? "are" : "is"} assigned to the same room at overlapping times.`,
      impact:
        "Double-booking creates conflicts at the branch and disrupts in-spa operations.",
      fix: "Move one booking to another resource or reschedule one of the affected bookings.",
      actionLabel: "Review Conflicts",
      actionHref: ACTION_HREF,
      source: "computeResourceConflicts",
      count: overlapCount,
    });
  }

  if (capacityCount > 0) {
    const s = capacityCount !== 1;
    issues.push({
      id: "space:capacity-overflow:summary",
      scope: "space",
      severity: "critical",
      title: `${capacityCount} resource${s ? "s" : ""} over capacity`,
      problem: `${capacityCount} room${s ? "s are" : " is"} assigned more bookings than its configured capacity.`,
      impact:
        "The branch may not have enough physical space to serve all bookings at the same time.",
      fix: "Adjust booking assignments, increase resource capacity if correct, or reschedule bookings.",
      actionLabel: "Review Capacity",
      actionHref: ACTION_HREF,
      source: "computeResourceConflicts",
      count: capacityCount,
    });
  }

  if (missingCount > 0) {
    const s = missingCount !== 1;
    issues.push({
      id: "space:missing-assignment:summary",
      scope: "space",
      severity: "warning",
      title: `${missingCount} booking${s ? "s" : ""} missing a room assignment`,
      problem: `${missingCount} non-home-service booking${s ? "s have" : " has"} no room or resource assigned.`,
      impact:
        "CRM may need to manually assign rooms before customers can be served smoothly.",
      fix: "Review each affected booking and assign an available room or resource.",
      actionLabel: "Review Spaces & Rules",
      actionHref: ACTION_HREF,
      source: "computeResourceConflicts",
      count: missingCount,
    });
  }

  return issues;
}
