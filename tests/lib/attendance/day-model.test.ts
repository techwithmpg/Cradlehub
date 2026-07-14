import { describe, expect, it } from "vitest";
import { resolveAttendanceDayStaffStates } from "@/lib/attendance/day-model";
import type { AttendanceRecord, AttendanceSession } from "@/lib/attendance/types";
import type { ResolvedStaffSchedule } from "@/lib/schedule/resolve-staff-schedule";

const staff = [{ id: "staff-1", fullName: "Maria Santos", staffType: "therapist" }];
const settings = {
  clock_in_early_grace_minutes: 30,
  clock_in_late_grace_minutes: 10,
  late_grace_minutes: 10,
};

function schedule(
  windows: ResolvedStaffSchedule["windows"],
  source: ResolvedStaffSchedule["source"] = "individual"
): ResolvedStaffSchedule {
  return {
    source,
    status: "resolved",
    state: windows.length > 1 ? "VALID_SPLIT_SHIFT" : "VALID_SCHEDULE",
    isWorking: true,
    isDayOff: false,
    windows,
  };
}

function record(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: "record-1", branch_id: "branch-1", staff_id: "staff-1", staff_name: "Maria Santos",
    staff_nickname: null, staff_type: "therapist", system_role: "staff", shift_date: "2026-07-14",
    shift_type: "single", scheduled_start_at: "2026-07-14T01:00:00.000Z",
    scheduled_end_at: "2026-07-14T10:00:00.000Z", checked_in_at: "2026-07-14T01:00:00.000Z",
    checked_out_at: null, status: "checked_in", attendance_status: "present", exception_state: null,
    worked_minutes: 0, late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 0,
    clock_in_method: "qr", clock_out_method: null,
    attendance_expected_end_at: "2026-07-14T10:00:00.000Z",
    earliest_normal_clock_out_at: null, latest_normal_clock_out_at: null,
    attendance_policy_source: "schedule", attendance_policy_snapshot: {},
    provisional_auto_closed_at: null, clock_out_confirmation_required: false,
    actual_clock_out_reconciled_at: null, source_label: "Attendance", ...overrides,
  };
}

function resolve(params: {
  now?: string;
  resolved?: ResolvedStaffSchedule;
  records?: AttendanceRecord[];
  sessions?: AttendanceSession[];
  exceptions?: Parameters<typeof resolveAttendanceDayStaffStates>[0]["exceptions"];
  timezone?: string;
  branchId?: string;
}) {
  return resolveAttendanceDayStaffStates({
    branchId: params.branchId ?? "branch-1",
    businessDate: "2026-07-14",
    timezone: params.timezone ?? "Asia/Manila",
    now: new Date(params.now ?? "2026-07-14T01:05:00.000Z"),
    settings,
    staff,
    schedules: new Map([["staff-1", params.resolved ?? schedule([{ shiftType: "single", startTime: "09:00", endTime: "18:00" }])]]),
    records: params.records ?? [],
    sessions: params.sessions ?? [],
    exceptions: params.exceptions ?? [],
  })[0]!;
}

describe("authoritative attendance day model", () => {
  it("classifies an ordinary active shift without a record as not arrived", () => {
    expect(resolve({})).toMatchObject({ currentAttendanceState: "not_arrived", operationalStatus: "expected_later" });
  });

  it("keeps a split-shift gap scheduled later", () => {
    const state = resolve({
      now: "2026-07-14T04:30:00.000Z",
      resolved: schedule([
        { shiftType: "opening", startTime: "08:00", endTime: "12:00", windowOrder: 1 },
        { shiftType: "closing", startTime: "14:00", endTime: "18:00", windowOrder: 2 },
      ]),
    });
    expect(state.scheduleState).toBe("scheduled_later");
    expect(state.nextShiftWindow?.windowOrder).toBe(2);
    expect(state.operationalStatus).toBe("expected_later");
  });

  it("resolves an overnight window against its business date", () => {
    const state = resolve({
      now: "2026-07-14T17:30:00.000Z",
      resolved: schedule([{ shiftType: "closing", startTime: "22:00", endTime: "02:00", endsNextDay: true }]),
    });
    expect(state.scheduleState).toBe("expected_now");
    expect(state.currentShiftWindow?.scheduledEndAt).toBe("2026-07-14T18:00:00.000Z");
  });

  it("uses a date override supplied by the canonical resolver", () => {
    const state = resolve({ resolved: schedule([{ shiftType: "single", startTime: "09:00", endTime: "18:00" }], "override") });
    expect(state.scheduleSource).toBe("override");
  });

  it("classifies an approved day off as not expected", () => {
    const state = resolve({ resolved: { source: "override", status: "day_off", state: "CONFIGURED_DAY_OFF", isWorking: false, isDayOff: true, windows: [] } });
    expect(state).toMatchObject({ scheduleState: "day_off", currentAttendanceState: "not_expected", operationalStatus: "not_expected", displayLabel: "Day Off" });
  });

  it("keeps a missing schedule distinct from a day off", () => {
    const state = resolve({ resolved: { source: "none", status: "missing", state: "NO_SCHEDULE_CONFIGURED", isWorking: false, isDayOff: false, windows: [] } });
    expect(state.scheduleState).toBe("schedule_missing");
  });

  it("routes a conflicting schedule to review", () => {
    const state = resolve({ resolved: { source: "individual", status: "conflict", state: "OVERLAPPING_WINDOWS", isWorking: false, isDayOff: false, windows: [], conflictCode: "overlapping_windows", conflictReason: "Overlap" } });
    expect(state).toMatchObject({ scheduleState: "schedule_conflict", currentAttendanceState: "needs_review", operationalStatus: "needs_review", actionRequired: true });
  });

  it("does not mark a later shift as not arrived", () => {
    const state = resolve({ now: "2026-07-13T23:00:00.000Z" });
    expect(state).toMatchObject({ scheduleState: "scheduled_later", currentAttendanceState: "not_expected" });
  });

  it("marks a missing arrival late only after grace expires", () => {
    expect(resolve({ now: "2026-07-14T01:11:00.000Z" })).toMatchObject({ currentAttendanceState: "late_not_arrived", operationalStatus: "missing" });
  });

  it("reports a checked-in staff member as operationally available", () => {
    expect(resolve({ records: [record()] })).toMatchObject({ currentAttendanceState: "available", operationalStatus: "clocked_in", availabilityState: "available", displayLabel: "Available" });
  });

  it("reports a completed attendance record as clocked out", () => {
    const state = resolve({ records: [record({ status: "checked_out", checked_out_at: "2026-07-14T10:00:00.000Z", worked_minutes: 540 })] });
    expect(state).toMatchObject({ currentAttendanceState: "clocked_out", operationalStatus: "clocked_out", workedMinutes: 540 });
  });

  it("gives active service precedence over generic availability", () => {
    const session: AttendanceSession = {
      id: "booking-1", staff_id: "staff-1", customer_name: "Customer", service_name: "Massage",
      staff_name: "Maria Santos", resource_name: "Room 1", booking_date: "2026-07-14", start_time: "10:00",
      status: "in_progress", booking_progress_status: "session_started", session_started_at: "2026-07-14T02:00:00.000Z",
      session_due_at: null, session_completed_at: null, duration_minutes: 60,
    };
    expect(resolve({ records: [record()], sessions: [session] })).toMatchObject({ currentAttendanceState: "in_service", operationalStatus: "on_service", availabilityState: "in_service", activeBookingId: "booking-1" });
  });

  it("ignores a wrong-branch attendance record", () => {
    expect(resolve({ records: [record({ branch_id: "branch-2" })] }).attendanceRecordId).toBeNull();
  });

  it("uses the supplied branch timezone at a date boundary", () => {
    const state = resolve({
      timezone: "America/New_York",
      now: "2026-07-14T13:30:00.000Z",
      resolved: schedule([{ shiftType: "single", startTime: "09:00", endTime: "17:00" }]),
    });
    expect(state.currentShiftWindow?.scheduledStartAt).toBe("2026-07-14T13:00:00.000Z");
  });

  it("surfaces an unresolved exception without losing its issue code", () => {
    const state = resolve({ exceptions: [{
      id: "exception-1", branch_id: "branch-1", staff_id: "staff-1", checkin_id: null, scan_event_id: null,
      staff_name: "Maria Santos", exception_type: "schedule_mismatch", severity: "warning", status: "open",
      message: "Review", metadata: {}, detected_at: "2026-07-14T01:00:00.000Z", resolved_at: null,
      resolved_by: null, resolved_by_name: null, resolution_note: null,
    }] });
    expect(state).toMatchObject({ currentAttendanceState: "needs_review", operationalStatus: "needs_review", issueCodes: ["schedule_mismatch"], actionRequired: true });
  });

  it("surfaces a first closing scan without attendance as scan captured", () => {
    const state = resolve({ exceptions: [{
      id: "exception-captured", branch_id: "branch-1", staff_id: "staff-1", checkin_id: null, scan_event_id: "scan-1",
      staff_name: "Maria Santos", exception_type: "likely_closing_scan_without_clock_in", severity: "warning", status: "open",
      message: "Captured", metadata: {}, detected_at: "2026-07-14T10:00:00.000Z", resolved_at: null,
      resolved_by: null, resolved_by_name: null, resolution_note: null,
    }] });
    expect(state.operationalStatus).toBe("scan_captured");
  });

  it("labels a non-operational active profile as not scheduled", () => {
    const state = resolve({ resolved: { source: "none", status: "not_operational", state: "STAFF_NOT_OPERATIONAL", isWorking: false, isDayOff: false, windows: [] } });
    expect(state).toMatchObject({ scheduleState: "not_scheduled", displayLabel: "Not Scheduled" });
  });
});
