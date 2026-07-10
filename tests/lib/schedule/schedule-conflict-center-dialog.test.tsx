/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScheduleConflictCenterDialog } from "@/components/features/schedule/tabs/schedule-conflict-center-dialog";
import type {
  LiveScheduleConflict,
  LiveScheduleConflictType,
} from "@/lib/schedule/live-schedule-conflict-types";

afterEach(() => cleanup());

function conflict(
  id: string,
  type: LiveScheduleConflictType,
  severity: LiveScheduleConflict["severity"] = "warning"
): LiveScheduleConflict {
  return {
    id,
    type,
    severity,
    title: `${type} title`,
    plain_language_message: `${type} needs attention.`,
    affected_staff_ids: ["staff-1"],
    affected_staff_names: ["Frannie"],
    affected_booking_ids: [id],
    affected_booking_labels: [`Swedish Massage - ${id}`],
    affected_resource_id: type.includes("room") ? "room-1" : null,
    affected_resource_name: type.includes("room") ? "Room 1" : null,
    date: "2026-07-09",
    start_time: "10:00:00",
    end_time: "11:00:00",
    broken_rule: "The schedule rule was broken.",
    why_it_matters: "The front desk may confirm work that cannot happen.",
    recommended_fix: "Review and adjust the booking.",
    quick_actions: [{ label: "View booking", intent: "view_booking", staffId: "staff-1", bookingId: id }],
    debug_metadata: {},
  };
}

describe("ScheduleConflictCenterDialog", () => {
  it("groups conflicts into tabs and filters issue cards by category", () => {
    render(
      <ScheduleConflictCenterDialog
        open
        conflicts={[
          conflict("booking-1", "staff_overlap", "critical"),
          conflict("booking-2", "room_double_booked"),
          conflict("coverage-1", "coverage_gap"),
        ]}
        branchName="Main Branch"
        date="2026-07-09"
        onOpenChange={vi.fn()}
        onAction={vi.fn()}
      />
    );

    expect(screen.getByText("Schedule Conflict Center")).toBeTruthy();
    expect(screen.getByText("Main Branch · Thursday, Jul 09")).toBeTruthy();
    expect(screen.getByText("Staff already booked")).toBeTruthy();
    expect(screen.getByText("Room double booked")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /Rooms 1/i }));

    expect(screen.getByText("Room double booked")).toBeTruthy();
    expect(screen.queryByText("Staff already booked")).toBeNull();
  });

  it("accepts approval-level exceptions with a reason and moves them into the accepted tab", () => {
    const onAction = vi.fn();
    render(
      <ScheduleConflictCenterDialog
        open
        conflicts={[conflict("booking-1", "booking_outside_shift")]}
        branchName="Main Branch"
        date="2026-07-09"
        onOpenChange={vi.fn()}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Accept exception" }));
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Manager approved this booking exception." },
    });
    fireEvent.change(screen.getByLabelText("Scope"), {
      target: { value: "this_booking_only" },
    });

    const acceptButtons = screen.getAllByRole("button", { name: "Accept exception" });
    const submitAcceptButton = acceptButtons[acceptButtons.length - 1];
    if (!submitAcceptButton) throw new Error("Accept exception submit button was not rendered.");

    fireEvent.click(submitAcceptButton);

    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: /Accepted 1/i }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getAllByText("Accepted Exception").length).toBeGreaterThan(0);
    expect(screen.getByText("Accepted: this booking only")).toBeTruthy();
  });

  it("shows an all-clear empty state when opened without conflicts", () => {
    render(
      <ScheduleConflictCenterDialog
        open
        conflicts={[]}
        branchName="Main Branch"
        date="2026-07-09"
        onOpenChange={vi.fn()}
        onAction={vi.fn()}
      />
    );

    expect(screen.getByText("All clear for this schedule window.")).toBeTruthy();
    expect(screen.getByText("No conflicts were found for the selected branch and date.")).toBeTruthy();
  });
});
