import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_REPORT_NAMES,
  buildAttendanceReport,
} from "@/lib/attendance/reports";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

const data = {
  branchId: "branch-1",
  branchName: "Makati",
  businessDate: "2026-07-14",
  records: [{
    id: "checkin-1", branch_id: "branch-1", staff_id: "staff-1", staff_name: "Maria Santos",
    staff_nickname: null, staff_type: "therapist", system_role: "staff", shift_date: "2026-07-14",
    shift_type: "single", scheduled_start_at: "2026-07-14T01:00:00.000Z", scheduled_end_at: "2026-07-14T10:00:00.000Z",
    checked_in_at: "2026-07-14T01:05:00.000Z", checked_out_at: "2026-07-14T10:05:00.000Z",
    status: "checked_out", attendance_status: "present", exception_state: "open", worked_minutes: 540,
    late_minutes: 5, early_leave_minutes: 0, overtime_minutes: 5, clock_in_method: "qr", clock_out_method: "qr", source_label: "Attendance",
  }],
  exceptions: [{
    id: "exception-1", branch_id: "branch-1", staff_id: "staff-1", checkin_id: "checkin-1", scan_event_id: "scan-1",
    staff_name: "Maria Santos", exception_type: "missing_schedule", severity: "warning", status: "open",
    message: "Review schedule", metadata: {}, detected_at: "2026-07-14T01:05:00.000Z", resolved_at: null,
  }],
  corrections: [],
  dailyStaffStates: [],
  staffOptions: [{ id: "staff-1", full_name: "Maria Santos", staff_type: "therapist" }],
} as unknown as AttendanceWorkspaceData;

const filters = { startDate: "2026-07-14", endDate: "2026-07-14", staffType: "all", staffId: "all" };

describe("Attendance operational reports", () => {
  it("exposes exactly the three required report names", () => {
    expect(ATTENDANCE_REPORT_NAMES).toEqual([
      "Daily Attendance",
      "Exceptions and Corrections",
      "Payroll Export",
    ]);
  });

  it("builds Daily Attendance from row-level operational evidence", () => {
    const report = buildAttendanceReport({ name: "Daily Attendance", data, filters });
    expect(report.rows[0]).toMatchObject({ staff: "Maria Santos", workedMinutes: 540, status: "needs_review" });
    expect(report.columns.map((column) => column.key)).toContain("exceptionLabels");
  });

  it("builds an Exceptions and Corrections audit row", () => {
    const report = buildAttendanceReport({ name: "Exceptions and Corrections", data, filters });
    expect(report.rows[0]).toMatchObject({ exception: "Missing Schedule", status: "open", auditReference: "exception-1" });
  });

  it("excludes unresolved ambiguous minutes from approved payroll", () => {
    const report = buildAttendanceReport({ name: "Payroll Export", data, filters });
    expect(report.rows[0]).toMatchObject({ workedMinutes: 540, approvedPayableMinutes: 0, unresolvedAmbiguity: "Yes" });
  });
});

