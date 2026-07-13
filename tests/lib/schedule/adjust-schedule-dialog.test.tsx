/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-types";
import { AdjustScheduleDialog } from "@/components/features/schedule-adjustment/adjust-schedule-dialog";
import { updateCrmStaffWeeklyWindowScheduleAction } from "@/lib/actions/crm-schedule-availability";

vi.mock("@/lib/actions/crm-schedule-availability", () => ({
  updateCrmStaffWeeklyWindowScheduleAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function item(staffType: string, systemRole: string | null = "staff"): StaffScheduleItem {
  return {
    staff: {
      id: "staff-1",
      full_name: "Adieva Villahermosa Selda",
      nickname: null,
      avatar_url: null,
      tier: staffType === "therapist" ? "junior" : null,
      staff_type: staffType,
      system_role: systemRole,
      is_head: false,
      is_active: true,
    },
    schedules: [
      {
        id: "schedule-1",
        day_of_week: 1,
        start_time: "10:00:00",
        end_time: "19:00:00",
        is_active: true,
        shift_type: "single",
        window_order: 1,
        ends_next_day: false,
        created_at: "2026-07-10T00:00:00.000Z",
      },
    ],
    overrides: [],
    blockedTimes: [],
  };
}

describe("AdjustScheduleDialog", () => {
  it("opens in Weekly Schedule mode by default and shows therapist shift controls", () => {
    render(
      <AdjustScheduleDialog
        open
        item={item("therapist")}
        branchId="branch-1"
        branchName="Cradle Wellness Living"
        initialDate="2026-07-13"
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog", { name: "Adjust Schedule" })).toBeTruthy();
    expect(screen.getAllByText("Weekly Schedule").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Opening Shift").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Regular Shift").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Closing Shift").length).toBeGreaterThan(0);
  });

  it("limits non-therapist/non-CRM staff to Regular Shift controls", () => {
    render(
      <AdjustScheduleDialog
        open
        item={item("driver")}
        branchId="branch-1"
        branchName="Cradle Wellness Living"
        initialDate="2026-07-13"
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getAllByText("Regular Shift").length).toBeGreaterThan(0);
    expect(screen.queryByText("Opening Shift")).toBeNull();
    expect(screen.queryByText("Closing Shift")).toBeNull();
  });

  it("updates the preview when a split window is added", () => {
    render(
      <AdjustScheduleDialog
        open
        item={item("therapist")}
        branchId="branch-1"
        branchName="Cradle Wellness Living"
        initialDate="2026-07-13"
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    const addMondayButtons = screen.getAllByRole("button", { name: "Add another Monday work window" });
    fireEvent.click(addMondayButtons[0]!);

    expect(screen.getByText("9:00 AM - 6:00 PM")).toBeTruthy();
    expect(screen.getAllByText("18h 00m").length).toBeGreaterThan(0);
  });

  it("surfaces actionable weekly schedule save errors", async () => {
    const message =
      "Schedule saving is temporarily unavailable because the database schedule migration is missing. Apply the schedule update integration migration and try again.";
    vi.mocked(updateCrmStaffWeeklyWindowScheduleAction).mockResolvedValue({
      ok: false,
      code: "MIGRATION_REQUIRED",
      error: message,
      operationId: "schedule-op-1",
    });

    render(
      <AdjustScheduleDialog
        open
        item={item("therapist")}
        branchId="branch-1"
        branchName="Cradle Wellness Living"
        initialDate="2026-07-13"
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    fireEvent.change(screen.getAllByLabelText("Start time for Monday window 1")[0]!, {
      target: { value: "11:00" },
    });
    fireEvent.click(
      screen.getByLabelText("I reviewed booking, attendance, and dispatch impact for this adjustment.")
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Adjustment" }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(updateCrmStaffWeeklyWindowScheduleAction).toHaveBeenCalledOnce();
  });
});
