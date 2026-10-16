/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookingsDesktopList } from "@/components/features/bookings/bookings-desktop-list";
import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";
import { groupCrmBookings } from "@/lib/bookings/crm-booking-groups";

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
  customers: {
    id: "customer-1",
    full_name: "A very long customer name that must truncate",
    phone: "99994462",
  },
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
    render(
      <BookingsDesktopList bookings={[booking]} selectedId={booking.id} onSelect={onSelect} />
    );

    const row = screen.getByRole("row", { name: /Select booking for/i });
    expect(row.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("renders one selectable order row for multiple guests and service lines", () => {
    const order = {
      id: "order-1",
      order_number: "CRD-123",
      organizer_customer_id: "customer-1",
      metadata: null,
    };
    const lines: WorkspaceBookingRow[] = [
      {
        ...booking,
        id: "line-1",
        order_id: "order-1",
        attendee_id: "attendee-1",
        booking_attendees: {
          id: "attendee-1",
          sequence: 1,
          display_name: "Gwanmesia Malcom",
          customer_id: "customer-1",
        },
        booking_orders: order,
        order_total_amount: 2400,
        order_amount_paid: 0,
        order_payment_status: "unpaid",
      },
      {
        ...booking,
        id: "line-2",
        order_id: "order-1",
        attendee_id: "attendee-2",
        booking_attendees: {
          id: "attendee-2",
          sequence: 2,
          display_name: "Guest 2",
          customer_id: null,
        },
        booking_orders: order,
        start_time: "10:15:00",
        end_time: "11:30:00",
        order_total_amount: 2400,
        order_amount_paid: 0,
        order_payment_status: "unpaid",
      },
    ];
    const groups = groupCrmBookings(lines);
    const onSelectGroup = vi.fn();
    render(
      <BookingsDesktopList
        bookings={[]}
        displayGroups={groups}
        selectedId={groups[0]?.displayId ?? null}
        onSelect={vi.fn()}
        onSelectGroup={onSelectGroup}
      />
    );
    expect(screen.getAllByRole("row", { name: /Select order for/i })).toHaveLength(1);
    expect(screen.getByText(/Group · 2 guests · 2 services/)).toBeTruthy();
    expect(screen.getByText("90 min")).toBeTruthy();
    fireEvent.click(screen.getByRole("row", { name: /Select order for/i }));
    expect(onSelectGroup).toHaveBeenCalledWith(groups[0]);
  });
});
