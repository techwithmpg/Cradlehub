import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFrontDeskContext: vi.fn(),
  getFrontDeskDutyContext: vi.fn(),
  getTodaysSchedule: vi.fn(),
  getCrmPendingBookingQueue: vi.fn(),
  getCrmUpcomingBookings: vi.fn(),
  getCrmTodaySnapshot: vi.fn(),
  getActionRequiredNotificationsAction: vi.fn(),
  getCrmReadinessCached: vi.fn(),
  getBranchBookingDriverIds: vi.fn(),
  getLatestLocationsForActiveHomeServiceTrips: vi.fn(),
  getRecentAttendanceScanFeed: vi.fn(),
  getActiveTrackingTokensForBookings: vi.fn(),
  getDriverNamesByIds: vi.fn(),
}));

vi.mock("@/lib/queries/bookings", () => ({
  getTodaysSchedule: mocks.getTodaysSchedule,
  getCrmPendingBookingQueue: mocks.getCrmPendingBookingQueue,
  getCrmUpcomingBookings: mocks.getCrmUpcomingBookings,
}));
vi.mock("@/lib/notifications/queries", () => ({
  getActionRequiredNotificationsAction: mocks.getActionRequiredNotificationsAction,
}));
vi.mock("@/lib/queries/crm-today", () => ({ getCrmTodaySnapshot: mocks.getCrmTodaySnapshot }));
vi.mock("@/lib/queries/crm-readiness", () => ({
  getCrmReadinessCached: mocks.getCrmReadinessCached,
}));
vi.mock("@/lib/queries/crm-context", () => ({ getFrontDeskContext: mocks.getFrontDeskContext }));
vi.mock("@/lib/queries/front-desk-duty", () => ({
  getFrontDeskDutyContext: mocks.getFrontDeskDutyContext,
}));
vi.mock("@/lib/actions/driver-actions", () => ({
  getBranchBookingDriverIds: mocks.getBranchBookingDriverIds,
  getDriverNamesByIds: mocks.getDriverNamesByIds,
}));
vi.mock("@/lib/actions/location-actions", () => ({
  getLatestLocationsForActiveHomeServiceTrips: mocks.getLatestLocationsForActiveHomeServiceTrips,
}));
vi.mock("@/lib/actions/tracking-link-actions", () => ({
  getActiveTrackingTokensForBookings: mocks.getActiveTrackingTokensForBookings,
}));
vi.mock("@/lib/attendance/recent-scans", () => ({
  getRecentAttendanceScanFeed: mocks.getRecentAttendanceScanFeed,
  createAttendanceScanFeedFallback: vi.fn(),
}));
vi.mock("@/lib/engine/slot-time", () => ({
  getBranchBusinessDate: () => "2026-10-15",
}));
vi.mock("@/lib/bookings/upcoming-bookings", () => ({
  upcomingBookingEndDate: () => "2026-10-22",
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/bookings/ops-warnings", () => ({ parseLiveEta: vi.fn() }));
vi.mock("@/lib/bookings/staff-schedule-exception", () => ({
  getOpenStaffScheduleException: vi.fn(),
}));
vi.mock("@/lib/staff/display-name", () => ({ getStaffAdminName: vi.fn() }));
vi.mock("@/types/readiness", () => ({ buildReadinessResult: vi.fn() }));
vi.mock("@/constants/staff", () => ({
  SYSTEM_ROLE_LABELS: { crm: "Front Desk" },
  canonicalizeSystemRole: () => "crm",
}));
vi.mock("@/app/(dashboard)/manager/bookings/actions", () => ({
  updateBookingPaymentAction: vi.fn(),
}));
vi.mock("@/app/(dashboard)/crm/today/actions", () => ({
  updateWorkQueueBookingStatusAction: vi.fn(),
}));
vi.mock("@/components/features/crm/today/crm-today-shell", () => ({ CrmTodayShell: vi.fn() }));
vi.mock("@/components/features/dashboard/retained-workspace-provider", () => ({
  RetainedWorkspaceModule: vi.fn(),
}));

import CrmTodayPage from "@/app/(dashboard)/crm/today/page";

describe("CRM Today request scheduling", () => {
  it("starts the schedule read while Front Desk duty is still pending", async () => {
    let resolveDuty!: (value: null) => void;
    const dutyPending = new Promise<null>((resolve) => {
      resolveDuty = resolve;
    });
    mocks.getFrontDeskContext.mockResolvedValue({
      branchId: "branch-a",
      branchName: "Main",
      role: "crm",
    });
    mocks.getFrontDeskDutyContext.mockReturnValue(dutyPending);
    mocks.getTodaysSchedule.mockResolvedValue([]);
    mocks.getCrmPendingBookingQueue.mockResolvedValue([]);
    mocks.getCrmUpcomingBookings.mockResolvedValue([]);
    mocks.getCrmTodaySnapshot.mockResolvedValue({});
    mocks.getActionRequiredNotificationsAction.mockResolvedValue([]);
    mocks.getCrmReadinessCached.mockResolvedValue({ issues: [], status: "ok" });
    mocks.getBranchBookingDriverIds.mockResolvedValue({});
    mocks.getLatestLocationsForActiveHomeServiceTrips.mockResolvedValue({});
    mocks.getRecentAttendanceScanFeed.mockResolvedValue({ branchId: "branch-a", items: [] });
    mocks.getActiveTrackingTokensForBookings.mockResolvedValue({});
    mocks.getDriverNamesByIds.mockResolvedValue({});

    const page = CrmTodayPage({ searchParams: Promise.resolve({}) });
    await vi.waitFor(() => expect(mocks.getFrontDeskDutyContext).toHaveBeenCalledOnce());
    expect(mocks.getTodaysSchedule).toHaveBeenCalledWith("branch-a", "2026-10-15");

    resolveDuty(null);
    await expect(page).resolves.toBeDefined();
  });
});
