/** @vitest-environment jsdom */

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { OwnerOverviewWorkspacePayload } from "@/components/features/owner/dashboard/owner-overview-workspace-data";
import type { OwnerOverviewDashboardData } from "@/lib/queries/owner-dashboard";
import type { AttendanceScanFeedData } from "@/lib/attendance/types";

const revalidate = vi.fn();

vi.mock("@/components/features/owner/dashboard/use-live-owner-overview-data", () => ({
  useLiveOwnerOverviewData: (fallback: OwnerOverviewWorkspacePayload) => ({
    data: fallback,
    error: new Error("refresh failed"),
    revalidate,
    generation: {
      isRefreshing: false,
      store: null,
    },
  }),
}));

vi.mock("@/components/features/owner/dashboard/owner-dashboard", () => ({
  OwnerDashboard: ({
    data,
    attendanceScanFeed,
  }: {
    data: OwnerOverviewDashboardData;
    attendanceScanFeed: AttendanceScanFeedData;
  }) => (
    <div>
      <span>Owner: {data.ownerName}</span>
      <span>Feed date: {attendanceScanFeed.selectedDate}</span>
    </div>
  ),
}));

import { OwnerOverviewRetainedWorkspace } from "@/components/features/owner/dashboard/owner-overview-retained-workspace";

const payload = {
  data: {
    ownerName: "Validated Owner",
    today: "2026-10-18",
  } as OwnerOverviewDashboardData,
  attendanceScanFeed: {
    selectedDate: "2026-10-18",
  } as AttendanceScanFeedData,
} satisfies OwnerOverviewWorkspacePayload;

beforeEach(() => {
  vi.clearAllMocks();
  revalidate.mockResolvedValue("validated");
});

afterEach(() => {
  cleanup();
});

describe("PERF-9A Owner Overview retained wrapper", () => {
  it("keeps the last validated payload visible when refresh fails", () => {
    render(
      <OwnerOverviewRetainedWorkspace initialPayload={payload} />
    );

    expect(screen.getByText("Owner: Validated Owner")).toBeTruthy();
    expect(screen.getByText("Feed date: 2026-10-18")).toBeTruthy();
    expect(
      screen.getByText(
        /last validated dashboard snapshot is still displayed/i
      )
    ).toBeTruthy();
  });

  it("uses canonical revalidation for Retry", async () => {
    render(
      <OwnerOverviewRetainedWorkspace initialPayload={payload} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(revalidate).toHaveBeenCalledTimes(1));
  });
});
