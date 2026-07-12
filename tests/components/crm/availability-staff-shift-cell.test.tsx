/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffShiftCell } from "@/components/features/crm/availability/crm-availability-client";
import type { CrmAvailabilityStaffRow } from "@/lib/queries/crm-availability";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(() => cleanup());

function makeStaffRow(
  shifts: CrmAvailabilityStaffRow["shifts"]
): CrmAvailabilityStaffRow {
  return {
    staff_id: "staff-1",
    staff_name: "Ava Santos",
    staff_type: "therapist",
    system_role: "staff",
    is_driver: false,
    is_service_provider: true,
    scheduleStatus: shifts.length > 0 ? "scheduled" : "no_schedule",
    liveStatus: shifts.length > 0 ? "available_now" : "no_schedule",
    presenceStatus: shifts.length > 0 ? "checked_in" : "no_schedule",
    checkedInAt: null,
    checkedOutAt: null,
    checkInId: null,
    work_start: shifts[0]?.start_time ?? null,
    work_end: shifts.at(-1)?.end_time ?? null,
    scheduleSource: shifts.length > 0 ? "individual" : "none",
    scheduleConflictCode: null,
    scheduleConflictReason: null,
    shifts,
    active_booking: null,
    blocks: [],
    needsAttention: shifts.length === 0,
  };
}

describe("StaffShiftCell", () => {
  it("renders every resolved shift window for Live Staff", () => {
    render(
      <StaffShiftCell
        staff={makeStaffRow([
          { shift_type: "opening", start_time: "10:00", end_time: "17:30" },
          { shift_type: "closing", start_time: "14:00", end_time: "22:30" },
        ])}
      />
    );

    expect(screen.getByText("2 shifts")).toBeTruthy();
    expect(screen.getByText("10:00 AM – 5:30 PM")).toBeTruthy();
    expect(screen.getByText("2:00 PM – 10:30 PM")).toBeTruthy();
  });

  it("shows an empty marker when no schedule window resolves", () => {
    render(<StaffShiftCell staff={makeStaffRow([])} />);

    expect(screen.getByText("—")).toBeTruthy();
  });
});
