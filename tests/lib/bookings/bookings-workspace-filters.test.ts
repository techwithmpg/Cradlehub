import { describe, expect, it } from "vitest";
import { applyBookingListFilters } from "@/lib/bookings/booking-list-exact-filters";
import {
  bookingMatchesQuickFilter,
  resolveBookingQuickFilter,
} from "@/lib/bookings/bookings-workspace-filters";
import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";

function booking(
  overrides: Partial<WorkspaceBookingRow> = {}
): WorkspaceBookingRow {
  return {
    id: "booking-1",
    booking_date: "2026-07-14",
    start_time: "10:00:00",
    end_time: "11:00:00",
    type: "online",
    delivery_type: "in_spa",
    status: "confirmed",
    booking_progress_status: "not_started",
    payment_method: "pay_on_site",
    payment_status: "paid",
    amount_paid: 800,
    resource_id: "room-1",
    staff: { id: "staff-1", full_name: "Andrea Guinanao" },
    ...overrides,
  };
}

describe("booking workspace quick filters", () => {
  it("maps legacy tab values without losing their closest meaning", () => {
    expect(resolveBookingQuickFilter("needs-action")).toEqual({
      quickFilter: "needs-attention",
    });
    expect(resolveBookingQuickFilter("active")).toEqual({
      quickFilter: "active-now",
    });
    expect(resolveBookingQuickFilter("upcoming")).toEqual({
      quickFilter: "all",
    });
    expect(resolveBookingQuickFilter("completed")).toEqual({
      quickFilter: "all",
      legacyStatusFilter: "completed",
    });
    expect(resolveBookingQuickFilter(null)).toEqual({ quickFilter: "all" });
  });

  it("keeps All bookings inclusive and limits Active now to operational progress", () => {
    const rows = [
      booking({ id: "pending", status: "pending" }),
      booking({ id: "checked", booking_progress_status: "checked_in" }),
      booking({ id: "travel", booking_progress_status: "travel_started" }),
      booking({ id: "arrived", booking_progress_status: "arrived" }),
      booking({ id: "session", status: "in_progress", booking_progress_status: "session_started" }),
      booking({ id: "done", status: "completed", booking_progress_status: "completed" }),
    ];

    expect(rows.filter((row) => bookingMatchesQuickFilter(row, "all"))).toHaveLength(6);
    expect(rows.filter((row) => bookingMatchesQuickFilter(row, "active-now")).map((row) => row.id)).toEqual([
      "checked",
      "travel",
      "arrived",
      "session",
    ]);
  });

  it("recognizes only real actionable signals as Needs attention", () => {
    const rows = [
      booking({ id: "pending", status: "pending" }),
      booking({ id: "payment", payment_status: "pending", amount_paid: 0 }),
      booking({
        id: "followup",
        metadata: { crm_followup: { result: "no_answer" } },
      }),
      booking({ id: "room", resource_id: null }),
      booking({
        id: "staff-warning",
        metadata: {
          staff_schedule_exception: {
            version: 1,
            status: "open",
            reason_code: "selected_staff_booking_overlap",
            reason_label: "Selected staff booking overlap",
            selected_staff_id: "staff-1",
            selected_staff_name: "Andrea Guinanao",
            customer_name: "Malcom Patem",
            branch_id: "branch-1",
            booking_date: "2026-07-14",
            start_time: "10:00:00",
            end_time: "11:00:00",
            created_at: "2026-07-13T09:00:00.000Z",
          },
        },
      }),
      booking({ id: "healthy" }),
      booking({ id: "closed", status: "completed", payment_status: "pending", resource_id: null }),
    ];

    expect(
      rows.filter((row) => bookingMatchesQuickFilter(row, "needs-attention")).map((row) => row.id)
    ).toEqual(["pending", "payment", "followup", "room", "staff-warning"]);
  });

  it("applies supported status, source, location, payment, and assignment filters", () => {
    const rows = [
      booking({ id: "target", booking_progress_status: "checked_in", payment_status: "pending", resource_id: null }),
      booking({ id: "wrong-source", type: "walkin", booking_progress_status: "checked_in", payment_status: "pending", resource_id: null }),
      booking({ id: "wrong-payment", booking_progress_status: "checked_in", payment_status: "paid", resource_id: null }),
      booking({ id: "wrong-room", booking_progress_status: "checked_in", payment_status: "pending", resource_id: "room-2" }),
    ];

    expect(
      applyBookingListFilters(rows, {
        status: "checked_in",
        source: "online",
        delivery: "in_spa",
        payment: "pending",
        assignment: "room_unassigned",
      }).map((row) => row.id)
    ).toEqual(["target"]);
  });
});
