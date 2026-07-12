/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import {
  DailyTimelineCoverageCard,
  buildDailyTimelineCoverageModel,
} from "@/components/features/schedule/tabs/daily-timeline-coverage-card";
import type { LiveScheduleConflict } from "@/lib/schedule/live-schedule-conflict-types";

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
    schedule_status: isOff ? "day_off" : "resolved",
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
    schedule_conflict_code: null,
    schedule_conflict_reason: null,
    bookings: [],
    blocks: [],
  };
}

function conflict(staffId: string): LiveScheduleConflict {
  return {
    id: `${staffId}-conflict`,
    type: "staff_overlap",
    severity: "critical",
    title: "Staff double-booked",
    plain_language_message: "Staff has overlapping bookings.",
    affected_staff_ids: [staffId],
    affected_staff_names: [staffId],
    affected_booking_ids: ["booking-1", "booking-2"],
    affected_booking_labels: ["Massage - 10:00 AM - 11:00 AM"],
    affected_resource_id: null,
    affected_resource_name: null,
    date: "2026-07-09",
    start_time: "10:00:00",
    end_time: "11:00:00",
    broken_rule: "One staff member cannot serve two overlapping bookings.",
    why_it_matters: "One customer may wait.",
    recommended_fix: "Move one booking.",
    quick_actions: [],
    debug_metadata: {},
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
        conflicts={[]}
        groupLabel="Therapists"
      />
    );

    expect(screen.getByText("2 / 2 scheduled staff")).toBeTruthy();
    expect(screen.queryByText("Regular shift")).toBeNull();

    cleanup();

    render(
      <DailyTimelineCoverageCard
        rows={[row("opening-1", "opening"), row("regular-1", "single"), row("off-1", "off")]}
        conflicts={[]}
        groupLabel="CRM / Front Desk"
      />
    );

    expect(screen.getByText("Regular shift")).toBeTruthy();
    expect(screen.getByText("2 / 2 scheduled staff")).toBeTruthy();
  });

  it("uses Coverage Overview as the single conflict entry point", () => {
    const onViewConflictDetails = vi.fn();

    render(
      <DailyTimelineCoverageCard
        rows={[row("opening-1", "opening")]}
        conflicts={[conflict("opening-1")]}
        groupLabel="Therapists"
        onViewConflictDetails={onViewConflictDetails}
      />
    );

    expect(screen.getByText("Schedule issues")).toBeTruthy();
    expect(screen.getByText("1 critical")).toBeTruthy();
    expect(screen.getByText("Review before confirming the day")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Schedule issues/i }));
    expect(onViewConflictDetails).toHaveBeenCalledTimes(1);

    cleanup();

    render(
      <DailyTimelineCoverageCard
        rows={[row("opening-1", "opening")]}
        conflicts={[]}
        groupLabel="Therapists"
      />
    );

    expect(screen.getByText("All clear")).toBeTruthy();
    expect(screen.getByText("No schedule issues found")).toBeTruthy();
    expect(screen.queryByText("Conflict Details")).toBeNull();
  });
});
