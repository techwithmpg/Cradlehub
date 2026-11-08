import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const harness = vi.hoisted(() => ({
  recentScanEvents: [] as Array<Record<string, unknown>>,
  openCheckinRows: [] as Array<Record<string, unknown>>,
  provisionalRows: [] as Array<Record<string, unknown>>,
  existingShiftRows: [] as Array<Record<string, unknown>>,
  checkinQueryCount: 0,
  commitInputs: [] as Array<Record<string, unknown>>,
  branchId: "branch-p0a",
  staffHomeBranchId: "branch-p0a",
  activeSchedule: null as Record<string, unknown> | null,
}));

const settings = {
  branch_id: "branch-p0a",
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

const closingShiftSchedule = {
  source: "individual" as const,
  status: "resolved" as const,
  state: "VALID_SCHEDULE" as const,
  isWorking: true,
  isDayOff: false,
  windows: [
    {
      id: "sched-closing-23",
      windowOrder: 1,
      shiftType: "single" as const,
      startTime: "14:00:00",
      endTime: "23:00:00",
    },
  ],
};

const editedClosingShiftSchedule = {
  source: "individual" as const,
  status: "resolved" as const,
  state: "VALID_SCHEDULE" as const,
  isWorking: true,
  isDayOff: false,
  windows: [
    {
      id: "sched-closing-edited",
      windowOrder: 1,
      shiftType: "single" as const,
      startTime: "15:00:00",
      endTime: "23:30:00",
    },
  ],
};

const overnightShiftSchedule = {
  source: "individual" as const,
  status: "resolved" as const,
  state: "VALID_SCHEDULE" as const,
  isWorking: true,
  isDayOff: false,
  windows: [
    {
      id: "sched-overnight",
      windowOrder: 1,
      shiftType: "closing" as const,
      startTime: "21:00:00",
      endTime: "02:00:00",
      endsNextDay: true,
    },
  ],
};

const unscheduledStaffSchedule = {
  source: "individual" as const,
  status: "resolved" as const,
  state: "VALID_SCHEDULE" as const,
  isWorking: false,
  isDayOff: false,
  windows: [],
};

const splitShiftSchedule = {
  source: "individual" as const,
  status: "resolved" as const,
  state: "VALID_SCHEDULE" as const,
  isWorking: true,
  isDayOff: false,
  windows: [
    {
      id: "sched-split-1",
      windowOrder: 1,
      shiftType: "opening" as const,
      startTime: "09:00:00",
      endTime: "13:00:00",
    },
    {
      id: "sched-split-2",
      windowOrder: 2,
      shiftType: "closing" as const,
      startTime: "18:00:00",
      endTime: "22:30:00",
    },
  ],
};

const adjacentOpenCloseSchedule = {
  source: "individual" as const,
  status: "resolved" as const,
  state: "VALID_SCHEDULE" as const,
  isWorking: true,
  isDayOff: false,
  windows: [
    {
      id: "sched-open-adj",
      windowOrder: 1,
      shiftType: "opening" as const,
      startTime: "10:00:00",
      endTime: "17:00:00",
    },
    {
      id: "sched-close-adj",
      windowOrder: 2,
      shiftType: "closing" as const,
      startTime: "17:00:00",
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
            id: "11111111-2222-3333-4444-555555555555",
            branch_id: harness.branchId,
            qr_point_id: "qr-p0a",
            staff_id: "staff-p0a",
            device_id: "device-p0a",
            user_agent: "Vitest",
            ip_address: null,
            reason_code: "wrong_branch",
          },
          error: null,
        });
      }
      return queryChain({
        data: harness.recentScanEvents,
        error: null,
      });
    }
    if (table === "qr_points") {
      return queryChain({
        data: {
          id: "qr-p0a",
          branch_id: harness.branchId,
          public_code: "att-p0a",
          point_type: "attendance",
          resource_id: null,
          label: "Attendance",
          is_active: true,
          requires_registered_device: true,
          scan_behavior: "attendance",
          branches: { name: "P0-A Branch" },
        },
        error: null,
      });
    }
    if (table === "staff_devices") {
      return queryChain({
        data: {
          id: "device-p0a",
          staff_id: "staff-p0a",
          branch_id: harness.branchId,
          status: "active",
          security_state: "clear",
          staff: {
            branch_id: harness.staffHomeBranchId,
            full_name: "Maria Santos",
            nickname: "Maria",
            staff_type: "therapist",
            system_role: "staff",
            is_cross_branch: false,
            is_active: true,
            archived_at: null,
            merged_into_staff_id: null,
            metadata: null,
            branches: { name: "P0-A Branch" },
          },
        },
        error: null,
      });
    }
    if (table === "staff_shift_checkins") {
      harness.checkinQueryCount += 1;
      if (harness.checkinQueryCount === 1) {
        return queryChain({ data: harness.openCheckinRows, error: null });
      }
      if (harness.checkinQueryCount === 2) {
        return queryChain({ data: harness.provisionalRows, error: null });
      }
      return queryChain({ data: harness.existingShiftRows, error: null });
    }
    return queryChain({ data: null, error: null });
  }),
  rpc: vi.fn((funcName: string) => {
    const res =
      funcName === "recalculate_attendance_clock_out_policy"
        ? {
            data: {
              checkin_id: "test",
              attendance_policy_source: "schedule",
            },
            error: null,
          }
        : {
            data: {
              success: true,
              operation_result: {
                ok: true,
                outcome: "success",
                title: "All set",
                message: "Recovered",
                reasonCode: "stale_checkin_recovered_and_clocked_in",
              },
            },
            error: null,
          };
    return {
      ...res,
      maybeSingle: vi.fn(async () => res),
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) =>
        Promise.resolve(res).then(onFulfilled, onRejected),
    };
  }),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminClient,
}));
vi.mock("@/lib/attendance/queries", () => ({
  getAttendanceSettings: vi.fn(async () => settings),
}));
vi.mock("@/lib/queries/resolved-staff-schedules", () => ({
  getResolvedStaffSchedulesForDate: vi.fn(
    async () => new Map([["staff-p0a", harness.activeSchedule ?? closingShiftSchedule]])
  ),
}));

import {
  resumeAttendanceScanFromStoredSource,
  type AttendanceScanCommitInput,
} from "@/lib/attendance/scan-engine";
import {
  isEligibleSplitShiftClockInAfterCompletion,
  resolveAttendanceScanIntent,
} from "@/lib/attendance/attendance-intent-engine";

const v3DraftPath = resolve(
  "docs/reviews/attendance/20261107_atomic_completed_shift_transaction.V3.DRAFT.sql"
);
const v3DraftSql = readFileSync(v3DraftPath, "utf8");

async function runScanAt(isoTime: string) {
  vi.setSystemTime(new Date(isoTime));
  qrEventsCallIndex = 0;
  harness.checkinQueryCount = 0;
  return resumeAttendanceScanFromStoredSource({
    sourceScanEventId: "11111111-2222-3333-4444-555555555555",
    continuationRequestId: `req-${isoTime}`,
    expectedStaffId: "staff-p0a",
    expectedBranchId: harness.branchId,
    commit: async (_admin, input) => {
      harness.commitInputs.push(input as unknown as Record<string, unknown>);
      return {
        code: "committed",
        scanEventId: "scan-event-committed",
        checkinId: input.event.checkinId ?? undefined,
        recoveryIssueId: undefined,
        result: { ...input.result, scanEventId: "scan-event-committed" },
      };
    },
    reconcileProvisional: async () => {
      throw new Error("Unexpected provisional reconciliation");
    },
  });
}

describe("P0-01 V3: Consolidated attendance integrity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    harness.recentScanEvents = [];
    harness.openCheckinRows = [];
    harness.provisionalRows = [];
    harness.existingShiftRows = [];
    harness.checkinQueryCount = 0;
    harness.commitInputs = [];
    harness.branchId = "branch-p0a";
    harness.staffHomeBranchId = "branch-p0a";
    harness.activeSchedule = closingShiftSchedule;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("1. debounces immediate re-scan after QR or Staff Portal clock-out as already_checked_out noop", async () => {
    harness.recentScanEvents = [
      {
        id: "portal-clock-out-evt",
        action: "portal_clock_out",
        qr_point_id: null,
      },
    ];

    const result = await runScanAt("2026-11-05T15:00:30.000Z"); // 23:00:30 Manila

    expect(result.outcome).toBe("noop");
    expect(result.reasonCode).toBe("already_checked_out");
    expect(result.title).toBe("Attendance is already complete");
    const committed = harness.commitInputs[0] as unknown as AttendanceScanCommitInput;
    expect(committed.checkinInsert).toBeUndefined();
    expect(committed.exception).toBeUndefined();
  });

  it("2. blocks post-completion re-scan at 11:05 PM with real 9-segment shift_instance_key and zero recovery exceptions", async () => {
    harness.existingShiftRows = [
      {
        id: "checkin-completed-2300",
        staff_id: "staff-p0a",
        branch_id: "branch-p0a",
        shift_date: "2026-11-05",
        shift_type: "single",
        shift_instance_key:
          "staff-p0a|branch-p0a|2026-11-05|single|window:1|14:00:00|23:00:00|weekly|sched-closing-23",
        checked_in_at: "2026-11-05T05:55:00.000Z",
        checked_out_at: "2026-11-05T15:00:00.000Z",
        status: "checked_out",
        attendance_business_date: "2026-11-05",
        is_test: false,
      },
    ];

    const result = await runScanAt("2026-11-05T15:05:00.000Z"); // 23:05 Manila

    expect(result.outcome).toBe("noop");
    expect(result.reasonCode).toBe("already_checked_out");
    const committed = harness.commitInputs[0] as unknown as AttendanceScanCommitInput;
    expect(committed.checkinInsert).toBeUndefined();
    expect(committed.exception).toBeUndefined();
    expect(committed.event.checkinId).toBe("checkin-completed-2300");
  });

  it("3. blocks post-midnight same-business-date re-scan (00:15 AM Manila before 06:00 boundary)", async () => {
    harness.existingShiftRows = [
      {
        id: "checkin-completed-2300",
        staff_id: "staff-p0a",
        branch_id: "branch-p0a",
        shift_date: "2026-11-05",
        shift_type: "single",
        shift_instance_key:
          "staff-p0a|branch-p0a|2026-11-05|single|window:1|14:00:00|23:00:00|weekly|sched-closing-23",
        checked_in_at: "2026-11-05T05:55:00.000Z",
        checked_out_at: "2026-11-05T15:00:00.000Z",
        status: "checked_out",
        attendance_business_date: "2026-11-05",
        is_test: false,
      },
    ];

    const result = await runScanAt("2026-11-05T16:15:00.000Z"); // 2026-11-06 00:15 Manila

    expect(result.outcome).toBe("noop");
    expect(result.reasonCode).toBe("already_checked_out");
    const committed = harness.commitInputs[0] as unknown as AttendanceScanCommitInput;
    expect(committed.checkinInsert).toBeUndefined();
    expect(committed.exception).toBeUndefined();
  });

  it("4. blocks re-scan after post-midnight checkout of an overnight shift (21:00 to 02:00)", async () => {
    harness.activeSchedule = overnightShiftSchedule;
    harness.existingShiftRows = [
      {
        id: "checkin-overnight-done",
        staff_id: "staff-p0a",
        branch_id: "branch-p0a",
        shift_date: "2026-11-05",
        shift_type: "closing",
        shift_instance_key:
          "staff-p0a|branch-p0a|2026-11-05|closing|window:1|21:00:00|02:00:00|weekly|sched-overnight",
        checked_in_at: "2026-11-05T12:55:00.000Z",
        checked_out_at: "2026-11-05T18:02:00.000Z", // 02:02 AM Manila
        status: "checked_out",
        attendance_business_date: "2026-11-05",
        is_test: false,
      },
    ];

    const result = await runScanAt("2026-11-05T18:10:00.000Z"); // 02:10 AM Manila

    expect(result.outcome).toBe("noop");
    expect(result.reasonCode).toBe("already_checked_out");
    expect(
      (harness.commitInputs[0] as unknown as AttendanceScanCommitInput).checkinInsert
    ).toBeUndefined();
  });

  it("5. handles legacy NULL attendance_business_date rows without bleeding prior-night shift_date into next day", async () => {
    // 5a: Legacy row on 2026-11-05 with NULL attendance_business_date blocks same-day rescan
    harness.existingShiftRows = [
      {
        id: "checkin-legacy-null-bdate",
        staff_id: "staff-p0a",
        branch_id: "branch-p0a",
        shift_date: "2026-11-05",
        shift_type: "single",
        shift_instance_key: null,
        checked_in_at: "2026-11-05T06:00:00.000Z",
        checked_out_at: "2026-11-05T15:00:00.000Z",
        status: "checked_out",
        attendance_business_date: null,
        is_test: false,
      },
    ];

    const blockedSameDay = await runScanAt("2026-11-05T15:10:00.000Z");
    expect(blockedSameDay.outcome).toBe("noop");
    expect(blockedSameDay.reasonCode).toBe("already_checked_out");

    // 5b: Prior business night (attendance_business_date = 2026-11-04, calendar shift_date = 2026-11-05)
    // does NOT falsely block genuine 2026-11-05 shift
    harness.commitInputs = [];
    harness.existingShiftRows = [
      {
        id: "checkin-prior-night",
        staff_id: "staff-p0a",
        branch_id: "branch-p0a",
        shift_date: "2026-11-05",
        shift_type: "closing",
        shift_instance_key: null,
        checked_in_at: "2026-11-04T16:10:00.000Z",
        checked_out_at: "2026-11-04T18:00:00.000Z",
        status: "checked_out",
        attendance_business_date: "2026-11-04",
        is_test: false,
      },
    ];

    const allowedNextDay = await runScanAt("2026-11-05T05:50:00.000Z"); // 13:50 Manila for 14:00 shift
    expect(allowedNextDay.outcome).toBe("success");
    expect(allowedNextDay.attendance?.action).toBe("clock_in");
  });

  it("6. blocks re-clock-in when schedule was edited after checkout (changed shift_instance_key)", async () => {
    harness.activeSchedule = editedClosingShiftSchedule;
    harness.existingShiftRows = [
      {
        id: "checkin-before-edit",
        staff_id: "staff-p0a",
        branch_id: "branch-p0a",
        shift_date: "2026-11-05",
        shift_type: "single",
        shift_instance_key:
          "staff-p0a|branch-p0a|2026-11-05|single|window:1|14:00:00|23:00:00|weekly|sched-closing-23",
        checked_in_at: "2026-11-05T06:00:00.000Z",
        checked_out_at: "2026-11-05T15:00:00.000Z",
        status: "checked_out",
        attendance_business_date: "2026-11-05",
        is_test: false,
      },
    ];

    const result = await runScanAt("2026-11-05T15:10:00.000Z");
    expect(result.outcome).toBe("noop");
    expect(result.reasonCode).toBe("already_checked_out");
    expect(
      (harness.commitInputs[0] as unknown as AttendanceScanCommitInput).checkinInsert
    ).toBeUndefined();
  });

  it("7. rejects adjacent continuous open_close windows (10:00-17:00 + 17:00-23:00) as a split shift after checkout", async () => {
    harness.activeSchedule = adjacentOpenCloseSchedule;
    harness.existingShiftRows = [
      {
        id: "checkin-adj-open",
        staff_id: "staff-p0a",
        branch_id: "branch-p0a",
        shift_date: "2026-11-05",
        shift_type: "opening",
        shift_instance_key:
          "staff-p0a|branch-p0a|2026-11-05|opening|window:1|10:00:00|17:00:00|weekly|sched-open-adj",
        checked_in_at: "2026-11-05T02:00:00.000Z",
        checked_out_at: "2026-11-05T08:45:00.000Z", // 16:45 Manila
        status: "checked_out",
        attendance_business_date: "2026-11-05",
        is_test: false,
      },
    ];

    const result = await runScanAt("2026-11-05T08:55:00.000Z"); // 16:55 Manila
    expect(result.outcome).toBe("noop");
    expect(result.reasonCode).toBe("already_checked_out");
    expect(
      (harness.commitInputs[0] as unknown as AttendanceScanCommitInput).checkinInsert
    ).toBeUndefined();
  });

  it("8. blocks premature 11:01 AM scan for 18:00 Window 2, allows valid early (17:35) and late (18:20) arrivals, and blocks post-Window-2 rescan", async () => {
    harness.activeSchedule = splitShiftSchedule;
    const completedWindow1EarlyOut = {
      id: "checkin-split-win1",
      staff_id: "staff-p0a",
      branch_id: "branch-p0a",
      shift_date: "2026-11-05",
      shift_type: "opening",
      shift_instance_key:
        "staff-p0a|branch-p0a|2026-11-05|opening|window:1|09:00:00|13:00:00|weekly|sched-split-1",
      checked_in_at: "2026-11-05T00:55:00.000Z",
      checked_out_at: "2026-11-05T03:00:00.000Z", // 11:00 AM Manila
      status: "checked_out",
      scheduled_start_at: "2026-11-05T01:00:00.000Z",
      scheduled_end_at: "2026-11-05T05:00:00.000Z",
      attendance_business_date: "2026-11-05",
      is_test: false,
    };
    harness.existingShiftRows = [completedWindow1EarlyOut];

    // 8a: Premature scan at 11:01 AM Manila (03:01 UTC) for 18:00 Window 2 -> blocked as noop
    const premature1101 = await runScanAt("2026-11-05T03:01:00.000Z");
    expect(premature1101.outcome).toBe("noop");
    expect(premature1101.reasonCode).toBe("already_checked_out");
    expect(
      (harness.commitInputs[0] as unknown as AttendanceScanCommitInput).checkinInsert
    ).toBeUndefined();

    // 8b: Valid early arrival at 17:35 Manila (09:35 UTC) within 30m early allowance -> allowed
    harness.commitInputs = [];
    const validEarly = await runScanAt("2026-11-05T09:35:00.000Z");
    expect(validEarly.outcome).toBe("success");
    expect(validEarly.attendance?.action).toBe("clock_in");
    expect(validEarly.attendance?.shiftLabel).toBe("closing");
    const earlyCommit = harness.commitInputs[0] as unknown as AttendanceScanCommitInput;
    expect(earlyCommit.checkinInsert?.shift_instance_key).toBe(
      "staff-p0a|branch-p0a|2026-11-05|closing|window:2|18:00:00|22:30:00|weekly|sched-split-2"
    );

    // 8c: Valid late arrival at 18:20 Manila (10:20 UTC) within 120m window -> allowed with lateMinutes = 20
    harness.commitInputs = [];
    const validLate = await runScanAt("2026-11-05T10:20:00.000Z");
    expect(validLate.outcome).toBe("success");
    expect(validLate.attendance?.action).toBe("clock_in");
    const lateCommit = harness.commitInputs[0] as unknown as AttendanceScanCommitInput;
    expect(lateCommit.checkinInsert?.late_minutes).toBe(20);
    expect(lateCommit.checkinInsert?.shift_instance_key).toContain("|window:2|");

    // 8d: Post-Window-2 scan at 22:35 Manila (14:35 UTC) -> blocked as noop
    harness.commitInputs = [];
    harness.existingShiftRows = [
      {
        id: "checkin-split-win2",
        staff_id: "staff-p0a",
        branch_id: "branch-p0a",
        shift_date: "2026-11-05",
        shift_type: "closing",
        shift_instance_key:
          "staff-p0a|branch-p0a|2026-11-05|closing|window:2|18:00:00|22:30:00|weekly|sched-split-2",
        checked_in_at: "2026-11-05T09:35:00.000Z",
        checked_out_at: "2026-11-05T14:30:00.000Z",
        status: "checked_out",
        attendance_business_date: "2026-11-05",
        is_test: false,
      },
      completedWindow1EarlyOut,
    ];
    const postWindow2 = await runScanAt("2026-11-05T14:35:00.000Z");
    expect(postWindow2.outcome).toBe("noop");
    expect(postWindow2.reasonCode).toBe("already_checked_out");
  });

  it("9. allows genuine next business-day clock-in after 06:00 AM Manila rollover", async () => {
    harness.existingShiftRows = [
      {
        id: "checkin-yesterday-2300",
        staff_id: "staff-p0a",
        branch_id: "branch-p0a",
        shift_date: "2026-11-05",
        shift_type: "single",
        shift_instance_key:
          "staff-p0a|branch-p0a|2026-11-05|single|window:1|14:00:00|23:00:00|weekly|sched-closing-23",
        checked_in_at: "2026-11-05T05:55:00.000Z",
        checked_out_at: "2026-11-05T15:00:00.000Z",
        status: "checked_out",
        attendance_business_date: "2026-11-05",
        is_test: false,
      },
    ];

    // 2026-11-06 13:50 Manila (05:50 UTC) -> business date 2026-11-06
    const result = await runScanAt("2026-11-06T05:50:00.000Z");
    expect(result.outcome).toBe("success");
    expect(result.attendance?.action).toBe("clock_in");
    const committed = harness.commitInputs[0] as unknown as AttendanceScanCommitInput;
    expect(committed.checkinInsert?.attendance_business_date).toBe("2026-11-06");
  });

  it("10. preserves legitimate missing-attendance closing recovery when NO completed shift exists", async () => {
    harness.existingShiftRows = [];

    // 23:05 Manila on 2026-11-05 with NO prior check-in at all -> recovery exception created
    const result = await runScanAt("2026-11-05T15:05:00.000Z");
    expect(result.outcome).toBe("exception");
    expect(result.reasonCode).toBe("likely_closing_scan_without_clock_in");
    const committed = harness.commitInputs[0] as unknown as AttendanceScanCommitInput;
    expect(committed.checkinInsert).toBeUndefined();
    expect(committed.exception?.exceptionType).toBe("likely_closing_scan_without_clock_in");
  });

  it("11. permits approved inter-branch receiving clock-in and forwards sourceScanEventId provenance", async () => {
    harness.branchId = "branch-receiving";
    harness.staffHomeBranchId = "branch-sending";
    harness.existingShiftRows = [];

    const result = await runScanAt("2026-11-05T06:05:00.000Z"); // 14:05 Manila
    expect(result.outcome).toBe("success");
    expect(result.attendance?.action).toBe("clock_in");
    const committed = harness.commitInputs[0] as unknown as AttendanceScanCommitInput;
    expect(committed.event.metadata).toMatchObject({
      sourceScanEventId: "11111111-2222-3333-4444-555555555555",
    });
  });

  it("12. enforces V3 review-only SQL draft contract without promoting an active production migration", () => {
    expect(
      existsSync(
        resolve("supabase/migrations/20261106153000_prevent_completed_shift_reclock_in.sql")
      )
    ).toBe(false);
    expect(v3DraftSql).toContain(
      "create or replace function public.commit_attendance_scan_transaction("
    );
    expect(v3DraftSql).toContain("p_device_scan_type text default 'attendance'");
    expect(v3DraftSql).toContain("returns table (");
    expect(v3DraftSql).toContain("security invoker");
    expect(v3DraftSql).toContain("set search_path = public, extensions");
    expect(v3DraftSql).toContain("prior_window.end_time < next_window.start_time");
    expect(v3DraftSql).toContain("v_earliest_clock_in_before_mins");
    expect(v3DraftSql).toContain("v_authoritative_business_date");
    expect(v3DraftSql).toContain("to service_role;");
    const postMidnightIntent = resolveAttendanceScanIntent({
      scanIso: "2026-11-05T16:15:00.000Z",
      scanDate: "2026-11-06",
      scanTime: "00:15:00",
      businessDate: "2026-11-05",
      timezone: "Asia/Manila",
      settings,
      schedule: closingShiftSchedule,
      activeCheckin: null,
    });
    expect(postMidnightIntent.schedule.shiftDate).toBe("2026-11-05");
    expect(postMidnightIntent.type).toBe("likely_closing_scan_without_clock_in");

    expect(
      isEligibleSplitShiftClockInAfterCompletion({
        scanDate: "2026-11-05",
        scanTime: "16:55:00",
        businessDate: "2026-11-05",
        timezone: "Asia/Manila",
        settings,
        schedule: adjacentOpenCloseSchedule,
        completedCheckins: [
          {
            id: "c-adj",
            checkedInAt: "2026-11-05T02:00:00.000Z",
            checkedOutAt: "2026-11-05T08:45:00.000Z",
            status: "checked_out",
            shiftDate: "2026-11-05",
            shiftType: "opening",
            shiftInstanceKey:
              "staff-p0a|branch-p0a|2026-11-05|opening|window:1|10:00:00|17:00:00|weekly|sched-open-adj",
          },
        ],
      })
    ).toBe(false);
  });

  it("13. allows unscheduled staff member to clock out cleanly on the same business date and branch", async () => {
    harness.activeSchedule = unscheduledStaffSchedule;
    harness.openCheckinRows = [
      {
        id: "checkin-unscheduled-today",
        staff_id: "staff-p0a",
        branch_id: "branch-p0a",
        shift_date: "2026-11-05",
        shift_type: "single",
        shift_instance_key:
          "staff-p0a|branch-p0a|2026-11-05|single|none|none|none|unscheduled|none",
        checked_in_at: "2026-11-05T03:00:00.000Z",
        checked_out_at: null,
        status: "checked_in",
        attendance_business_date: "2026-11-05",
        is_test: false,
      },
    ];

    const result = await runScanAt("2026-11-05T11:00:00.000Z");

    expect(result.outcome).toBe("success");
    expect(result.attendance?.action).toBe("clock_out");
    expect(result.title).toContain("checked out");
    const committed = harness.commitInputs[0] as unknown as AttendanceScanCommitInput;
    expect(committed.checkinUpdate).toBeDefined();
    expect(committed.checkinUpdate?.status).toBe("checked_out");
    expect(committed.checkinInsert).toBeUndefined();
  });

  it("14. routes prior-business-day open check-in to stale recovery even when unscheduled", async () => {
    harness.activeSchedule = unscheduledStaffSchedule;
    harness.openCheckinRows = [
      {
        id: "checkin-stale-yesterday",
        staff_id: "staff-p0a",
        branch_id: "branch-p0a",
        shift_date: "2026-11-04",
        shift_type: "single",
        shift_instance_key:
          "staff-p0a|branch-p0a|2026-11-04|single|none|none|none|unscheduled|none",
        checked_in_at: "2026-11-04T03:00:00.000Z",
        checked_out_at: null,
        status: "checked_in",
        attendance_business_date: "2026-11-04",
        is_test: false,
      },
    ];

    const result = await runScanAt("2026-11-05T03:00:00.000Z");

    expect(result.reasonCode).toBe("stale_checkin_recovered_and_clocked_in");
  });

  it("15. does not clock out open check-in from another branch", async () => {
    harness.activeSchedule = unscheduledStaffSchedule;
    harness.openCheckinRows = [
      {
        id: "checkin-other-branch",
        staff_id: "staff-p0a",
        branch_id: "branch-other",
        shift_date: "2026-11-05",
        shift_type: "single",
        shift_instance_key:
          "staff-p0a|branch-other|2026-11-05|single|none|none|none|unscheduled|none",
        checked_in_at: "2026-11-05T03:00:00.000Z",
        checked_out_at: null,
        status: "checked_in",
        attendance_business_date: "2026-11-05",
        is_test: false,
      },
    ];

    const result = await runScanAt("2026-11-05T05:00:00.000Z");

    expect(result.attendance?.action).not.toBe("clock_out");
  });
});
