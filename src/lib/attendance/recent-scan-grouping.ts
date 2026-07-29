import type { RecentAttendanceScan } from "@/lib/attendance/types";

export function rootAttendanceOperationId(
  operationId: string | null | undefined,
  requestId: string | null | undefined,
  eventId: string
): string {
  const value = operationId?.trim() || requestId?.trim() || eventId;
  return value.split(":", 1)[0] || eventId;
}

function outcomeRank(scan: RecentAttendanceScan): number {
  if (scan.attendanceStatus || scan.eventType === "clock_in" || scan.eventType === "clock_out") {
    return 100;
  }
  if (scan.eventType === "duplicate_scan" || scan.reasonCode === "duplicate_scan") return 90;
  if (scan.reasonCode === "unknown_device" || scan.reasonCode === "device_not_registered") {
    return 10;
  }
  if (scan.outcome === "blocked") return 80;
  if (scan.outcome === "exception") return 70;
  if (scan.outcome === "success") return 60;
  if (scan.outcome === "noop") return 50;
  return 40;
}

function shouldReplace(current: RecentAttendanceScan, candidate: RecentAttendanceScan): boolean {
  const currentRank = outcomeRank(current);
  const candidateRank = outcomeRank(candidate);
  if (candidateRank !== currentRank) return candidateRank > currentRank;
  return new Date(candidate.occurredAt).getTime() > new Date(current.occurredAt).getTime();
}

export function collapseRecentAttendanceScans(
  scans: RecentAttendanceScan[],
  maxItems: number
): RecentAttendanceScan[] {
  const grouped = new Map<string, RecentAttendanceScan>();

  for (const scan of scans) {
    const rootId = scan.rootOperationId ?? scan.eventId;
    const current = grouped.get(rootId);
    if (!current || shouldReplace(current, scan)) {
      grouped.set(rootId, scan);
    }
  }

  return [...grouped.values()]
    .sort(
      (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
    )
    .slice(0, maxItems);
}

export function countAttendanceScanOperations(
  rows: Array<{
    id: string;
    request_id?: string | null;
    operation_id?: string | null;
  }>
): number {
  return new Set(
    rows.map((row) => rootAttendanceOperationId(row.operation_id, row.request_id, row.id))
  ).size;
}
