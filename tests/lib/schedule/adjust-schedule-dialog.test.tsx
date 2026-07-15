/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function openCloseItem(staffType = "csr", systemRole: string | null = "crm"): StaffScheduleItem {
  const workingDays = new Set([3, 4, 5, 6]);
  return {
    ...item(staffType, systemRole),
    schedules: Array.from({ length: 7 }, (_, dayOfWeek) =>
      workingDays.has(dayOfWeek)
        ? [
            {
              id: `opening-${dayOfWeek}`,
              day_of_week: dayOfWeek,
              start_time: "10:00:00",
              end_time: "19:30:00",
              is_active: true,
              shift_type: "opening",
              window_order: 1,
              ends_next_day: false,
            },
            {
              id: `closing-${dayOfWeek}`,
              day_of_week: dayOfWeek,
              start_time: "17:00:00",
              end_time: "01:30:00",
              is_active: true,
              shift_type: "closing",
              window_order: 2,
              ends_next_day: true,
            },
          ]
        : []
    ).flat(),
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

    const addMondayButtons = screen.getAllByRole("button", {
      name: "Add another Monday work window",
    });
    fireEvent.click(addMondayButtons[0]!);

    expect(screen.getByText("9:00 AM - 6:00 PM")).toBeTruthy();
    expect(screen.getAllByText("10h 00m").length).toBeGreaterThan(0);
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
      screen.getByLabelText(
        "I reviewed booking, attendance, and dispatch impact for this adjustment."
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Adjustment" }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(updateCrmStaffWeeklyWindowScheduleAction).toHaveBeenCalledOnce();
  });

  it("offers and applies the CRM Open-Close repair before saving adjacent windows", async () => {
    vi.mocked(updateCrmStaffWeeklyWindowScheduleAction).mockResolvedValue({
      ok: true,
      rowsWritten: 8,
      savedRows: [],
    });

    render(
      <AdjustScheduleDialog
        open
        item={openCloseItem()}
        branchId="branch-1"
        branchName="Cradle Wellness Living"
        initialDate="2026-07-15"
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByText("Opening and closing coverage overlap")).toBeTruthy();
    expect(screen.getAllByText("62h 00m").length).toBeGreaterThan(0);
    expect(screen.getByText(/Existing bookings are never changed/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Fix automatically" }));

    expect(await screen.findByText("Open–Close schedule corrected")).toBeTruthy();
    expect(screen.getAllByText("10:00 AM - 5:00 PM").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5:00 PM - 1:30 AM · next day").length).toBeGreaterThan(0);
    expect(screen.getAllByText("62h 00m").length).toBeGreaterThan(0);
    expect(
      (screen.getAllByLabelText("End time for Wednesday window 1")[0] as HTMLInputElement).value
    ).toBe("17:00");
    expect(
      (screen.getAllByLabelText("Start time for Wednesday window 2")[0] as HTMLInputElement).value
    ).toBe("17:00");
    expect(
      (screen.getAllByLabelText("End time for Wednesday window 2")[0] as HTMLInputElement).value
    ).toBe("01:30");

    fireEvent.click(
      screen.getByLabelText(
        "I reviewed booking, attendance, and dispatch impact for this adjustment."
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Adjustment" }));

    await waitFor(() => expect(updateCrmStaffWeeklyWindowScheduleAction).toHaveBeenCalledOnce());
    const saved = vi.mocked(updateCrmStaffWeeklyWindowScheduleAction).mock.calls[0]?.[0] as {
      days: Array<{ dayOfWeek: number; windows: Array<Record<string, unknown>> }>;
    };
    expect(saved.days.find((day) => day.dayOfWeek === 3)?.windows).toEqual([
      expect.objectContaining({
        shiftKind: "opening",
        startTime: "10:00",
        endTime: "17:00",
        endsNextDay: false,
      }),
      expect.objectContaining({
        shiftKind: "closing",
        startTime: "17:00",
        endTime: "01:30",
        endsNextDay: true,
      }),
    ]);
  });

  it("does not offer the CRM repair to therapists", () => {
    render(
      <AdjustScheduleDialog
        open
        item={openCloseItem("therapist", "staff")}
        branchId="branch-1"
        branchName="Cradle Wellness Living"
        initialDate="2026-07-15"
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.queryByText("Opening and closing coverage overlap")).toBeNull();
    expect(screen.getByText(/Window 2 overlaps Window 1 on Wednesday/)).toBeTruthy();
  });
});
