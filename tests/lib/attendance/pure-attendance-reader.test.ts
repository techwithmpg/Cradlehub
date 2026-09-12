import { readFileSync } from "node:fs";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// Vi mocks for module testing
const mockGetUser = vi.fn();
const mockStaffSelect = vi.fn();
const mockCheckinsSelect = vi.fn();
const mockExceptionsSelect = vi.fn();
const mockBookingsSelect = vi.fn();
const mockStaffDevicesSelect = vi.fn();

function createChain(resolver: () => Promise<any>) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    lte: () => chain,
    is: () => chain,
    order: () => chain,
    limit: () => resolver(),
    maybeSingle: () => resolver(),
    single: () => resolver(),
    then: (resolve: any, reject: any) => resolver().then(resolve, reject),
  };
  return chain;
}

const mockUserClient = {
  auth: {
    getUser: mockGetUser,
  },
  from: vi.fn((table: string) => {
    if (table === "staff") return createChain(mockStaffSelect);
    if (table === "staff_shift_checkins") return createChain(mockCheckinsSelect);
    if (table === "attendance_exceptions") return createChain(mockExceptionsSelect);
    if (table === "bookings") return createChain(mockBookingsSelect);
    return createChain(vi.fn().mockResolvedValue({ data: [], error: null }));
  }),
};

const mockAdminClient = {
  from: vi.fn((table: string) => {
    if (table === "staff_devices") return createChain(mockStaffDevicesSelect);
    return createChain(vi.fn().mockResolvedValue({ data: [], error: null }));
  }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockUserClient),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      if (name === "cradle_attendance_device" || name === "cradle_device") {
        return { value: "test-device-secret" };
      }
      return undefined;
    },
  })),
}));

vi.mock("@/lib/attendance/queries", () => ({
  getAttendanceSettings: vi.fn(async () => ({
    branch_id: "branch-1",
    timezone: "Asia/Manila",
    attendance_day_boundary: "06:00:00",
    clock_in_early_grace_minutes: 15,
    clock_in_late_grace_minutes: 5,
    clock_out_early_grace_minutes: 5,
    clock_out_late_grace_minutes: 15,
    duplicate_scan_window_seconds: 90,
    test_mode_enabled: false,
  })),
}));

vi.mock("@/lib/attendance/shift-instance", () => ({
  getAttendanceBranchNow: vi.fn(() => ({
    businessDate: "2026-09-13",
    timezone: "Asia/Manila",
  })),
}));

vi.mock("@/lib/queries/resolved-staff-schedules", () => ({
  getResolvedStaffSchedulesForDate: vi.fn(async () => new Map()),
}));

describe("W1A: Pure Attendance Reader — Static Contract & Safety Checks", () => {
  const attendanceReaderSource = readFileSync("src/lib/staff-portal/attendance.ts", "utf8");

  it("1. pure Attendance reader does not import or call recalculateAttendanceClockOutPolicy", () => {
    expect(attendanceReaderSource).not.toContain("recalculateAttendanceClockOutPolicy");
    expect(attendanceReaderSource).not.toContain("recalculate_attendance_clock_out_policy");
  });

  it("2. pure Attendance reader does not perform any database write RPC or mutation", () => {
    expect(attendanceReaderSource).not.toContain(".rpc(");
    expect(attendanceReaderSource).not.toContain(".insert(");
    expect(attendanceReaderSource).not.toContain(".update(");
    expect(attendanceReaderSource).not.toContain(".delete(");
    expect(attendanceReaderSource).not.toContain(".upsert(");
  });

  it("3. exports getPureAttendanceSnapshot and backward-compatible alias getMyAttendanceData", () => {
    expect(attendanceReaderSource).toContain("export async function getPureAttendanceSnapshot(");
    expect(attendanceReaderSource).toContain("export const getMyAttendanceData = getPureAttendanceSnapshot;");
  });

  it("4. actions.ts provides explicit resolvePortalClockOutEligibilityAction for authoritative recalculation", () => {
    const actionsSource = readFileSync("src/app/(dashboard)/staff-portal/actions.ts", "utf8");
    expect(actionsSource).toContain("export async function resolvePortalClockOutEligibilityAction(");
    expect(actionsSource).toContain("export async function clockOutFromStaffPortalAction(");
  });
});

describe("W1A: Pure Attendance Reader — Functional Behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("5. returns null for unauthenticated session", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const { getPureAttendanceSnapshot } = await import("@/lib/staff-portal/attendance");
    const result = await getPureAttendanceSnapshot();
    expect(result).toBeNull();
  });

  it("6. returns null when staff profile is missing or inactive", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "auth-1" } } });
    mockStaffSelect.mockResolvedValueOnce({ data: null, error: null });

    const { getPureAttendanceSnapshot } = await import("@/lib/staff-portal/attendance");
    const result = await getPureAttendanceSnapshot();
    expect(result).toBeNull();
  });

  it("7. derives staff identity strictly server-side from session and presents open shift correctly", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "auth-staff-123" } } });
    mockStaffSelect.mockResolvedValueOnce({
      data: {
        id: "staff-uuid-1",
        full_name: "Maria Santos",
        nickname: "Maria",
        branch_id: "branch-uuid-1",
        staff_type: "therapist",
        system_role: "staff",
      },
      error: null,
    });

    const openCheckinRow = {
      id: "checkin-open-1",
      branch_id: "branch-uuid-1",
      shift_date: "2026-09-13",
      shift_type: "regular",
      scheduled_start_at: "2026-09-13T09:00:00+08:00",
      scheduled_end_at: "2026-09-13T18:00:00+08:00",
      checked_in_at: "2026-09-13T08:55:00+08:00",
      checked_out_at: null,
      status: "checked_in",
      attendance_status: "present",
      exception_state: null,
      worked_minutes: 120,
      late_minutes: 0,
      early_leave_minutes: 0,
      overtime_minutes: 0,
      attendance_expected_end_at: "2026-09-13T18:00:00+08:00",
      earliest_normal_clock_out_at: "2026-09-13T17:55:00+08:00",
      latest_normal_clock_out_at: "2026-09-13T18:15:00+08:00",
      attendance_policy_source: "schedule",
      attendance_policy_snapshot: {
        portalClockOutEligible: true,
        portalEligibilityReason: "eligible_closing_shift",
        expectedEndAt: "2026-09-13T18:00:00+08:00",
        nextAssignmentAt: null,
      },
      provisional_auto_closed_at: null,
      clock_out_confirmation_required: false,
      actual_clock_out_reconciled_at: null,
    };

    mockCheckinsSelect.mockResolvedValueOnce({
      data: [openCheckinRow],
      error: null,
    });
    mockExceptionsSelect.mockResolvedValueOnce({
      data: [],
      error: null,
    });
    mockBookingsSelect.mockResolvedValueOnce({
      data: [],
      error: null,
    });
    mockStaffDevicesSelect.mockResolvedValue({
      data: { id: "device-1" },
      error: null,
    });

    const { getPureAttendanceSnapshot } = await import("@/lib/staff-portal/attendance");
    const result = await getPureAttendanceSnapshot(30);

    expect(result).not.toBeNull();
    expect(result?.staffId).toBe("staff-uuid-1");
    expect(result?.staffName).toBe("Maria Santos");
    expect(result?.today).toBe("2026-09-13");
    expect(result?.currentClockState).toBe("clocked_in");
    expect(result?.currentRecord?.id).toBe("checkin-open-1");
    expect(result?.currentRecord?.checkedInAt).toBe("2026-09-13T08:55:00+08:00");
    expect(result?.currentRecord?.checkedOutAt).toBeNull();
    expect(result?.currentRecord?.workedMinutes).toBe(120);

    // Portal clock-out availability is read from persisted snapshot with zero writes
    expect(result?.portalClockOut?.enabled).toBe(true);
    expect(result?.portalClockOut?.code).toBe("eligible_closing_shift");
    expect(result?.portalClockOut?.label).toBe("Clock out");
  });

  it("8. represents clocked-out state correctly when shift has ended", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "auth-staff-2" } } });
    mockStaffSelect.mockResolvedValueOnce({
      data: {
        id: "staff-uuid-2",
        full_name: "Juan Perez",
        nickname: "Juan",
        branch_id: "branch-uuid-1",
        staff_type: "driver",
        system_role: "driver",
      },
      error: null,
    });

    const completedCheckinRow = {
      id: "checkin-completed-1",
      branch_id: "branch-uuid-1",
      shift_date: "2026-09-13",
      shift_type: "regular",
      scheduled_start_at: "2026-09-13T08:00:00+08:00",
      scheduled_end_at: "2026-09-13T17:00:00+08:00",
      checked_in_at: "2026-09-13T07:58:00+08:00",
      checked_out_at: "2026-09-13T17:02:00+08:00",
      status: "checked_out",
      attendance_status: "present",
      exception_state: null,
      worked_minutes: 544,
      late_minutes: 0,
      early_leave_minutes: 0,
      overtime_minutes: 0,
      attendance_expected_end_at: "2026-09-13T17:00:00+08:00",
      earliest_normal_clock_out_at: "2026-09-13T16:55:00+08:00",
      latest_normal_clock_out_at: "2026-09-13T17:15:00+08:00",
      attendance_policy_source: "schedule",
      attendance_policy_snapshot: {},
      provisional_auto_closed_at: null,
      clock_out_confirmation_required: false,
      actual_clock_out_reconciled_at: null,
    };

    mockCheckinsSelect.mockResolvedValueOnce({
      data: [completedCheckinRow],
      error: null,
    });
    mockExceptionsSelect.mockResolvedValueOnce({
      data: [],
      error: null,
    });
    mockBookingsSelect.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const { getPureAttendanceSnapshot } = await import("@/lib/staff-portal/attendance");
    const result = await getPureAttendanceSnapshot(30);

    expect(result).not.toBeNull();
    expect(result?.currentClockState).toBe("clocked_out");
    expect(result?.portalClockOut?.code).toBe("already_clocked_out");
    expect(result?.portalClockOut?.enabled).toBe(false);
  });

  it("9. represents not_clocked_in when no record exists today", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "auth-staff-3" } } });
    mockStaffSelect.mockResolvedValueOnce({
      data: {
        id: "staff-uuid-3",
        full_name: "Ana Cruz",
        nickname: "Ana",
        branch_id: "branch-uuid-1",
        staff_type: "utility",
        system_role: "utility",
      },
      error: null,
    });

    mockCheckinsSelect.mockResolvedValueOnce({
      data: [],
      error: null,
    });
    mockExceptionsSelect.mockResolvedValueOnce({
      data: [],
      error: null,
    });
    mockBookingsSelect.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const { getPureAttendanceSnapshot } = await import("@/lib/staff-portal/attendance");
    const result = await getPureAttendanceSnapshot(30);

    expect(result).not.toBeNull();
    expect(result?.currentClockState).toBe("not_clocked_in");
    expect(result?.portalClockOut?.code).toBe("no_open_attendance");
    expect(result?.portalClockOut?.enabled).toBe(false);
  });
});
