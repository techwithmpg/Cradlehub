import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getDashboard: vi.fn(),
  getAttendance: vi.fn(),
  fallbackAttendance: vi.fn(),
}));

vi.mock("@/lib/queries/owner-dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queries/owner-dashboard")>();
  return {
    ...actual,
    getOwnerOverviewDashboardData: mocks.getDashboard,
  };
});

vi.mock("@/lib/attendance/recent-scans", () => ({
  getRecentAttendanceScanFeed: mocks.getAttendance,
  createAttendanceScanFeedFallback: mocks.fallbackAttendance,
}));

import { loadOwnerOverviewWorkspaceData } from "@/lib/queries/owner-overview-workspace";
import { OwnerDashboardAccessError } from "@/lib/queries/owner-dashboard";

const dashboard = {
  ownerName: "Owner",
  today: "2026-10-18",
};

const feed = {
  selectedDate: "2026-10-18",
  timezone: "Asia/Manila",
  items: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDashboard.mockResolvedValue(dashboard);
  mocks.getAttendance.mockResolvedValue(feed);
  mocks.fallbackAttendance.mockReturnValue({
    ...feed,
    error: "Attendance activity could not be refreshed.",
  });
});

describe("PERF-9A Owner Overview authoritative loader", () => {
  it("loads the Owner-wide dashboard before its attendance feed and accepts no branch input", async () => {
    const result = await loadOwnerOverviewWorkspaceData();

    expect(mocks.getDashboard).toHaveBeenCalledTimes(1);
    expect(mocks.getDashboard).toHaveBeenCalledWith();
    expect(mocks.getAttendance).toHaveBeenCalledWith({
      workspace: "owner",
      selectedDate: "2026-10-18",
      maxItems: 5,
    });
    expect(result).toEqual({
      data: dashboard,
      attendanceScanFeed: feed,
    });
  });

  it("preserves the existing attendance fallback instead of failing the whole dashboard", async () => {
    mocks.getAttendance.mockRejectedValue(new Error("attendance unavailable"));

    const result = await loadOwnerOverviewWorkspaceData();

    expect(mocks.fallbackAttendance).toHaveBeenCalledWith({
      workspace: "owner",
      selectedDate: "2026-10-18",
      error: "Attendance activity could not be refreshed.",
    });
    expect(result.attendanceScanFeed.error).toBe(
      "Attendance activity could not be refreshed."
    );
  });

  it("propagates Owner access failures before attendance data is requested", async () => {
    mocks.getDashboard.mockRejectedValue(
      new OwnerDashboardAccessError("/login", "Owner access required")
    );

    await expect(loadOwnerOverviewWorkspaceData()).rejects.toBeInstanceOf(
      OwnerDashboardAccessError
    );
    expect(mocks.getAttendance).not.toHaveBeenCalled();
  });
});
