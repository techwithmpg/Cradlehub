import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const harness = vi.hoisted(() => ({
  openCheckinRows: [] as Array<Record<string, unknown>>,
  commitInputs: [] as Array<Record<string, unknown>>,
  rpcResponse: null as { data: unknown; error: unknown } | null,
}));

const settings = {
  branch_id: "branch-v31",
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
  clock_out_window_before_shift_end_minutes: 60,
  clock_out_window_after_shift_end_minutes: 180,
  early_leave_threshold_minutes: 5,
  overtime_threshold_minutes: 15,
  branch_operating_close_time: "23:00:00",
  crm_closing_policy_enabled: true,
  crm_closing_buffer_minutes: 30,
  crm_manager_escalation_delay_minutes: 30,
  crm_hard_cutoff_delay_minutes: 60,
  closing_intervention_last_run_at: null,
  closing_intervention_last_error: null,
  duplicate_scan_debounce_minutes: 3,
  first_scan_closing_behavior: "flag_for_recovery" as const,
  missing_schedule_behavior: "flag_for_recovery" as const,
  off_day_scan_behavior: "flag_for_recovery" as const,
  ambiguous_scan_behavior: "flag_for_recovery" as const,
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

const shiftSchedule = {
  source: "individual" as const,
  status: "resolved" as const,
  state: "VALID_SCHEDULE" as const,
  isWorking: true,
  isDayOff: false,
  windows: [
    {
      id: "sched-v31",
      windowOrder: 1,
      shiftType: "single" as const,
      startTime: "14:00:00",
      endTime: "23:00:00",
    },
  ],
};

function queryChain(result: unknown) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    update: vi.fn(() => chain),
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
  };
  return chain;
}

let qrEventsCallIndex = 0;

const adminClient = {
  from: vi.fn((table: string) => {
    if (table === "qr_scan_events") {
      qrEventsCallIndex += 1;
      if (qrEventsCallIndex === 1) {
        return queryChain({
          data: {
            id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
            branch_id: "branch-v31",
            qr_point_id: "qr-v31",
            staff_id: "staff-v31",
            device_id: "device-v31",
            user_agent: "Vitest",
            ip_address: null,
            reason_code: "wrong_branch",
          },
          error: null,
        });
      }
      return queryChain({ data: [], error: null });
    }
    if (table === "qr_points") {
      return queryChain({
        data: {
          id: "qr-v31",
          branch_id: "branch-v31",
          public_code: "att-v31",
          point_type: "attendance",
          resource_id: null,
          label: "Attendance",
          is_active: true,
          requires_registered_device: true,
          scan_behavior: "attendance",
          branches: { name: "V3.1 Branch" },
        },
        error: null,
      });
    }
    if (table === "staff_devices") {
      return queryChain({
        data: {
          id: "device-v31",
          staff_id: "staff-v31",
          branch_id: "branch-v31",
          status: "active",
          security_state: "clear",
          staff: {
            branch_id: "branch-v31",
            full_name: "Ana Reyes",
            nickname: "Ana",
            staff_type: "therapist",
            system_role: "staff",
            is_cross_branch: false,
            is_active: true,
            archived_at: null,
            merged_into_staff_id: null,
            metadata: null,
            branches: { name: "V3.1 Branch" },
          },
        },
        error: null,
      });
    }
    if (table === "staff_shift_checkins") {
      return queryChain({ data: harness.openCheckinRows, error: null });
    }
    if (table === "bookings") {
      return queryChain({ data: [], error: null });
    }
    return queryChain({ data: null, error: null });
  }),
  rpc: vi.fn((fnName: string) => {
    if (fnName === "recalculate_attendance_clock_out_policy") {
      return Promise.resolve({
        data: {
          attendance_expected_end_at: "2026-11-05T15:00:00.000Z",
          earliest_normal_clock_out_at: "2026-11-05T14:55:00.000Z",
          latest_normal_clock_out_at: "2026-11-05T15:15:00.000Z",
          attendance_policy_source: "schedule",
          attendance_policy_snapshot: { earlyLeaveThresholdMinutes: 5 },
          has_active_assignment: false,
          has_upcoming_assignment: false,
          next_assignment_at: null,
          portal_clock_out_eligible: false,
          portal_eligibility_reason: "use_branch_qr",
          portal_clock_out_method: null,
        },
        error: null,
      });
    }
    if (fnName === "commit_attendance_scan_transaction") {
      return {
        maybeSingle: vi.fn(async () => harness.rpcResponse),
      };
    }
    return Promise.resolve({ data: null, error: null });
  }),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminClient,
}));
vi.mock("@/lib/attendance/queries", () => ({
  getAttendanceSettings: vi.fn(async () => settings),
}));
vi.mock("@/lib/queries/resolved-staff-schedules", () => ({
  getResolvedStaffSchedulesForDate: vi.fn(async () => new Map([["staff-v31", shiftSchedule]])),
}));
vi.mock("@/lib/notifications/workflow-signals", () => ({
  createWorkflowSignal: vi.fn(async () => undefined),
  markNotificationResolved: vi.fn(async () => undefined),
  resolveWorkflowSignal: vi.fn(async () => undefined),
  resolveWorkflowTask: vi.fn(async () => undefined),
}));

import {
  resumeAttendanceScanFromStoredSource,
  type AttendanceScanCommitInput,
  type AttendanceScanCommitter,
} from "@/lib/attendance/scan-engine";

const v3DraftSql = readFileSync(
  resolve("docs/reviews/attendance/20261107_atomic_completed_shift_transaction.V3.DRAFT.sql"),
  "utf8"
);
const v31DraftSql = readFileSync(
  resolve("docs/reviews/attendance/20261107_atomic_completed_shift_transaction.V3_1.DRAFT.sql"),
  "utf8"
);

describe("P0-01 V3.1: Clock-out timestamp, business-date, and payroll integrity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    qrEventsCallIndex = 0;
    harness.openCheckinRows = [];
    harness.commitInputs = [];
    harness.rpcResponse = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("includes scannedAt and sourceScanEventId provenance in QR clock-out commit metadata without overriding attendance_business_date", async () => {
    vi.setSystemTime(new Date("2026-11-05T15:00:00.000Z"));
    harness.openCheckinRows = [
      {
        id: "checkin-open-v31",
        staff_id: "staff-v31",
        branch_id: "branch-v31",
        shift_date: "2026-11-05",
        shift_type: "single",
        shift_instance_key:
          "staff-v31|branch-v31|2026-11-05|single|window:1|14:00:00|23:00:00|weekly|sched-v31",
        checked_in_at: "2026-11-05T06:00:00.000Z",
        checked_out_at: null,
        status: "checked_in",
        scheduled_start_at: "2026-11-05T06:00:00.000Z",
        scheduled_end_at: "2026-11-05T15:00:00.000Z",
        branch_timezone: "Asia/Manila",
        attendance_business_date: "2026-11-05",
        late_minutes: 0,
        is_test: false,
      },
    ];

    const result = await resumeAttendanceScanFromStoredSource({
      sourceScanEventId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      continuationRequestId: "req-v31-clockout",
      expectedStaffId: "staff-v31",
      expectedBranchId: "branch-v31",
      commit: async (_admin, input) => {
        harness.commitInputs.push(input as unknown as Record<string, unknown>);
        return {
          code: "committed",
          scanEventId: "evt-v31-out",
          checkinId: input.checkinId ?? undefined,
          recoveryIssueId: undefined,
          result: { ...input.result, scanEventId: "evt-v31-out" },
        };
      },
      reconcileProvisional: async () => {
        throw new Error("Unexpected provisional reconciliation");
      },
    });

    expect(result.outcome).toBe("success");
    expect(result.attendance?.action).toBe("clock_out");
    expect(result.attendance?.workedMinutes).toBe(540);

    const committed = harness.commitInputs[0] as unknown as AttendanceScanCommitInput;
    expect(committed.event.metadata).toMatchObject({
      scannedAt: "2026-11-05T15:00:00.000Z",
      sourceScanEventId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    });
    expect(committed.checkinUpdate).toMatchObject({
      checked_out_at: "2026-11-05T15:00:00.000Z",
      status: "checked_out",
      clock_out_method: "qr",
      worked_minutes: 540,
    });
    expect(committed.checkinUpdate).not.toHaveProperty("attendance_business_date");
  });

  it.each([
    ["invalid_checkout_timestamp", "Clock-out timestamp cannot be in the future."],
    ["checkout_before_checkin", "Clock-out timestamp cannot be earlier than check-in timestamp."],
    ["invalid_business_date", "Clock-out cannot alter attendance business date."],
    ["invalid_checkin_update", "Clock-out update requires an explicit staff_id."],
  ])("maps V3.1 RPC rejection code %s to structured ATTENDANCE_RPC_REJECTED", async (rpcCode, message) => {
    vi.setSystemTime(new Date("2026-11-05T15:00:00.000Z"));
    harness.openCheckinRows = [
      {
        id: "checkin-open-v31",
        staff_id: "staff-v31",
        branch_id: "branch-v31",
        shift_date: "2026-11-05",
        shift_type: "single",
        shift_instance_key:
          "staff-v31|branch-v31|2026-11-05|single|window:1|14:00:00|23:00:00|weekly|sched-v31",
        checked_in_at: "2026-11-05T06:00:00.000Z",
        checked_out_at: null,
        status: "checked_in",
        scheduled_start_at: "2026-11-05T06:00:00.000Z",
        scheduled_end_at: "2026-11-05T15:00:00.000Z",
        branch_timezone: "Asia/Manila",
        attendance_business_date: "2026-11-05",
        late_minutes: 0,
        is_test: false,
      },
    ];
    harness.rpcResponse = {
      data: {
        success: false,
        code: rpcCode,
        message,
        scan_event_id: null,
        checkin_id: "checkin-open-v31",
      },
      error: null,
    };

    await expect(
      resumeAttendanceScanFromStoredSource({
        sourceScanEventId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        continuationRequestId: `req-v31-reject-${rpcCode}`,
        expectedStaffId: "staff-v31",
        expectedBranchId: "branch-v31",
        commit: undefined as unknown as AttendanceScanCommitter,
        reconcileProvisional: async () => {
          throw new Error("Unexpected provisional reconciliation");
        },
      })
    ).rejects.toMatchObject({
      code: "ATTENDANCE_RPC_REJECTED",
      details: {
        rpcCode,
        checkinId: "checkin-open-v31",
      },
    });
  });

  it("preserves V3.DRAFT.sql untouched and enforces independent clock-out validation in V3_1.DRAFT.sql", () => {
    expect(
      existsSync(
        resolve("supabase/migrations/20261107140000_p0_01_atomic_completed_shift_transaction_v3_1.sql")
      )
    ).toBe(false);
    expect(v3DraftSql).toContain("Proposed future migration filename");
    expect(v31DraftSql).toContain("create or replace function public.commit_attendance_scan_transaction(");
    expect(v31DraftSql).toContain("p_device_scan_type text default 'attendance'");
    expect(v31DraftSql).toContain("returns table (");
    expect(v31DraftSql).toContain("security invoker");
    expect(v31DraftSql).toContain("'invalid_checkout_timestamp'");
    expect(v31DraftSql).toContain("'checkout_before_checkin'");
    expect(v31DraftSql).toContain("'invalid_checkin_update'");
    expect(v31DraftSql).toContain("and checkin_row.staff_id = p_staff_id");
    expect(v31DraftSql).toContain("and checkin_row.is_test = p_is_test");
    expect(v31DraftSql).toContain(
      "v_checkin_business_date := coalesce(v_existing_checkin.attendance_business_date, v_existing_checkin.shift_date);"
    );
    expect(v31DraftSql).toContain("normalizedClockOutMetrics");
    expect(v31DraftSql).toContain("to service_role;");
  });
});
