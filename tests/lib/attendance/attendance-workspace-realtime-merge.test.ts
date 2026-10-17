import { describe, expect, it } from "vitest";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";
import {
  mergeAttendanceWorkspaceCheckin,
  type AttendanceCheckinRealtimeRow,
} from "@/lib/attendance/attendance-workspace-realtime-merge";

function workspace(): AttendanceWorkspaceData {
  return {
    branchId: "branch-1",
    branchName: "Main",
    businessDate: "2026-10-17",
    serverNowMs: Date.parse("2026-10-17T09:00:00+08:00"),
    records: [],
    staffOptions: [
      {
        id: "staff-1",
        full_name: "Therapist One",
        staff_type: "therapist",
      },
    ],
    dailyStaffStates: [
      {
        staffId: "staff-1",
        staffName: "Therapist One",
        staffType: "therapist",
        currentShiftWindow: {
          startAt: "2026-10-17T08:00:00+08:00",
          endAt: "2026-10-17T17:00:00+08:00",
        },
        activeServiceSession: null,
        currentAttendanceState: "not_checked_in",
        operationalStatus: "not_clocked_in",
        attendanceRecordId: null,
        clockInAt: null,
        clockOutAt: null,
        workedMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        availabilityState: "not_available",
        exceptionState: "clear",
        displayLabel: "Not Checked In",
        actionRequired: false,
      },
    ],
    summary: {
      checkedInNow: 0,
      recordsToday: 0,
    },
  } as unknown as AttendanceWorkspaceData;
}

function checkin(overrides: Partial<AttendanceCheckinRealtimeRow> = {}) {
  return {
    id: "checkin-1",
    branch_id: "branch-1",
    staff_id: "staff-1",
    shift_date: "2026-10-17",
    checked_in_at: "2026-10-17T08:05:00+08:00",
    checked_out_at: null,
    status: "checked_in",
    is_test: false,
    late_minutes: 5,
    early_leave_minutes: 0,
    overtime_minutes: 0,
    worked_minutes: 55,
    attendance_policy_source: "schedule",
    attendance_policy_snapshot: {},
    ...overrides,
  } as unknown as AttendanceCheckinRealtimeRow;
}

describe("PERF-4 Attendance realtime row merge", () => {
  it("patches the affected record and staff row without replacing unrelated workspace data", () => {
    const source = workspace();
    const merged = mergeAttendanceWorkspaceCheckin(
      source,
      checkin(),
      Date.parse("2026-10-17T09:00:00+08:00")
    );

    expect(merged).not.toBe(source);
    expect(merged.records).toHaveLength(1);
    expect(merged.records[0]).toMatchObject({
      id: "checkin-1",
      staff_id: "staff-1",
      staff_name: "Therapist One",
      status: "checked_in",
      checked_in_at: "2026-10-17T08:05:00+08:00",
    });
    expect(merged.dailyStaffStates[0]).toMatchObject({
      attendanceRecordId: "checkin-1",
      currentAttendanceState: "available",
      operationalStatus: "clocked_in",
      availabilityState: "available",
    });
    expect(merged.summary.checkedInNow).toBe(1);
    expect(merged.summary.recordsToday).toBe(1);
  });

  it("ignores a row outside the active branch/business date", () => {
    const source = workspace();

    expect(
      mergeAttendanceWorkspaceCheckin(source, checkin({ branch_id: "branch-2" }))
    ).toBe(source);
    expect(
      mergeAttendanceWorkspaceCheckin(source, checkin({ shift_date: "2026-10-18" }))
    ).toBe(source);
  });

  it("does not patch incomplete or test rows", () => {
    const source = workspace();
    expect(
      mergeAttendanceWorkspaceCheckin(source, checkin({ is_test: true }))
    ).toBe(source);
    expect(
      mergeAttendanceWorkspaceCheckin(
        source,
        checkin({ checked_in_at: null }) as AttendanceCheckinRealtimeRow
      )
    ).toBe(source);
  });
});
