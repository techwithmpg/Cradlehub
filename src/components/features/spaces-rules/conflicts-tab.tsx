"use client";

import { ReadinessIssueList } from "@/components/shared/readiness-issue-list";
import { mapResourceConflictToReadinessIssue } from "./spaces-readiness-utils";
import { type ResourceConflict } from "./spaces-rules-utils";

export function ConflictsTab({
  conflicts,
}: {
  conflicts: ResourceConflict[];
  resources?: unknown;
  bookings?: unknown;
}) {
  const issues = conflicts.map((conflict, index) =>
    mapResourceConflictToReadinessIssue(conflict, index)
  );

  return (
    <ReadinessIssueList
      issues={issues}
      emptyTitle="No conflicts detected"
      emptyDescription="All bookings have room assignments and no overlaps or capacity overflows are found for today."
    />
  );
}
