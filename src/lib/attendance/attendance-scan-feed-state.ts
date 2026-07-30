import { collapseRecentAttendanceScans } from "@/lib/attendance/recent-scan-grouping";
import type {
  AttendanceScanFeedData,
  AttendanceScanOperation,
  RecentAttendanceScan,
} from "@/lib/attendance/types";

const ONE_HOUR_MS = 60 * 60 * 1000;

function branchDate(value: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function pruneAttendanceLastHourOperations(
  operations: AttendanceScanOperation[],
  nowMs = Date.now()
): AttendanceScanOperation[] {
  const cutoff = nowMs - ONE_HOUR_MS;
  const byOperation = new Map<string, AttendanceScanOperation>();
  for (const operation of operations) {
    const occurredAtMs = new Date(operation.occurredAt).getTime();
    if (!Number.isFinite(occurredAtMs) || occurredAtMs <= cutoff) continue;
    const current = byOperation.get(operation.operationId);
    if (!current || operation.occurredAt > current.occurredAt) {
      byOperation.set(operation.operationId, operation);
    }
  }
  return [...byOperation.values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

export function mergeAttendanceScanFeed(
  feed: AttendanceScanFeedData,
  scans: RecentAttendanceScan[],
  operations: AttendanceScanOperation[],
  maxItems: number,
  nowMs = Date.now(),
  nextCursor: string | null = feed.nextCursor
): AttendanceScanFeedData {
  const relevantScans = scans.filter(
    (scan) =>
      (!feed.branchId || !scan.branchId || scan.branchId === feed.branchId) &&
      branchDate(scan.occurredAt, scan.timezone || feed.timezone) === feed.selectedDate
  );
  const lastHourOperations = pruneAttendanceLastHourOperations(
    [...feed.lastHourOperations, ...operations],
    nowMs
  );

  return {
    ...feed,
    items: collapseRecentAttendanceScans([...relevantScans, ...feed.items], maxItems),
    lastHourOperations,
    lastHourCount: lastHourOperations.length,
    nextCursor,
    error: null,
  };
}
