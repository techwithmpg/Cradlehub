import { describe, expect, it } from "vitest";
import {
  collapseRecentAttendanceScans,
  countAttendanceScanOperations,
} from "@/lib/attendance/recent-scan-grouping";
import type { RecentAttendanceScan } from "@/lib/attendance/types";

function scan(
  overrides: Partial<RecentAttendanceScan> & { eventId: string; rootOperationId: string }
): RecentAttendanceScan {
  const { eventId, rootOperationId, operationId = rootOperationId, ...rest } = overrides;
  return {
    eventId,
    rootOperationId,
    operationId,
    staffId: null,
    staffName: "Unknown device",
    staffNickname: null,
    staffAvatarUrl: null,
    branchId: "branch-1",
    branchName: "Main",
    eventType: "scan",
    outcome: "blocked",
    reasonCode: "unknown_device",
    message: "Phone not connected",
    occurredAt: "2026-07-29T01:00:00.000Z",
    timezone: "Asia/Manila",
    shiftType: null,
    attendanceStatus: null,
    workedMinutes: null,
    clockInAt: null,
    clockOutAt: null,
    sourceLabel: "Main Attendance",
    ...rest,
  };
}

describe("recent Attendance scan grouping", () => {
  it("shows one final outcome for a first-scan phone connection flow", () => {
    const result = collapseRecentAttendanceScans(
      [
        scan({ eventId: "unknown", rootOperationId: "root-1" }),
        scan({
          eventId: "clock-in",
          rootOperationId: "root-1",
          operationId: "root-1:attendance",
          staffId: "staff-1",
          staffName: "Malcom",
          eventType: "clock_in",
          outcome: "success",
          reasonCode: "clock_in",
          message: "Clocked in",
          occurredAt: "2026-07-29T01:00:03.000Z",
          attendanceStatus: "present",
        }),
      ],
      5
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.eventId).toBe("clock-in");
    expect(result[0]?.staffName).toBe("Malcom");
  });

  it("counts physical root operations instead of child events", () => {
    expect(
      countAttendanceScanOperations([
        { id: "1", operation_id: "root-1", request_id: "root-1" },
        { id: "2", operation_id: "root-1:attendance", request_id: "root-1:attendance" },
        { id: "3", operation_id: "root-2", request_id: "root-2" },
      ])
    ).toBe(2);
  });

  it("keeps a final blocked security result over an earlier neutral event", () => {
    const result = collapseRecentAttendanceScans(
      [
        scan({
          eventId: "neutral",
          rootOperationId: "root-1",
          outcome: "noop",
          occurredAt: "2026-07-29T01:00:01.000Z",
        }),
        scan({
          eventId: "blocked",
          rootOperationId: "root-1",
          outcome: "blocked",
          reasonCode: "device_revoked",
          occurredAt: "2026-07-29T01:00:02.000Z",
        }),
      ],
      5
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.eventId).toBe("blocked");
  });

  it("keeps an authoritative duplicate result over an intermediate unknown-device block", () => {
    const result = collapseRecentAttendanceScans(
      [
        scan({
          eventId: "unknown",
          rootOperationId: "root-1",
          outcome: "blocked",
          reasonCode: "unknown_device",
        }),
        scan({
          eventId: "duplicate",
          rootOperationId: "root-1",
          eventType: "duplicate_scan",
          outcome: "noop",
          reasonCode: "duplicate_scan",
          occurredAt: "2026-07-29T01:00:02.000Z",
        }),
      ],
      5
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.eventId).toBe("duplicate");
  });
});
