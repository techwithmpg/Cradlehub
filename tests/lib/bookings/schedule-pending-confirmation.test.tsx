import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScheduleBookingBlock } from "@/components/features/schedule/schedule-booking-block";
import BookingSuccessPage from "@/app/(public)/book/success/page";
import type { DailyScheduleBooking } from "@/lib/queries/schedule";

const booking: DailyScheduleBooking = {
  id: "booking-1",
  start_time: "10:00:00",
  end_time: "11:00:00",
  service: "Massage",
  customer: "Guest",
  status: "pending_crm_confirmation",
  type: "online",
  resource_id: null,
  resource_name: null,
};

const timelineRange = {
  startMinutes: 600,
  endMinutes: 720,
  startTime: "10:00",
  endTime: "12:00",
  totalMinutes: 120,
  hourCount: 2,
};

describe("Schedule online request status", () => {
  it("tells the customer the request awaits front desk confirmation", () => {
    const successPage = renderToStaticMarkup(<BookingSuccessPage />);
    expect(successPage).toContain("Your Booking Request Was Received");
    expect(successPage).toContain("Our front desk will review");
    expect(successPage).toContain("confirm your appointment details");
  });

  it("renders a pending request distinctly from confirmed work", () => {
    const pending = renderToStaticMarkup(
      <ScheduleBookingBlock
        booking={booking}
        timelineRange={timelineRange}
        timelineMode="expanded"
      />
    );
    const confirmed = renderToStaticMarkup(
      <ScheduleBookingBlock
        booking={{ ...booking, status: "confirmed" }}
        timelineRange={timelineRange}
        timelineMode="expanded"
      />
    );

    expect(pending).toContain("Status: pending CRM confirmation");
    expect(pending).toContain("Pending CRM");
    expect(pending).not.toContain("Status: confirmed");
    expect(confirmed).toContain("Status: confirmed");
    expect(confirmed).toContain("Confirmed");
  });
});
