// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StaffSafeMemoryProvider } from "@/components/features/staff-pwa/safe-memory";
import { UtilityWorkList } from "@/components/features/staff-pwa/utility/utility-work-list";
import { UtilityRoomDetail } from "@/components/features/staff-pwa/utility/utility-room-detail";
import type {
  UtilityRoomTurnoverItem,
  UtilityWorkspaceRuntime,
} from "@/lib/staff-pwa/utility-runtime";

const refresh = vi.fn();
const startCleaning = vi.fn();
const markReady = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/(dashboard)/staff/utility/actions", () => ({
  startRoomCleaningAction: (...args: unknown[]) => startCleaning(...args),
  markRoomReadyAction: (...args: unknown[]) => markReady(...args),
}));

const openItem: UtilityRoomTurnoverItem = {
  taskId: "task-open",
  resourceId: "room-1",
  roomName: "Treatment Room 1",
  resourceType: "room",
  serviceName: "Completed service",
  status: "open",
  completedAt: null,
  startedAt: null,
  createdAt: "2026-10-12T08:00:00Z",
  assignedToStaffId: null,
  customerName: null,
};

const readyItem: UtilityRoomTurnoverItem = {
  ...openItem,
  taskId: "task-ready",
  roomName: "Treatment Room 2",
  status: "completed",
  completedAt: "2026-10-12T10:00:00Z",
};

const runtime: UtilityWorkspaceRuntime = {
  staff: {
    id: "utility-a",
    full_name: "Utility Staff",
    nickname: null,
    avatar_url: null,
    branch_id: "branch-a",
    system_role: "utility",
    staff_type: "utility",
  },
  attendanceData: null,
  turnoverItems: [openItem],
  recentCompletedItems: [readyItem],
  queueError: null,
  historyError: null,
};

describe("Utility native task surfaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startCleaning.mockResolvedValue({ ok: true, status: "in_progress" });
    markReady.mockResolvedValue({ ok: true, status: "completed" });
  });
  afterEach(cleanup);

  it("filters real turnover statuses and retains the filter only within the mounted identity", () => {
    const view = render(
      <StaffSafeMemoryProvider identity="user-a:utility-a:branch-a">
        <UtilityWorkList runtime={runtime} />
      </StaffSafeMemoryProvider>
    );
    expect(screen.getByText("Treatment Room 1")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Ready" }));
    expect(screen.queryByText("Treatment Room 1")).toBeNull();
    expect(screen.getByText("Treatment Room 2")).toBeDefined();

    view.rerender(
      <StaffSafeMemoryProvider identity="user-a:utility-a:branch-a">
        <div>Other screen</div>
      </StaffSafeMemoryProvider>
    );
    view.rerender(
      <StaffSafeMemoryProvider identity="user-a:utility-a:branch-a">
        <UtilityWorkList runtime={runtime} />
      </StaffSafeMemoryProvider>
    );
    expect(screen.queryByText("Treatment Room 1")).toBeNull();
    expect(screen.getByRole("button", { name: "Ready" }).getAttribute("aria-pressed")).toBe("true");

    view.rerender(
      <StaffSafeMemoryProvider identity="user-b:utility-b:branch-b">
        <UtilityWorkList runtime={runtime} />
      </StaffSafeMemoryProvider>
    );
    expect(screen.getByText("Treatment Room 1")).toBeDefined();
  });

  it("requires explicit confirmation before the existing server action marks a room ready", async () => {
    render(<UtilityRoomDetail item={openItem} staffId="utility-a" />);
    fireEvent.click(screen.getByRole("button", { name: "Start cleaning" }));
    await waitFor(() => expect(startCleaning).toHaveBeenCalledWith("task-open"));
    await screen.findByText("Cleaning started.");
    fireEvent.click(screen.getByRole("button", { name: "Mark room ready" }));
    expect(markReady).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm ready" }));
    await waitFor(() => expect(markReady).toHaveBeenCalledWith("task-open"));
    await screen.findByText("Room ready");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the current active state when a room also has an older completed turnover", () => {
    render(
      <StaffSafeMemoryProvider identity="user-a:utility-a:branch-a">
        <UtilityWorkList runtime={runtime} mode="rooms" />
      </StaffSafeMemoryProvider>
    );
    expect(screen.getByText("Treatment Room 1")).toBeDefined();
    expect(screen.queryByText("Treatment Room 2")).toBeNull();
  });

  it("does not offer a ready action for a room claimed by another staff member", () => {
    render(
      <UtilityRoomDetail
        item={{ ...openItem, status: "in_progress", assignedToStaffId: "utility-b" }}
        staffId="utility-a"
      />
    );
    expect(
      screen.getByText("This room is being cleaned by another Utility team member.")
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Mark room ready" })).toBeNull();
  });
});
