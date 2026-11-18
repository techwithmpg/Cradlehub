import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { filterAttendanceExceptionsForBusinessDay } from "@/lib/attendance/attendance-exception-actionability";
import { resolveAttendanceDayStaffStates } from "@/lib/attendance/day-model";
import { buildAttendanceStaffDiagnostics } from "@/lib/attendance/staff-diagnostics";
import {
  findExceptionRecord,
  resolveExceptionBusinessDate,
  resolveExceptionTargetCheckinId,
} from "@/lib/attendance/crm-attendance-presenter";
import { buildAttendanceReviewItems, applyCanonicalReviewToStaff } from "@/lib/attendance/crm-review";
import type {
  AttendanceException,
  AttendanceRecord,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";

const harness = vi.hoisted(() => ({
  openCheckins: [] as Array<Record<string, unknown>>,
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  commitInputs: [] as Array<Record<string, unknown>>,
}));

const branchId = "branch-main";
const staffId = "staff-therapist-1";
const deviceId = "device-phone-1";
const pointId = "qr-point-1";

const settings = {
  branch_id: branchId,
  duplicate_scan_window_seconds: 90,
  clock_in_early_grace_minutes: 15,
  clock_in_late_grace_minutes: 5,
  clock_out_early_grace_minutes: 5,
  clock_out_late_grace_minutes: 15,
  overnight_shift_cutoff_time: "06:00:00",
  active_service_blocks_clock_out: true,
  require_registered_device_for_attendance: false,
  timezone: "Asia/Manila",
  attendance_day_boundary: "06:00:00",
  early_clock_in_allowed_minutes: 60,
  late_grace_minutes: 10,
  clock_in_window_before_shift_minutes: 60,
  clock_in_window_after_shift_start_minutes: 120,
  clock_out_window_before_shift_end_minutes: 120,
  clock_out_window_after_shift_end_minutes: 120,
  early_leave_threshold_minutes: 5,
  overtime_threshold_minutes: 15,
  branch_operating_close_time: "22:30:00",
  crm_closing_policy_enabled: true,
  crm_closing_buffer_minutes: 30,
  crm_manager_escalation_delay_minutes: 30,
  crm_hard_cutoff_delay_minutes: 60,
  closing_intervention_last_run_at: null,
  closing_intervention_last_error: null,
  duplicate_scan_debounce_minutes: 3,
  first_scan_closing_behavior: "flag_for_recovery",
  missing_schedule_behavior: "flag_for_recovery",
  off_day_scan_behavior: "flag_for_recovery",
  ambiguous_scan_behavior: "flag_for_recovery",
  launch_recovery_enabled: false,
  launch_recovery_start_date: null,
  launch_recovery_end_date: null,
  launch_recovery_closing_start_time: "20:30:00",
  launch_recovery_closing_end_time: "23:59:00",
  launch_recovery_reason: null,
  test_mode_enabled: false,
  test_mode_reason: null,
  test_mode_enabled_at: null,
  test_mode_enabled_by: null,
  test_mode_disabled_at: null,
  test_mode_disabled_by: null,
  updated_by: null,
};

function makeChain(table: string) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => {
      if (table === "qr_scan_events") {
        return {
          data: {
            id: "source-scan-event",
            branch_id: branchId,
            qr_point_id: pointId,
            staff_id: staffId,
            device_id: deviceId,
            user_agent: "vitest",
            ip_address: "127.0.0.1",
            reason_code: "wrong_branch",
          },
          error: null,
        };
      }
      if (table === "qr_points") {
        return {
          data: {
            id: pointId,
            branch_id: branchId,
            public_code: "TEST-ATTENDANCE-QR",
            point_type: "attendance",
            resource_id: null,
            is_active: true,
            requires_registered_device: false,
            scan_behavior: "standard",
            label: "Main Entrance QR",
            branch_resources: null,
            branches: { name: "Main Branch" },
          },
          error: null,
        };
      }
      if (table === "staff_devices") {
        return {
          data: {
            id: deviceId,
            staff_id: staffId,
            branch_id: branchId,
            status: "active",
            security_state: "normal",
            trusted_after: "2026-01-01T00:00:00Z",
            revoked_at: null,
            staff: {
              id: staffId,
              branch_id: branchId,
              full_name: "Maria Santos",
              nickname: "Maria",
              staff_type: "therapist",
              system_role: "staff",
              is_cross_branch: false,
              is_active: true,
              archived_at: null,
              merged_into_staff_id: null,
              metadata: {},
              branches: { name: "Main Branch" },
            },
          },
          error: null,
        };
      }
      if (table === "attendance_closing_interventions") return { data: [], error: null };
      return { data: null, error: null };
    }),
    then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
      const payload =
        table === "staff_shift_checkins"
          ? { data: harness.openCheckins, error: null }
          : table === "attendance_closing_interventions"
            ? { data: [], error: null }
            : { data: [], error: null };
      return Promise.resolve(payload).then(onFulfilled, onRejected);
    },
  };
  return chain;
}

const adminClient = {
  from: vi.fn((table: string) => makeChain(table)),
  rpc: vi.fn((fn: string, args: Record<string, unknown>) => {
    harness.rpcCalls.push({ fn, args });
    if (fn === "recalculate_attendance_clock_out_policy") {
      return {
        maybeSingle: async () => ({
          data: {
            expected_clock_out_at: "2026-11-17T12:00:00.000Z",
            earliest_normal_clock_out_at: "2026-11-17T11:55:00.000Z",
            latest_normal_clock_out_at: "2026-11-17T12:10:00.000Z",
            attendance_policy_source: "schedule",
            attendance_policy_snapshot: {},
          },
          error: null,
        }),
        then: (onFulfilled: (v: unknown) => unknown) =>
          Promise.resolve({
            data: {
              expected_clock_out_at: "2026-11-17T12:00:00.000Z",
              earliest_normal_clock_out_at: "2026-11-17T11:55:00.000Z",
              latest_normal_clock_out_at: "2026-11-17T12:10:00.000Z",
              attendance_policy_source: "schedule",
              attendance_policy_snapshot: {},
            },
            error: null,
          }).then(onFulfilled),
      };
    }
    if (fn === "recover_stale_attendance_and_clock_in") {
      const resultObj = {
        success: true,
        code: "committed",
        stale_checkin_id: args.p_stale_checkin_id,
        current_checkin_id: "checkin-today",
        scan_event_id: "scan-today",
        operation_result: args.p_public_result,
        message: "ok",
      };
      return {
        maybeSingle: async () => ({ data: resultObj, error: null }),
      };
    }
    if (fn === "attendance_v2_enabled") {
      return Promise.resolve({ data: true, error: null });
    }
    return {
      maybeSingle: async () => ({ data: null, error: null }),
    };
  }),
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => adminClient }));
vi.mock("@/lib/attendance/queries", () => ({ getAttendanceSettings: vi.fn(async () => settings) }));
vi.mock("@/lib/attendance/v2-server", () => ({ attendanceV2Enabled: vi.fn(async () => true) }));
vi.mock("@/lib/notifications/workflow-signals", () => ({
  markNotificationResolved: vi.fn(async () => undefined),
  resolveWorkflowTask: vi.fn(async () => undefined),
}));
vi.mock("@/lib/queries/resolved-staff-schedules", () => ({
  getResolvedStaffSchedulesForDate: vi.fn(
    async () =>
      new Map([
        [
          staffId,
          {
            source: "individual",
            status: "resolved",
            state: "VALID_SCHEDULE",
            isWorking: true,
            isDayOff: false,
            windows: [
              {
                id: "weekly-win-1",
                windowOrder: 1,
                shiftType: "single",
                startTime: "14:00:00",
                endTime: "22:00:00",
              },
            ],
          },
        ],
      ])
  ),
}));

import { resumeAttendanceScanFromStoredSource } from "@/lib/attendance/scan-engine";

describe("Stale exception attribution and active-session isolation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    harness.rpcCalls = [];
    harness.commitInputs = [];
    harness.openCheckins = [
      {
        id: "checkin-yesterday",
        staff_id: staffId,
        branch_id: branchId,
        shift_date: "2026-11-17",
        attendance_business_date: "2026-11-17",
        shift_type: "single",
        checked_in_at: "2026-11-17T06:00:00.000Z",
        scheduled_start_at: "2026-11-17T06:00:00.000Z",
        scheduled_end_at: "2026-11-17T14:00:00.000Z",
        provisional_auto_closed_at: null,
        attendance_expected_end_at: "2026-11-17T14:00:00.000Z",
        latest_normal_clock_out_at: "2026-11-17T14:10:00.000Z",
        attendance_policy_snapshot: {},
        is_test: false,
      },
    ];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens today's clean 100-min-early shift with exception_state='none' and attributes stale metadata to yesterday", async () => {
    // 12:20 Manila = 04:20Z -> 100 minutes before 14:00 Manila (06:00Z)
    vi.setSystemTime(new Date("2026-11-18T04:20:00.000Z"));
    const result = await resumeAttendanceScanFromStoredSource({
      sourceScanEventId: "source-scan-event",
      continuationRequestId: "req-stale-1",
      expectedStaffId: staffId,
      expectedBranchId: branchId,
      commit: async (_admin, input) => {
        harness.commitInputs.push(input as unknown as Record<string, unknown>);
        return { result: input.result, scanEventId: "scan-1" };
      },
      reconcileProvisional: async () => {
        throw new Error("should not reconcile");
      },
    });

    expect(result.attendance?.action).toBe("clock_in");
    expect(result.attendance?.creditedStartAt).toBe("2026-11-18T06:00:00.000Z");

    const recoverCall = harness.rpcCalls.find(
      (call) => call.fn === "recover_stale_attendance_and_clock_in"
    );
    expect(recoverCall).toBeTruthy();
    const currentCheckinPayload = recoverCall!.args.p_current_checkin as Record<string, unknown>;
    expect(currentCheckinPayload.exception_state).toBe("none");
    expect(currentCheckinPayload.attendance_business_date).toBe("2026-11-18");

    const metadataPayload = recoverCall!.args.p_metadata as Record<string, unknown>;
    expect(metadataPayload.staleCheckinId).toBe("checkin-yesterday");
    expect(metadataPayload.staleShiftDate).toBe("2026-11-17");
    expect(metadataPayload.staleBusinessDate).toBe("2026-11-17");
  });

  it("isolates today's active worker and record lookup even when legacy stale exceptions exist", () => {
    const todayRecord: AttendanceRecord = {
      id: "checkin-today",
      branch_id: branchId,
      staff_id: staffId,
      staff_name: "Maria Santos",
      staff_nickname: null,
      staff_type: "therapist",
      system_role: "staff",
      shift_date: "2026-11-18",
      shift_type: "single",
      scheduled_start_at: "2026-11-18T06:00:00.000Z",
      scheduled_end_at: "2026-11-18T14:00:00.000Z",
      checked_in_at: "2026-11-18T06:00:00.000Z",
      checked_out_at: null,
      status: "checked_in",
      attendance_status: "present",
      exception_state: "none",
      worked_minutes: 0,
      late_minutes: 0,
      early_leave_minutes: 0,
      overtime_minutes: 0,
      clock_in_method: "qr",
      clock_out_method: null,
      attendance_expected_end_at: "2026-11-18T14:00:00.000Z",
      earliest_normal_clock_out_at: null,
      latest_normal_clock_out_at: null,
      attendance_policy_source: "schedule",
      attendance_policy_snapshot: {},
      provisional_auto_closed_at: null,
      clock_out_confirmation_required: false,
      actual_clock_out_reconciled_at: null,
      source_label: "Main QR",
    };

    const legacyCorruptedStaleException: AttendanceException = {
      id: "exc-stale-1",
      branch_id: branchId,
      staff_id: staffId,
      // Simulate historical bug where checkin_id was linked to today instead of yesterday
      checkin_id: "checkin-today",
      scan_event_id: "scan-today",
      staff_name: "Maria Santos",
      exception_type: "missed_checkout",
      severity: "warning",
      status: "open",
      message: "Maria Santos's earlier open Attendance record was recovered before today's clock-in.",
      metadata: {
        internalExceptionType: "stale_open_checkin",
        staleCheckinId: "checkin-yesterday",
        staleShiftDate: "2026-11-17",
        staleBusinessDate: "2026-11-17",
      },
      detected_at: "2026-11-18T06:00:00.000Z",
      resolved_at: null,
    };

    const dailyExceptions = filterAttendanceExceptionsForBusinessDay({
      exceptions: [legacyCorruptedStaleException],
      records: [todayRecord],
      scanEventIds: ["scan-today"],
      branchId,
      businessDate: "2026-11-18",
      businessDayStart: "2026-11-17T22:00:00.000Z",
      businessDayEnd: "2026-11-18T22:00:00.000Z",
    });
    expect(dailyExceptions).toEqual([]);

    const dayStates = resolveAttendanceDayStaffStates({
      branchId,
      businessDate: "2026-11-18",
      timezone: "Asia/Manila",
      now: new Date("2026-11-18T07:00:00.000Z"),
      settings: {
        clock_in_early_grace_minutes: 15,
        clock_in_late_grace_minutes: 10,
        late_grace_minutes: 10,
      },
      staff: [{ id: staffId, fullName: "Maria Santos", staffType: "therapist" }],
      schedules: new Map([
        [
          staffId,
          {
            source: "individual",
            status: "resolved",
            state: "VALID_SCHEDULE",
            isWorking: true,
            isDayOff: false,
            windows: [{ shiftType: "single", startTime: "14:00:00", endTime: "22:00:00" }],
          },
        ],
      ]),
      records: [todayRecord],
      sessions: [],
      exceptions: [legacyCorruptedStaleException],
    });

    expect(dayStates[0]).toMatchObject({
      operationalStatus: "clocked_in",
      exceptionState: "clear",
      currentExceptionIds: [],
      actionRequired: false,
    });

    const workspace = {
      branchId,
      branchName: "Main Branch",
      businessDate: "2026-11-18",
      timezone: "Asia/Manila",
      serverNowMs: Date.parse("2026-11-18T07:00:00.000Z"),
      settings,
      records: [todayRecord],
      testRecords: [],
      exceptions: [legacyCorruptedStaleException],
      scanEvents: [],
      sessions: [],
      corrections: [],
      dailyStaffStates: dayStates,
      devices: [],
      deviceRegistry: { entries: [] },
    } as unknown as AttendanceWorkspaceData;

    const reviewItems = buildAttendanceReviewItems(workspace.exceptions);
    expect(reviewItems).toHaveLength(1);
    const diagnostics = applyCanonicalReviewToStaff(
      buildAttendanceStaffDiagnostics(workspace),
      reviewItems
    );

    // Today's worker remains cleanly "working", not flagged broken by yesterday's exception
    expect(diagnostics[0]).toMatchObject({
      working: true,
      needsHelp: false,
      status: "working",
      openException: null,
    });

    // Review item points to yesterday's checkin ID and original business date, NEVER today's live shift
    expect(resolveExceptionTargetCheckinId(legacyCorruptedStaleException)).toBe("checkin-yesterday");
    expect(findExceptionRecord(legacyCorruptedStaleException, [todayRecord])).toBeNull();
    expect(
      resolveExceptionBusinessDate(legacyCorruptedStaleException, null, "Asia/Manila")
    ).toBe("2026-11-17");
  });

  it("keeps recovery SQL attributing attendance_exceptions to p_stale_checkin_id and current exception_state default none", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20261118163000_attendance_lifecycle_correction.sql"),
      "utf8"
    );
    expect(sql).toContain("coalesce(nullif(p_current_checkin->>'exception_state', ''), 'none')");
    expect(sql).toContain("p_exception => null::jsonb");
    expect(sql).toContain("array[p_stale_checkin_id]");
  });
});
