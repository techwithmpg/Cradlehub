import { readFileSync } from "node:fs";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// Mutation spies to guarantee pure read-side safety
const mockInsertSpy = vi.fn();
const mockUpdateSpy = vi.fn();
const mockDeleteSpy = vi.fn();
const mockUpsertSpy = vi.fn();
const mockRpcSpy = vi.fn();

// Select resolvers for mock tables
const mockGetUser = vi.fn();
const mockStaffSelect = vi.fn();
const mockCheckinsSelect = vi.fn();
const mockExceptionsSelect = vi.fn();
const mockBookingsSelect = vi.fn();
const mockStaffDevicesSelect = vi.fn();
const mockAttendanceSettingsSelect = vi.fn();
const mockRuleVersionsSelect = vi.fn();
const mockBranchesSelect = vi.fn();

function createChain(resolver: () => Promise<any>) {
  const chain: any = {
    select: () => chain,
    insert: (...args: any[]) => {
      mockInsertSpy(...args);
      return chain;
    },
    update: (...args: any[]) => {
      mockUpdateSpy(...args);
      return chain;
    },
    delete: (...args: any[]) => {
      mockDeleteSpy(...args);
      return chain;
    },
    upsert: (...args: any[]) => {
      mockUpsertSpy(...args);
      return chain;
    },
    eq: () => chain,
    gte: () => chain,
    lte: () => chain,
    is: () => chain,
    order: () => chain,
    limit: () => chain,
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
    if (table === "attendance_settings") return createChain(mockAttendanceSettingsSelect);
    if (table === "attendance_rule_versions") return createChain(mockRuleVersionsSelect);
    return createChain(vi.fn().mockResolvedValue({ data: [], error: null }));
  }),
  rpc: (...args: any[]) => {
    mockRpcSpy(...args);
    return Promise.resolve({ data: null, error: null });
  },
};

const mockAdminClient = {
  from: vi.fn((table: string) => {
    if (table === "staff_devices") return createChain(mockStaffDevicesSelect);
    if (table === "attendance_settings") return createChain(mockAttendanceSettingsSelect);
    if (table === "attendance_rule_versions") return createChain(mockRuleVersionsSelect);
    if (table === "branches") return createChain(mockBranchesSelect);
    return createChain(vi.fn().mockResolvedValue({ data: [], error: null }));
  }),
  rpc: (...args: any[]) => {
    mockRpcSpy(...args);
    return Promise.resolve({ data: null, error: null });
  },
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

vi.mock("@/lib/attendance/shift-instance", () => ({
  getAttendanceBranchNow: vi.fn(() => ({
    businessDate: "2026-09-13",
    timezone: "Asia/Manila",
  })),
}));

vi.mock("@/lib/queries/resolved-staff-schedules", () => ({
  getResolvedStaffSchedulesForDate: vi.fn(async () => new Map()),
}));

describe("W1A: Pure Attendance Reader — Static Contract & Dependency Integrity", () => {
  const attendanceReaderSource = readFileSync("src/lib/staff-portal/attendance.ts", "utf8");
  const queriesSource = readFileSync("src/lib/attendance/queries.ts", "utf8");

  it("1. pure Attendance reader imports getAttendanceSettingsReadOnly, NOT mutating getAttendanceSettings", () => {
    expect(attendanceReaderSource).toContain("import { getAttendanceSettingsReadOnly } from \"@/lib/attendance/queries\";");
    // Must not call the mutating helper
    expect(attendanceReaderSource).not.toMatch(/\bgetAttendanceSettings\s*\(/);
    expect(attendanceReaderSource).not.toContain("recalculateAttendanceClockOutPolicy");
    expect(attendanceReaderSource).not.toContain("recalculate_attendance_clock_out_policy");
  });

  it("2. pure Attendance reader does not perform any database write RPC or direct mutation", () => {
    expect(attendanceReaderSource).not.toContain(".rpc(");
    expect(attendanceReaderSource).not.toContain(".insert(");
    expect(attendanceReaderSource).not.toContain(".update(");
    expect(attendanceReaderSource).not.toContain(".delete(");
    expect(attendanceReaderSource).not.toContain(".upsert(");
  });

  it("3. queries.ts exports getAttendanceSettingsReadOnly and getAttendanceSettingsSnapshot", () => {
    expect(queriesSource).toContain("export async function getAttendanceSettingsReadOnly(");
    expect(queriesSource).toContain("export const getAttendanceSettingsSnapshot = getAttendanceSettingsReadOnly;");
  });

  it("4. actions.ts provides explicit resolvePortalClockOutEligibilityAction for authoritative recalculation", () => {
    const actionsSource = readFileSync("src/app/(dashboard)/staff-portal/actions.ts", "utf8");
    expect(actionsSource).toContain("export async function resolvePortalClockOutEligibilityAction(");
    expect(actionsSource).toContain("export async function clockOutFromStaffPortalAction(");
  });
});

describe("W1A: Attendance Settings Read-Only Path Contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("5. getAttendanceSettingsReadOnly with existing settings returns normalized settings with zero writes", async () => {
    mockAttendanceSettingsSelect.mockResolvedValueOnce({
      data: {
        branch_id: "branch-uuid-1",
        timezone: "Asia/Manila",
        clock_in_early_grace_minutes: 20,
        clock_in_late_grace_minutes: 8,
      },
      error: null,
    });
    mockRuleVersionsSelect.mockResolvedValueOnce({
      data: {
        rule_values: {
          late_grace_minutes: 10,
        },
      },
      error: null,
    });

    const { getAttendanceSettingsReadOnly } = await import("@/lib/attendance/queries");
    const settings = await getAttendanceSettingsReadOnly("branch-uuid-1");

    expect(settings.branch_id).toBe("branch-uuid-1");
    expect(settings.clock_in_early_grace_minutes).toBe(20);
    expect(settings.late_grace_minutes).toBe(10);

    // Assert ZERO mutations were called
    expect(mockInsertSpy).not.toHaveBeenCalled();
    expect(mockUpdateSpy).not.toHaveBeenCalled();
    expect(mockDeleteSpy).not.toHaveBeenCalled();
    expect(mockUpsertSpy).not.toHaveBeenCalled();
    expect(mockRpcSpy).not.toHaveBeenCalled();
  });

  it("6. getAttendanceSettingsReadOnly with missing settings row returns in-memory defaults with ZERO inserts", async () => {
    // Missing settings row
    mockAttendanceSettingsSelect.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    // No active rule versions
    mockRuleVersionsSelect.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { getAttendanceSettingsReadOnly } = await import("@/lib/attendance/queries");
    const settings = await getAttendanceSettingsReadOnly("branch-unconfigured");

    expect(settings.branch_id).toBe("branch-unconfigured");
    expect(settings.timezone).toBe("Asia/Manila");
    expect(settings.clock_in_early_grace_minutes).toBe(15);
    expect(settings.clock_in_late_grace_minutes).toBe(5);

    // CRITICAL: Must NOT perform any insert into attendance_settings
    expect(mockInsertSpy).not.toHaveBeenCalled();
    expect(mockUpdateSpy).not.toHaveBeenCalled();
    expect(mockDeleteSpy).not.toHaveBeenCalled();
    expect(mockUpsertSpy).not.toHaveBeenCalled();
    expect(mockRpcSpy).not.toHaveBeenCalled();
  });

  it("7. existing getAttendanceSettings preserves mutating auto-initialization for operational consumers", async () => {
    // Missing settings row
    mockAttendanceSettingsSelect.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    mockBranchesSelect.mockResolvedValueOnce({
      data: { id: "branch-uuid-1", name: "Main Branch" },
      error: null,
    });
    mockAttendanceSettingsSelect.mockResolvedValueOnce({
      data: {
        branch_id: "branch-uuid-1",
        timezone: "Asia/Manila",
      },
      error: null,
    });

    const { getAttendanceSettings } = await import("@/lib/attendance/queries");
    const settings = await getAttendanceSettings("branch-uuid-1");

    expect(settings.branch_id).toBe("branch-uuid-1");
    // Proves the operational path DOES execute an insert when missing, preserving legacy contract
    expect(mockInsertSpy).toHaveBeenCalledTimes(1);
    expect(mockInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ branch_id: "branch-uuid-1" })
    );
  });
});

describe("W1A: Pure Attendance Reader — End-to-End Transitive Read Safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("8. returns null for unauthenticated session with zero mutations", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const { getPureAttendanceSnapshot } = await import("@/lib/staff-portal/attendance");
    const result = await getPureAttendanceSnapshot();
    expect(result).toBeNull();

    expect(mockInsertSpy).not.toHaveBeenCalled();
    expect(mockUpdateSpy).not.toHaveBeenCalled();
    expect(mockDeleteSpy).not.toHaveBeenCalled();
    expect(mockRpcSpy).not.toHaveBeenCalled();
  });

  it("9. returns null when staff profile is missing with zero mutations", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "auth-1" } } });
    mockStaffSelect.mockResolvedValueOnce({ data: null, error: null });

    const { getPureAttendanceSnapshot } = await import("@/lib/staff-portal/attendance");
    const result = await getPureAttendanceSnapshot();
    expect(result).toBeNull();

    expect(mockInsertSpy).not.toHaveBeenCalled();
    expect(mockUpdateSpy).not.toHaveBeenCalled();
    expect(mockDeleteSpy).not.toHaveBeenCalled();
  });

  it("10. presents open shift correctly with existing settings and performs ZERO database writes", async () => {
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

    // Existing attendance settings row
    mockAttendanceSettingsSelect.mockResolvedValueOnce({
      data: {
        branch_id: "branch-uuid-1",
        timezone: "Asia/Manila",
      },
      error: null,
    });
    mockRuleVersionsSelect.mockResolvedValueOnce({
      data: null,
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
    expect(result?.currentRecord?.workedMinutes).toBe(120);

    // Portal clock-out availability is read from persisted snapshot with zero writes
    expect(result?.portalClockOut?.enabled).toBe(true);
    expect(result?.portalClockOut?.code).toBe("eligible_closing_shift");
    expect(result?.portalClockOut?.label).toBe("Clock out");

    // ABSOLUTE ASSERTION: Entire read chain executed ZERO mutations
    expect(mockInsertSpy).not.toHaveBeenCalled();
    expect(mockUpdateSpy).not.toHaveBeenCalled();
    expect(mockDeleteSpy).not.toHaveBeenCalled();
    expect(mockUpsertSpy).not.toHaveBeenCalled();
    expect(mockRpcSpy).not.toHaveBeenCalled();
  });

  it("11. MISSING branch settings during Staff page render returns valid snapshot and executes ZERO INSERTS", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "auth-staff-no-settings" } } });
    mockStaffSelect.mockResolvedValueOnce({
      data: {
        id: "staff-uuid-brand-new",
        full_name: "Brand New Staff",
        nickname: "Newbie",
        branch_id: "branch-unconfigured",
        staff_type: "therapist",
        system_role: "staff",
      },
      error: null,
    });

    // Missing settings row for this branch in database
    mockAttendanceSettingsSelect.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    mockRuleVersionsSelect.mockResolvedValueOnce({
      data: null,
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

    // Must successfully render page state
    expect(result).not.toBeNull();
    expect(result?.staffId).toBe("staff-uuid-brand-new");
    expect(result?.currentClockState).toBe("not_clocked_in");
    expect(result?.portalClockOut?.code).toBe("no_open_attendance");

    // CRITICAL DEFECT PROOF: Rendering page on a branch with NO settings row MUST NOT INSERT ANY RECORD
    expect(mockInsertSpy).not.toHaveBeenCalled();
    expect(mockUpdateSpy).not.toHaveBeenCalled();
    expect(mockDeleteSpy).not.toHaveBeenCalled();
    expect(mockUpsertSpy).not.toHaveBeenCalled();
    expect(mockRpcSpy).not.toHaveBeenCalled();
  });

  it("12. represents clocked-out state correctly when shift has ended with zero writes", async () => {
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

    mockAttendanceSettingsSelect.mockResolvedValueOnce({
      data: { branch_id: "branch-uuid-1", timezone: "Asia/Manila" },
      error: null,
    });
    mockRuleVersionsSelect.mockResolvedValueOnce({
      data: null,
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

    expect(mockInsertSpy).not.toHaveBeenCalled();
    expect(mockUpdateSpy).not.toHaveBeenCalled();
  });
});
