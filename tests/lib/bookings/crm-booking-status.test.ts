import { describe, expect, it } from "vitest";
import {
  CRM_PENDING_BOOKING_STATUSES,
  isBookingClosedForCrm,
  isCrmOperationalBookingStatus,
  isCrmPendingBookingStatus,
} from "../../../src/lib/bookings/crm-booking-status";

describe("CRM booking status helpers", () => {
  it("groups all incoming booking statuses as pending", () => {
    expect(CRM_PENDING_BOOKING_STATUSES).toEqual([
      "pending",
      "pending_payment",
      "pending_crm_confirmation",
    ]);

    for (const status of CRM_PENDING_BOOKING_STATUSES) {
      expect(isCrmPendingBookingStatus(status)).toBe(true);
      expect(isCrmOperationalBookingStatus(status)).toBe(true);
    }
  });

  it("separates active operations from closed statuses", () => {
    expect(isCrmOperationalBookingStatus("confirmed")).toBe(true);
    expect(isCrmOperationalBookingStatus("in_progress")).toBe(true);
    expect(isCrmOperationalBookingStatus("completed")).toBe(false);
    expect(isBookingClosedForCrm("cancelled")).toBe(true);
    expect(isBookingClosedForCrm("no_show")).toBe(true);
    expect(isBookingClosedForCrm("expired")).toBe(true);
  });
});
