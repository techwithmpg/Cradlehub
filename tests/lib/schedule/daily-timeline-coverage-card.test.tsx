/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import {
  DailyTimelineCoverageCard,
  buildDailyTimelineCoverageModel,
} from "@/components/features/schedule/tabs/daily-timeline-coverage-card";
import type { DailyTimelineAlert } from "@/components/features/schedule/tabs/daily-timeline-alerts";

afterEach(() => cleanup());

function row(
  staffId: string,
  shiftType: "opening" | "closing" | "single" | "off"
): DailyScheduleStaffRow {
  const isOff = shiftType === "off";
  return {
    staff_id: staffId,
    staff_name: staffId,
    staff_tier: null,
    work_start: isOff ? null : "10:00:00",
    work_end: isOff ? null : "18:00:00",
    current_override: null,
    schedule_source: isOff ? "none" : "individual",
    schedule_is_day_off: isOff,
    schedule_windows: isOff
      ? []
      : [
          {
            shiftType,
            startTime: shiftType === "closing" ? "14:00:00" : "10:00:00",
            endTime: shiftType === "closing" ? "22:30:00" : "18:00:00",
          },
        ],
    bookings: [],
    blocks: [],
  };
}

function conflict(staffId: string): DailyTimelineAlert {
  return {
    id: `${staffId}-conflict`,
    type: "staff_conflict",
    staffId,
    bookingIds: ["booking-1", "booking-2"],
    title: "Staff conflict",
  };
}

describe("DailyTimelineCoverageCard", () => {
  it("excludes off-duty staff from the overall denominator", () => {
    const rows = [
      row("opening-1", "opening"),
      row("closing-1", "closing"),
      row("regular-1", "single"),
      row("off-1", "off"),
      row("off-2", "off"),
    ];

    const model = buildDailyTimelineCoverageModel(rows, [conflict("closing-1")]);

    expect(model.scheduledTotal).toBe(3);
    expect(model.clearScheduled).toBe(2);
    expect(model.overallPercent).toBe(67);
  });

  it("renders scheduled staff count and the Regular shift row only when regular staff exist", () => {
    render(
      <DailyTimelineCoverageCard
        rows={[row("opening-1", "opening"), row("closing-1", "closing")]}
        alerts={[]}
        groupLabel="Therapists"
      />
    );

    expect(screen.getByText("2 / 2 scheduled staff")).toBeTruthy();
    expect(screen.queryByText("Regular shift")).toBeNull();

    cleanup();

    render(
      <DailyTimelineCoverageCard
        rows={[row("opening-1", "opening"), row("regular-1", "single"), row("off-1", "off")]}
        alerts={[]}
        groupLabel="CRM / Front Desk"
      />
    );

    expect(screen.getByText("Regular shift")).toBeTruthy();
    expect(screen.getByText("2 / 2 scheduled staff")).toBeTruthy();
  });
});
