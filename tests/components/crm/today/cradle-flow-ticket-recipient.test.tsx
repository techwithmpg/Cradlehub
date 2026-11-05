// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CradleFlowTicket } from "@/components/features/crm/today/cradle-flow-ticket";
import type { CradleFlowBooking } from "@/lib/crm/cradle-flow";

afterEach(() => cleanup());

describe("Cradle Flow single-service recipient identity", () => {
  it("renders the treatment recipient instead of the booking contact", () => {
    const booking = {
      id: "booking-1",
      booking_date: "2026-11-05",
      start_time: "11:00:00",
      end_time: "12:30:00",
      status: "in_progress",
      booking_progress_status: "session_started",
      type: "walkin",
      delivery_type: "in_spa",
      travel_buffer_mins: null,
      resource_id: "room-2",
      resource_name: "Room 2",
      staff_name: "Therapist A",
      customer_name: "Booking Contact",
      customer_phone: "000-000-0000",
      service_name: "Swedish Massage 90min",
      service_duration: 90,
      price_paid: 750,
      payment_status: "unpaid",
      amount_paid: 0,
      attendee_id: "attendee-1",
      booking_attendees: {
        id: "attendee-1",
        sequence: 1,
        display_name: "Treatment Recipient",
        customer_id: null,
      },
    } as CradleFlowBooking;

    render(
      <CradleFlowTicket
        booking={booking}
        businessDate="2026-11-05"
        onOpen={vi.fn()}
        onPrimary={vi.fn()}
        onAssignRoom={vi.fn()}
        onAssignTherapist={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Treatment Recipient" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Booking Contact" })).toBeNull();
    expect(screen.getByText("Swedish Massage 90min")).toBeTruthy();
  });
});
