/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import { DailyTimelineSelectionCard } from "@/components/features/schedule/tabs/daily-timeline-selection-card";

afterEach(() => cleanup());

function row(): DailyScheduleStaffRow {
  return {
    staff_id: "staff-1",
    staff_name: "Adieva Villahermosa Selda",
    staff_tier: "junior",
    work_start: "10:00:00",
    work_end: "19:00:00",
    current_override: null,
    schedule_source: "individual",
    schedule_status: "resolved",
    schedule_is_day_off: false,
    schedule_windows: [{ shiftType: "single", startTime: "10:00:00", endTime: "19:00:00" }],
    schedule_conflict_code: null,
    schedule_conflict_reason: null,
    bookings: [],
    blocks: [],
  };
}

describe("DailyTimelineSelectionCard", () => {
  it("keeps the existing staff actions and adds Adjust Schedule", () => {
    const onEditProfile = vi.fn();
    const onEditCapabilities = vi.fn();
    const onViewFullSchedule = vi.fn();
    const onAdjustSchedule = vi.fn();

    render(
      <DailyTimelineSelectionCard
        staff={row()}
        booking={null}
        staffType="therapist"
        date="2026-07-13"
        now={new Date("2026-07-13T04:00:00.000Z")}
        onEditProfile={onEditProfile}
        onEditCapabilities={onEditCapabilities}
        onViewFullSchedule={onViewFullSchedule}
        onAdjustSchedule={onAdjustSchedule}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Edit Profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /Edit Capabilities/i }));
    fireEvent.click(screen.getByRole("button", { name: /View Full Schedule/i }));
    fireEvent.click(screen.getByRole("button", { name: /Adjust Schedule/i }));

    expect(onEditProfile).toHaveBeenCalledTimes(1);
    expect(onEditCapabilities).toHaveBeenCalledTimes(1);
    expect(onViewFullSchedule).toHaveBeenCalledTimes(1);
    expect(onAdjustSchedule).toHaveBeenCalledTimes(1);
  });

  it("renders disabled actions when no staff is selected", () => {
    render(
      <DailyTimelineSelectionCard
        staff={null}
        booking={null}
        staffType={null}
        date="2026-07-13"
        now={null}
        onEditProfile={vi.fn()}
        onEditCapabilities={vi.fn()}
        onViewFullSchedule={vi.fn()}
        onAdjustSchedule={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /Adjust Schedule/i })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /View Full Schedule/i })).toHaveProperty("disabled", true);
  });
});
