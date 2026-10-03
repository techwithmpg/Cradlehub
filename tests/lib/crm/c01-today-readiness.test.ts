import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCrmSetupHealth: vi.fn(),
  getCrmTodaySnapshot: vi.fn(),
  getDailySchedule: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/queries/crm-setup", () => ({
  getCrmSetupHealth: mocks.getCrmSetupHealth,
}));
vi.mock("@/lib/queries/crm-today", () => ({
  getCrmTodaySnapshot: mocks.getCrmTodaySnapshot,
}));
vi.mock("@/lib/queries/schedule", () => ({
  getDailySchedule: mocks.getDailySchedule,
}));
vi.mock("@/lib/config/mvp-flags", () => ({
  isAttendanceEnforcementEnabled: () => false,
}));
vi.mock("@/lib/engine/slot-time", () => ({
  getBranchBusinessDate: () => "2026-10-03",
}));

import {
  getCrmReadiness,
  getCrmReadinessIssues,
  getCrmReadinessCached,
} from "@/lib/queries/crm-readiness";

describe("C-01: Today Readiness Checks Engine", () => {
  const branchId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();

    // Default healthy mock responses
    mocks.getCrmSetupHealth.mockResolvedValue({
      serviceStaffTotal: 3,
      serviceStaffWithSchedule: 3,
      activeServicesTotal: 5,
      servicesWithStaff: 5,
      activeResourcesTotal: 2,
      hasCustomRules: true,
      homeServiceEnabled: false,
      driversTotal: 0,
      unassignedTodayCount: 0,
      issues: [],
    });

    mocks.getCrmTodaySnapshot.mockResolvedValue({
      date: "2026-10-03",
      branchId,
      bookingSummary: {
        total: 5,
        pending: 0,
        confirmed: 5,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
        no_show: 0,
        unassigned: 0,
      },
      staffReadiness: {
        total: 3,
        scheduledToday: 3,
        checkedIn: 3,
        notCheckedIn: 0,
        availableNow: 3,
        busyNow: 0,
        checkedOut: 0,
        offToday: 0,
        noSchedule: 0,
        scheduleConflicts: 0,
        driversReady: 0,
        driversTotal: 0,
        needsAttention: 0,
        serviceStaffNoSchedule: 0,
        pendingOnlineBookings: 0,
      },
      dispatchStats: {
        totalToday: 0,
        awaitingDispatch: 0,
        activeTrips: 0,
        completedToday: 0,
        cancelledToday: 0,
      },
      payment: null,
    });

    mocks.getDailySchedule.mockResolvedValue([
      {
        staff_id: "staff-1",
        staff_name: "Staff One",
        schedule_status: "resolved",
        schedule_windows: [{ shiftType: "opening" }],
      },
    ]);

    const fakeQuery = {
      select: () => fakeQuery,
      eq: () => fakeQuery,
      or: () => fakeQuery,
      not: () => fakeQuery,
      neq: () => fakeQuery,
      gte: () => fakeQuery,
      lte: () => fakeQuery,
      limit: async () => ({ data: [], error: null }),
    };

    mocks.createClient.mockResolvedValue({
      from: () => fakeQuery,
    });
  });

  it("resolves operational snapshot, setup health, and daily operations without generic failure warnings", async () => {
    const result = await getCrmReadiness(branchId);

    expect(mocks.getCrmSetupHealth).toHaveBeenCalledWith(branchId);
    expect(mocks.getCrmTodaySnapshot).toHaveBeenCalledWith({
      branchId,
      date: "2026-10-03",
    });

    // None of the three generic source failure issues should be present
    const sourceFailureTitles = [
      "Setup readiness could not be checked",
      "Daily operational readiness could not be checked",
      "Daily operations checks could not be completed",
    ];

    for (const title of sourceFailureTitles) {
      const match = result.issues.find((issue) => issue.title === title);
      expect(match).toBeUndefined();
    }

    expect(result.status).toBe("ok");
  });

  it("surfaces truthful setup issues when configuration is legitimately missing", async () => {
    mocks.getCrmSetupHealth.mockResolvedValueOnce({
      serviceStaffTotal: 0,
      serviceStaffWithSchedule: 0,
      activeServicesTotal: 5,
      servicesWithStaff: 0,
      activeResourcesTotal: 0,
      hasCustomRules: false,
      homeServiceEnabled: false,
      driversTotal: 0,
      unassignedTodayCount: 0,
      issues: [
        {
          id: "no-schedule",
          category: "staff",
          severity: "error",
          title: "Service staff have no schedule",
          detail: "Branch has service staff configured without schedule.",
          impact: "Cannot book appointments.",
          fixLabel: "Open Schedule",
          fixHref: "/crm/schedule",
        },
      ],
    });

    const issues = await getCrmReadinessIssues(branchId);
    const staffIssue = issues.find((i) => i.id === "setup:no-schedule");
    expect(staffIssue).toBeDefined();
    expect(staffIssue?.title).toBe("Service staff have no schedule");
    expect(staffIssue?.severity).toBe("critical");

    // Must NOT surface the generic check failure
    expect(issues.find((i) => i.title === "Setup readiness could not be checked")).toBeUndefined();
  });

  it("treats a successful empty daily schedule as valid data", async () => {
    mocks.getDailySchedule.mockResolvedValueOnce([]);

    const issues = await getCrmReadinessIssues(branchId);

    expect(issues.find((issue) => issue.id === "system:failure:daily-schedule")).toBeUndefined();
  });

  it("reports an unavailable schedule without running schedule-dependent checks", async () => {
    mocks.getDailySchedule.mockRejectedValueOnce(new Error("Database connection timeout"));
    const from = vi.fn(() => {
      const q = {
        select: () => q,
        eq: () => q,
        or: () => q,
        not: () => q,
        neq: () => q,
        gte: () => q,
        lte: () => q,
        limit: async () => ({ data: [], error: null }),
      };
      return q;
    });
    mocks.createClient.mockResolvedValue({ from });

    const issues = await getCrmReadinessIssues(branchId);

    expect(issues.find((i) => i.id === "system:failure:daily-schedule")).toBeDefined();
    expect(issues.find((i) => i.id === "daily:checked-in-not-scheduled")).toBeUndefined();
    expect(issues.find((i) => i.id === "daily:no-opening-shift-today")).toBeUndefined();
    expect(from).not.toHaveBeenCalledWith("staff_shift_checkins");
    expect(from).toHaveBeenCalledWith("bookings");
  });

  it("evaluates readiness and returns structured ReadinessResult", async () => {
    const result = await getCrmReadinessCached(branchId);

    expect(result).toBeDefined();
    expect(result.status).toBe("ok");
    expect(Array.isArray(result.issues)).toBe(true);
    expect(mocks.getCrmSetupHealth).toHaveBeenCalledWith(branchId);
    expect(mocks.getCrmTodaySnapshot).toHaveBeenCalledWith({ branchId, date: "2026-10-03" });
  });
});
