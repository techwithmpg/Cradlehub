import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const harness = vi.hoisted(() => ({
  provisionalRows: [] as Array<Record<string, unknown>>,
  checkinQueryCount: 0,
  commitInputs: [] as Array<Record<string, unknown>>,
  mutationCalls: [] as Array<{ table: string; operation: string; values?: unknown }>,
  reconcileCalls: 0,
}));

const settings = {
  branch_id: "branch-a01",
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
  early_clock_in_allowed_minutes: 30,
  late_grace_minutes: 10,
  clock_in_window_before_shift_minutes: 30,
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

const mondaySchedule = {
  source: "individual",
  status: "resolved",
  state: "VALID_SCHEDULE",
  isWorking: true,
  isDayOff: false,
  windows: [{
    id: "monday-window",
    windowOrder: 1,
    shiftType: "single",
    startTime: "10:00:00",
    endTime: "18:00:00",
  }],
};

function queryChain(table: string, result: unknown) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    is: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    update: vi.fn((values: unknown) => {
      harness.mutationCalls.push({ table, operation: "update", values });
      return chain;
    }),
    insert: vi.fn((values: unknown) => {
      harness.mutationCalls.push({ table, operation: "insert", values });
      return chain;
    }),
    delete: vi.fn(() => {
      harness.mutationCalls.push({ table, operation: "delete" });
      return chain;
    }),
  };
  return chain;
}

const adminClient = {
  from: vi.fn((table: string) => {
    if (table === "qr_scan_events") {
      return queryChain(table, { data: {
        id: "source-event",
        branch_id: "branch-a01",
        qr_point_id: "qr-a01",
        staff_id: "staff-a01",
        device_id: "device-a01",
        user_agent: "Vitest",
        ip_address: null,
        reason_code: "wrong_branch",
      }, error: null });
    }
    if (table === "qr_points") {
      return queryChain(table, { data: {
        id: "qr-a01",
        branch_id: "branch-a01",
        public_code: "att-a01",
        point_type: "attendance",
        resource_id: null,
        label: "Attendance",
        is_active: true,
        requires_registered_device: true,
        scan_behavior: "attendance",
        branches: { name: "A-01 Branch" },
      }, error: null });
    }
    if (table === "staff_devices") {
      return queryChain(table, { data: {
        id: "device-a01",
        staff_id: "staff-a01",
        branch_id: "branch-a01",
        status: "active",
        security_state: "clear",
        staff: {
          branch_id: "branch-a01",
          full_name: "A-01 Staff",
          nickname: "A01",
          staff_type: "therapist",
          system_role: "staff",
          is_cross_branch: false,
          is_active: true,
          archived_at: null,
          merged_into_staff_id: null,
          metadata: null,
          branches: { name: "A-01 Branch" },
        },
      }, error: null });
    }
    if (table === "staff_shift_checkins") {
      harness.checkinQueryCount += 1;
      if (harness.checkinQueryCount === 1) return queryChain(table, { data: [], error: null });
      if (harness.checkinQueryCount === 2) {
        return queryChain(table, { data: harness.provisionalRows, error: null });
      }
      return queryChain(table, { data: null, error: null });
    }
    return queryChain(table, { data: null, error: null });
  }),
  rpc: vi.fn((name: string) => {
    if (name === "resolve_effective_attendance_branch") {
      return queryChain("rpc:resolve_effective_attendance_branch", {
        data: { allowed: true, effective_branch_id: "branch-a01", source: "home" },
        error: null,
      });
    }
    return queryChain(`rpc:${name}`, { data: null, error: null });
  }),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminClient,
}));
vi.mock("@/lib/attendance/queries", () => ({
  getAttendanceSettings: vi.fn(async () => settings),
}));
vi.mock("@/lib/queries/resolved-staff-schedules", () => ({
  getResolvedStaffSchedulesForDate: vi.fn(async () => new Map([["staff-a01", mondaySchedule]])),
}));

import {
  resumeAttendanceScanFromStoredSource,
  type AttendanceScanCommitInput,
} from "@/lib/attendance/scan-engine";
import { buildAttendanceShiftInstance, getAttendanceBranchNow } from "@/lib/attendance/shift-instance";

const scanEngineSource = readFileSync(resolve("src/lib/attendance/scan-engine.ts"), "utf8");

function provisionalRow(id: string) {
  return {
    id,
    staff_id: "staff-a01",
    branch_id: "branch-a01",
    shift_date: "2026-09-13",
    shift_type: "single",
    shift_instance_key: `${id}|old-shift`,
    checked_in_at: "2026-09-13T02:00:00.000Z",
    checked_out_at: "2026-09-13T10:00:00.000Z",
    status: "checked_out",
    attendance_business_date: "2026-09-13",
    branch_timezone: "Asia/Manila",
    provisional_auto_closed_at: "2026-09-13T14:00:00.000Z",
    clock_out_confirmation_required: true,
    is_test: false,
  };
}

async function executeScan(rows: Array<Record<string, unknown>>) {
  harness.provisionalRows = rows;
  const commit = vi.fn(async (_admin: unknown, input: AttendanceScanCommitInput) => {
    harness.commitInputs.push(input as unknown as Record<string, unknown>);
    return {
      result: input.result,
      scanEventId: "current-scan-event",
      checkinId: input.checkinInsert ? "current-checkin" : undefined,
    };
  });
  const reconcile = vi.fn(async () => {
    harness.reconcileCalls += 1;
    throw new Error("prior provisional row must not be reconciled");
  });

  return resumeAttendanceScanFromStoredSource({
    sourceScanEventId: "source-event",
    continuationRequestId: `a01-${rows.length}`,
    expectedStaffId: "staff-a01",
    expectedBranchId: "branch-a01",
    commit,
    reconcileProvisional: reconcile,
  });
}

describe("A-01 behavioral attendance regression", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T02:00:00.000Z"));
    harness.provisionalRows = [];
    harness.checkinQueryCount = 0;
    harness.commitInputs = [];
    harness.mutationCalls = [];
    harness.reconcileCalls = 0;
    adminClient.from.mockClear();
    adminClient.rpc.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("executes a valid current-day clock-in while one prior-day provisional row stays untouched", async () => {
    const prior = provisionalRow("prior-provisional");
    const before = structuredClone(prior);
    const result = await executeScan([prior]);

    expect(result.reasonCode).not.toBe("provisional_clock_out_outside_business_day");
    expect(result.attendance?.action).toBe("clock_in");
    expect(harness.reconcileCalls).toBe(0);
    expect(harness.provisionalRows).toEqual([before]);
    expect(harness.mutationCalls).toEqual([]);

    const commit = harness.commitInputs[0] as {
      event: { action: string };
      checkinInsert: Record<string, unknown>;
    };
    expect(commit.event.action).toBe("clock_in");
    expect(commit.checkinInsert).toMatchObject({
      attendance_business_date: "2026-09-14",
      shift_date: "2026-09-14",
      status: "checked_in",
    });
    expect(commit.checkinInsert.shift_instance_key).toContain(
      "staff-a01|branch-a01|2026-09-14|single"
    );
    expect(commit.checkinInsert.shift_instance_key).not.toContain("prior-provisional");
  });

  it("keeps two prior-day provisional rows review-only and unmutated", async () => {
    const rows = [provisionalRow("prior-one"), provisionalRow("prior-two")];
    const before = structuredClone(rows);
    const result = await executeScan(rows);

    expect(result.reasonCode).toBe("conflicting_provisional_clock_outs");
    expect(result.attendance).toBeUndefined();
    expect(harness.commitInputs).toHaveLength(1);
    const conflictCommit = harness.commitInputs[0] as {
      event: { action: string };
      checkinInsert?: unknown;
    };
    expect(conflictCommit.event.action).toBe("scan_captured");
    expect(conflictCommit.checkinInsert).toBeUndefined();
    expect(harness.provisionalRows).toEqual(before);
    expect(harness.mutationCalls).toEqual([]);
    expect(harness.reconcileCalls).toBe(0);
  });

  it("retains source-level guards for completed shifts and stale-open recovery", () => {
    expect(scanEngineSource).toContain("reasonCode: \"already_checked_out\"");
    expect(scanEngineSource).toContain("resolveStaleAttendanceRecoveryClockOutAt");
    expect(scanEngineSource).toContain("outsideBusinessDateProvisionalClockOuts.length > 1");
  });

  it("resolves the current shift key and business date with the established boundary helper", () => {
    const shift = buildAttendanceShiftInstance({
      staffId: "staff-a01",
      branchId: "branch-a01",
      schedule: {
        ...mondaySchedule,
        shiftDate: "2026-09-14",
        shiftType: "single" as const,
        source: "individual" as const,
        isUnscheduled: false,
        scheduledStartAt: "2026-09-14T02:00:00.000Z",
        scheduledEndAt: "2026-09-14T10:00:00.000Z",
        windows: [{
          ...mondaySchedule.windows[0]!,
          shiftType: "single" as const,
        }],
        selectedWindow: {
          ...mondaySchedule.windows[0]!,
          shiftType: "single" as const,
        },
      },
      businessDate: "2026-09-14",
      branchTimezone: "Asia/Manila",
    },);
    expect(shift.attendanceBusinessDate).toBe("2026-09-14");
    expect(getAttendanceBranchNow(settings, new Date("2026-09-13T21:59:00.000Z")).businessDate).toBe("2026-09-13");
    expect(getAttendanceBranchNow(settings, new Date("2026-09-13T22:01:00.000Z")).businessDate).toBe("2026-09-14");
  });
});
