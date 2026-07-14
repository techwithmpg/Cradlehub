/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookingsDesktopList } from "@/components/features/bookings/bookings-desktop-list";
import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";

afterEach(() => cleanup());

const booking: WorkspaceBookingRow = {
  id: "1ea3ce31-6ead-49e0-9ff4-43501d5cf20d",
  booking_date: "2026-07-14",
  start_time: "10:00:00",
  end_time: "11:00:00",
  type: "online",
  delivery_type: "in_spa",
  status: "pending",
  payment_method: "pay_on_site",
  payment_status: "pending",
  amount_paid: 0,
  customers: { id: "customer-1", full_name: "A very long customer name that must truncate", phone: "99994462" },
  services: { id: "service-1", name: "Angels Massage", duration_minutes: 60 },
};

describe("compact desktop booking list", () => {
  it("shows only Time, Customer, and Status and prevents horizontal table scrolling", () => {
    render(<BookingsDesktopList bookings={[booking]} selectedId={booking.id} onSelect={vi.fn()} />);

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Time",
      "Customer",
      "Status",
    ]);
    expect(screen.queryByRole("columnheader", { name: "Service" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Assignment" })).toBeNull();

    const table = screen.getByRole("table");
    expect(table.className).not.toContain("min-w-");
    expect(table.parentElement?.className).toContain("overflow-x-hidden");
  });

  it("keeps keyboard row selection and aria-selected behavior", () => {
    const onSelect = vi.fn();
    render(<BookingsDesktopList bookings={[booking]} selectedId={booking.id} onSelect={onSelect} />);

    const row = screen.getByRole("row", { name: /Select booking for/i });
    expect(row.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });
});
