/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CradleFlowTicket } from "@/components/features/crm/today/cradle-flow-ticket";
import { CradleFlowGroupDialog } from "@/components/features/crm/today/cradle-flow-group-dialog";
import { groupCradleFlowBookings } from "@/components/features/crm/today/cradle-flow-display";
import type { CradleFlowBooking } from "@/lib/crm/cradle-flow";

afterEach(() => cleanup());

function booking(id: string, attendeeId: string): CradleFlowBooking {
  return {
    id,
    order_id: "order-1",
    attendee_id: attendeeId,
    booking_attendees: {
      id: attendeeId,
      sequence: Number(attendeeId.slice(-1)),
      display_name: `Guest ${attendeeId.slice(-1)}`,
      customer_id: null,
    },
    booking_orders: {
      id: "order-1",
      order_number: "CRD-123",
      organizer_customer_id: "customer-1",
      metadata: null,
    },
    order_payment_status: "unpaid",
    order_amount_paid: 0,
    order_total_amount: 2400,
    booking_date: "2026-10-15",
    start_time: "20:00:00",
    end_time: "21:30:00",
    status: "confirmed",
    type: "walkin",
    delivery_type: "in_spa",
    travel_buffer_mins: null,
    customer_name: "Gwanmesia Malcom",
    service_name: "Sports Massage",
    service_duration: 90,
    staff_name: "Janice",
    resource_name: "Room 1",
    resource_id: "room-1",
    price_paid: 800,
  };
}

describe("Cradle Flow order ticket", () => {
  it("shows one parent payment and a safe open action for a mixed group", () => {
    const lines = [
      booking("line-1", "guest-1"),
      {
        ...booking("line-2", "guest-2"),
        status: "in_progress",
        booking_progress_status: "session_started",
      },
    ];
    const group = groupCradleFlowBookings(lines)[0]!;
    const onOpenGroup = vi.fn();
    const onPrimary = vi.fn();
    render(
      <CradleFlowTicket
        booking={lines[0]!}
        group={group}
        businessDate="2026-10-15"
        onOpen={vi.fn()}
        onOpenGroup={onOpenGroup}
        onPrimary={onPrimary}
        onAssignRoom={vi.fn()}
        onAssignTherapist={vi.fn()}
      />
    );
    expect(screen.getByText("Group · 2 guests")).toBeTruthy();
    expect(screen.getByText("In Service")).toBeTruthy();
    expect(screen.getByText(/₱2,400.00 order total/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start Service" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open Group" }));
    expect(onOpenGroup).toHaveBeenCalledWith(group);
    expect(onPrimary).not.toHaveBeenCalled();
  });

  it("opens a specific service line from group details", () => {
    const lines = [booking("line-1", "guest-1"), booking("line-2", "guest-2")];
    const group = groupCradleFlowBookings(lines)[0]!;
    const onOpenLine = vi.fn();
    render(
      <CradleFlowGroupDialog group={group} open onOpenChange={vi.fn()} onOpenLine={onOpenLine} />
    );
    fireEvent.click(screen.getAllByRole("button", { name: /Open service actions/i })[1]!);
    expect(onOpenLine).toHaveBeenCalledWith(lines[1]);
  });
});
