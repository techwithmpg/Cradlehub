import { describe, expect, it } from "vitest";
import { bookingBlocksAvailability } from "@/lib/bookings/hold-status";

describe("booking availability during CRM review", () => {
  const now = new Date("2026-10-05T08:00:00.000Z");

  it("keeps an online CRM review request on the schedule independent of payment hold expiry", () => {
    expect(
      bookingBlocksAvailability(
        { status: "pending_crm_confirmation", hold_expires_at: "2026-10-05T07:00:00.000Z" },
        now
      )
    ).toBe(true);
    expect(bookingBlocksAvailability({ status: "pending_crm_confirmation" }, now)).toBe(true);
  });

  it("expires only a pending payment hold", () => {
    expect(
      bookingBlocksAvailability(
        { status: "pending_payment", hold_expires_at: "2026-10-05T07:00:00.000Z" },
        now
      )
    ).toBe(false);
  });
});
