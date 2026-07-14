import { describe, expect, it } from "vitest";
import { deriveSelectedBookingActivity } from "@/lib/bookings/selected-booking-activity";
import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";

function booking(overrides: Partial<WorkspaceBookingRow> = {}): WorkspaceBookingRow {
  return {
    id: "booking-1",
    booking_date: "2026-07-14",
    start_time: "10:00:00",
    end_time: "11:00:00",
    type: "online",
    delivery_type: "in_spa",
    status: "confirmed",
    payment_method: "pay_on_site",
    payment_status: "pending",
    amount_paid: 0,
    ...overrides,
  };
}

describe("selected booking activity", () => {
  it("derives a chronological timeline only from persisted timestamps and metadata", () => {
    const events = deriveSelectedBookingActivity(
      booking({
        created_at: "2026-07-13T08:00:00.000Z",
        checked_in_at: "2026-07-14T01:55:00.000Z",
        session_started_at: "2026-07-14T02:04:00.000Z",
        metadata: {
          crm_followup: {
            result: "confirmed",
            updated_at: "2026-07-13T09:15:00.000Z",
          },
          crm_reschedule_history: [
            {
              from_date: "2026-07-13",
              from_time: "09:00:00",
              to_date: "2026-07-14",
              to_time: "10:00:00",
              updated_at: "2026-07-13T10:00:00.000Z",
            },
          ],
        },
      })
    );

    expect(events.map((event) => event.label)).toEqual([
      "Service started",
      "Customer checked in",
      "Booking rescheduled",
      "Confirmation recorded",
      "Booking created",
    ]);
    expect(events.every((event) => Boolean(event.occurredAt))).toBe(true);
  });

  it("does not invent confirmation, payment, visit, or audit history", () => {
    const events = deriveSelectedBookingActivity(
      booking({ status: "completed", updated_at: "2026-07-14T03:00:00.000Z" })
    );

    expect(events.map((event) => event.label)).toEqual(["Booking updated"]);
    expect(events.map((event) => event.label)).not.toContain("Payment recorded");
    expect(events.map((event) => event.label)).not.toContain("Confirmation recorded");
  });
});
