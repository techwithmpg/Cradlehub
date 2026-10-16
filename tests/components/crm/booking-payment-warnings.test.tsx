// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";

vi.mock("@/app/(dashboard)/crm/bookings/actions", () => ({
  resolveStaffScheduleExceptionAction: vi.fn(),
}));

import { SelectedBookingWarnings } from "@/components/features/bookings/selected-booking-warnings";

function booking(overrides: Partial<WorkspaceBookingRow> = {}): WorkspaceBookingRow {
  return {
    id: "booking-1",
    booking_date: "2026-09-30",
    start_time: "10:00:00",
    end_time: "11:00:00",
    type: "walkin",
    delivery_type: "in_spa",
    status: "confirmed",
    booking_progress_status: "not_started",
    payment_method: "cash",
    payment_status: "pay_on_site",
    amount_paid: 0,
    metadata: { price_paid: 800 },
    resource_id: "room-1",
    ...overrides,
  };
}

function renderWarnings(row: WorkspaceBookingRow) {
  return render(
    <SelectedBookingWarnings
      booking={row}
      onOpenRoom={vi.fn()}
      onOpenPayment={vi.fn()}
      onOpenStaff={vi.fn()}
      onOpenReschedule={vi.fn()}
    />
  );
}

afterEach(cleanup);

describe("booking payment warnings", () => {
  it("does not warn on a healthy unpaid Pay-on-Site booking or an active countdown", () => {
    renderWarnings(booking());
    expect(screen.queryByText("Payment Overdue")).toBeNull();
    cleanup();
    renderWarnings(
      booking({
        status: "in_progress",
        booking_progress_status: "session_started",
        session_due_at: "2099-01-01T00:00:00Z",
      })
    );
    expect(screen.queryByText("Payment Overdue")).toBeNull();
  });

  it("warns only after expected end with a known outstanding balance", () => {
    renderWarnings(
      booking({
        status: "completed",
        booking_progress_status: "completed",
        session_due_at: "2026-09-30T03:00:00Z",
      })
    );
    expect(screen.getByText("Payment Overdue")).toBeTruthy();
    cleanup();
    renderWarnings(
      booking({
        status: "completed",
        booking_progress_status: "completed",
        session_due_at: "2026-09-30T03:00:00Z",
        amount_paid: 800,
        payment_status: "paid",
      })
    );
    expect(screen.queryByText("Payment Overdue")).toBeNull();
  });
});
