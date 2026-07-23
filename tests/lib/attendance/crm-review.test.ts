import { describe, expect, it } from "vitest";
import { buildAttendanceReviewItems } from "@/lib/attendance/crm-review";
import type { AttendanceException } from "@/lib/attendance/types";

function exception(overrides: Partial<AttendanceException>): AttendanceException {
  return {
    id: "exception-1",
    branch_id: "branch-1",
    staff_id: "staff-1",
    checkin_id: null,
    scan_event_id: null,
    staff_name: "Aisha",
    exception_type: "blocked_scan",
    severity: "high",
    status: "open",
    message: "Blocked",
    metadata: {},
    detected_at: "2026-07-22T08:00:00Z",
    resolved_at: null,
    ...overrides,
  };
}

describe("CRM Attendance review queue", () => {
  it("does not turn timing statuses into repair incidents", () => {
    const items = buildAttendanceReviewItems([
      exception({ id: "late", exception_type: "late_clock_in" }),
      exception({ id: "early", exception_type: "early_leave" }),
      exception({ id: "real", exception_type: "missing_clock_out" }),
    ]);
    expect(items.map((item) => item.exception.id)).toEqual(["real"]);
  });

  it("uses the legacy internal subtype instead of the manual storage bucket", () => {
    const items = buildAttendanceReviewItems([
      exception({
        id: "legacy-early",
        exception_type: "manual",
        metadata: { internalExceptionType: "early_clock_in" },
      }),
      exception({
        id: "legacy-ambiguous",
        exception_type: "manual",
        metadata: { internalExceptionType: "ambiguous_scan" },
      }),
    ]);

    expect(items.map((item) => item.exception.id)).toEqual(["legacy-ambiguous"]);
    expect(items[0]?.category).toBe("clock");
  });

  it("deduplicates exception rows that refer to one attendance record", () => {
    const items = buildAttendanceReviewItems([
      exception({ id: "one", checkin_id: "checkin-1" }),
      exception({ id: "two", checkin_id: "checkin-1", exception_type: "missing_clock_out" }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.relatedExceptionIds).toEqual(["one", "two"]);
  });

  it("uses the same canonical list for the visible count", () => {
    const items = buildAttendanceReviewItems([
      exception({ id: "one", scan_event_id: "scan-1" }),
      exception({ id: "two", scan_event_id: "scan-1" }),
      exception({ id: "closed", status: "resolved" }),
    ]);
    expect(items.length).toBe(1);
  });
});
