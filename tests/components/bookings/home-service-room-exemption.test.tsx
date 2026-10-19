/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";
import { getSelectedBookingActionPlan } from "@/lib/bookings/selected-booking-panel";
import { SelectedBookingWarnings } from "@/components/features/bookings/selected-booking-warnings";
import { SelectedBookingSummaryBand } from "@/components/features/bookings/selected-booking-summary-band";

vi.mock("server-only", () => ({}));
vi.mock("@/app/(dashboard)/crm/bookings/actions", () => ({
  resolveStaffScheduleExceptionAction: vi.fn(),
}));

afterEach(cleanup);

function booking(overrides: Partial<WorkspaceBookingRow> = {}): WorkspaceBookingRow {
  return {
    id: "booking-home-1",
    booking_date: "2026-10-18",
    start_time: "10:00:00",
    end_time: "11:00:00",
    type: "online",
    delivery_type: "home_service",
    status: "confirmed",
    booking_progress_status: "checked_in",
    resource_id: null,
    payment_method: "pay_on_site",
    payment_status: "paid",
    amount_paid: 500,
    metadata: {},
    staff: { id: "staff-1", full_name: "Therapist" },
    ...overrides,
  };
}
function warnings(row: WorkspaceBookingRow, onOpenRoom = vi.fn()) {
  render(
    <SelectedBookingWarnings
      booking={row}
      onOpenRoom={onOpenRoom}
      onOpenPayment={vi.fn()}
      onOpenStaff={vi.fn()}
      onOpenReschedule={vi.fn()}
    />
  );
  return onOpenRoom;
}

describe("Home Service requires no spa room", () => {
  it.each([
    ["delivery type", { delivery_type: "home_service", type: "online" }],
    ["booking type", { delivery_type: "in_spa", type: "home_service" }],
    ["legacy metadata", { delivery_type: "in_spa", type: "online", metadata: { delivery_type: "home_service" } }],
  ] as const)("does not show an Assign Room warning for %s", (_kind, override) => {
    warnings(booking(override));
    expect(screen.queryByText("Room assignment required")).toBeNull();
    expect(screen.queryByRole("button", { name: "Assign" })).toBeNull();
  });

  it("still requires a room for an in-spa checked-in booking", () => {
    warnings(booking({ delivery_type: "in_spa" }));
    expect(screen.getByText("Room assignment required")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Assign" })).toBeTruthy();
  });

  it.each(["home_service", "online"] as const)(
    "never offers room actions for a checked-in home-service action plan (%s)",
    (type) => {
      const plan = getSelectedBookingActionPlan({
        status: "confirmed",
        bookingProgressStatus: "checked_in",
        type,
        deliveryType: type === "home_service" ? "in_spa" : "home_service",
        resourceId: null,
        hasStaff: true,
      });
      expect(plan.primary?.id).toBe("track_dispatch");
      expect([plan.primary, ...plan.secondary].map((item) => item?.id)).not.toContain("assign_room");
      expect([plan.primary, ...plan.secondary].map((item) => item?.id)).not.toContain("change_room");
    }
  );

  it("honors legacy Home Service metadata in the action plan", () => {
    const plan = getSelectedBookingActionPlan({
      status: "confirmed",
      bookingProgressStatus: "checked_in",
      type: "online",
      deliveryType: "in_spa",
      metadataDeliveryType: "home_service",
      resourceId: null,
      hasStaff: true,
    });
    expect(plan.primary?.id).toBe("track_dispatch");
    expect([plan.primary, ...plan.secondary].map((action) => action?.id)).not.toContain("assign_room");
  });

  it("preserves the in-spa checked-in Assign Room action", () => {
    const plan = getSelectedBookingActionPlan({
      status: "confirmed",
      bookingProgressStatus: "checked_in",
      type: "online",
      deliveryType: "in_spa",
      resourceId: null,
      hasStaff: true,
    });
    expect(plan.primary?.id).toBe("assign_room");
  });

  it("shows Home Service location without a room Change/Assign control", () => {
    render(
      <SelectedBookingSummaryBand
        booking={booking()}
        viewerRole="crm"
        onChangeStaff={vi.fn()}
        onChangeRoom={vi.fn()}
      />
    );
    expect(screen.getByText("Service location")).toBeTruthy();
    expect(screen.getByText("Home service")).toBeTruthy();
    expect(screen.queryByText("Room")).toBeNull();
    expect(screen.queryByRole("button", { name: "Assign" })).toBeNull();
  });

  it("preserves an in-spa room field", () => {
    render(
      <SelectedBookingSummaryBand
        booking={booking({ delivery_type: "in_spa" })}
        viewerRole="crm"
        onChangeStaff={vi.fn()}
        onChangeRoom={vi.fn()}
      />
    );
    expect(screen.getByText("Room")).toBeTruthy();
    expect(screen.getByText("Room TBD")).toBeTruthy();
    expect(screen.queryByText("Service location")).toBeNull();
  });
});
