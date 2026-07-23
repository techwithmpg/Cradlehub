import { describe, expect, it } from "vitest";
import type { AttendanceDayStaffState } from "@/lib/attendance/day-model";
import { buildAttendanceStaffDiagnostics } from "@/lib/attendance/staff-diagnostics";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

function staff(overrides: Partial<AttendanceDayStaffState> = {}): AttendanceDayStaffState {
  return {
    staffId: "staff-1",
    staffName: "Maria Santos",
    staffType: "therapist",
    branchId: "branch-1",
    businessDate: "2026-07-22",
    timezone: "Asia/Manila",
    scheduleSource: "individual",
    scheduleState: "expected_now",
    shiftWindows: [],
    currentShiftWindow: null,
    nextShiftWindow: null,
    scheduledStart: null,
    scheduledEnd: null,
    attendanceRecordId: null,
    clockInAt: null,
    clockOutAt: null,
    currentAttendanceState: "not_arrived",
    operationalStatus: "expected_later",
    workedMinutes: 0,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 0,
    activeBookingId: null,
    activeServiceSession: null,
    availabilityState: "not_available",
    exceptionState: "clear",
    currentExceptionIds: [],
    issueCodes: [],
    displayLabel: "Not Arrived",
    actionRequired: false,
    ...overrides,
  };
}

function workspace(states: AttendanceDayStaffState[]): AttendanceWorkspaceData {
  return {
    dailyStaffStates: states,
    scanEvents: [],
    exceptions: [],
    deviceRegistry: { entries: states.map((row) => ({ staffId: row.staffId, status: "active" })) },
  } as unknown as AttendanceWorkspaceData;
}

describe("Attendance staff diagnostics", () => {
  it("deduplicates the Today roster by staff ID", () => {
    expect(
      buildAttendanceStaffDiagnostics(workspace([staff(), staff({ staffName: "Duplicate" })]))
    ).toHaveLength(1);
  });

  it("classifies working, not-scanned-in, checked-out, and needs-help states", () => {
    const data = workspace([
      staff({
        staffId: "working",
        operationalStatus: "clocked_in",
        currentAttendanceState: "clocked_in",
        clockInAt: "2026-07-22T01:00:00Z",
      }),
      staff({ staffId: "missing" }),
      staff({
        staffId: "out",
        operationalStatus: "clocked_out",
        currentAttendanceState: "clocked_out",
        clockOutAt: "2026-07-22T09:00:00Z",
      }),
      staff({
        staffId: "help",
        operationalStatus: "needs_review",
        currentAttendanceState: "needs_review",
        issueCodes: ["wrong_branch"],
      }),
    ]);
    const rows = buildAttendanceStaffDiagnostics(data);
    expect(rows.find((row) => row.staff.staffId === "working")?.working).toBe(true);
    expect(rows.find((row) => row.staff.staffId === "missing")?.notScannedIn).toBe(true);
    expect(rows.find((row) => row.staff.staffId === "out")?.checkedOut).toBe(true);
    expect(rows.find((row) => row.staff.staffId === "help")?.statusLabel).toBe("Wrong branch");
  });
});
