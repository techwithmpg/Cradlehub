import { describe, expect, it } from "vitest";
import {
  filterAttendanceExceptionsForBusinessDay,
  isActionableAttendanceException,
} from "@/lib/attendance/attendance-exception-actionability";
import type { AttendanceException, AttendanceRecord } from "@/lib/attendance/types";

function exception(overrides: Partial<AttendanceException> = {}): AttendanceException {
  return {
    id: "exception-1",
    branch_id: "branch-1",
    staff_id: "staff-1",
    checkin_id: null,
    scan_event_id: null,
    staff_name: "Maria",
    exception_type: "ambiguous_scan",
    severity: "high",
    status: "open",
    message: "Review",
    metadata: {},
    detected_at: "2026-07-22T03:00:00.000Z",
    resolved_at: null,
    ...overrides,
  };
}

function record(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: "checkin-today",
    branch_id: "branch-1",
    staff_id: "staff-1",
    staff_name: "Maria",
    staff_nickname: null,
    staff_type: "therapist",
    system_role: "staff",
    shift_date: "2026-07-22",
    shift_type: "single",
    scheduled_start_at: null,
    scheduled_end_at: null,
    checked_in_at: "2026-07-22T02:00:00.000Z",
    checked_out_at: null,
    status: "checked_in",
    attendance_status: "present",
    exception_state: null,
    worked_minutes: 0,
    late_minutes: 0,
    early_leave_minutes: 0,
    overtime_minutes: 0,
    clock_in_method: "qr",
    clock_out_method: null,
    attendance_expected_end_at: null,
    earliest_normal_clock_out_at: null,
    latest_normal_clock_out_at: null,
    attendance_policy_source: "schedule",
    attendance_policy_snapshot: {},
    provisional_auto_closed_at: null,
    clock_out_confirmation_required: false,
    actual_clock_out_reconciled_at: null,
    source_label: "Attendance",
    ...overrides,
  };
}

describe("Attendance exception actionability", () => {
  it("treats a legacy manual early clock-in as timing-only", () => {
    expect(
      isActionableAttendanceException(
        exception({
          exception_type: "manual",
          metadata: { internalExceptionType: "early_clock_in" },
        })
      )
    ).toBe(false);
  });

  it("keeps only evidence linked to the selected business day", () => {
    const rows = filterAttendanceExceptionsForBusinessDay({
      exceptions: [
        exception({ id: "today-checkin", checkin_id: "checkin-today" }),
        exception({ id: "old-checkin", checkin_id: "checkin-old" }),
        exception({ id: "today-scan", scan_event_id: "scan-today" }),
        exception({ id: "old-scan", scan_event_id: "scan-old" }),
        exception({ id: "today-unlinked", detected_at: "2026-07-22T03:00:00.000Z" }),
        exception({ id: "old-unlinked", detected_at: "2026-07-20T03:00:00.000Z" }),
      ],
      records: [record()],
      scanEventIds: ["scan-today"],
      branchId: "branch-1",
      businessDate: "2026-07-22",
      businessDayStart: "2026-07-21T22:00:00.000Z",
      businessDayEnd: "2026-07-22T22:00:00.000Z",
    });

    expect(rows.map((row) => row.id)).toEqual(["today-checkin", "today-scan", "today-unlinked"]);
  });
});
