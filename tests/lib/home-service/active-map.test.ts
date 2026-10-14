import { describe, expect, it } from "vitest";
import {
  activeMapRelevanceFilter,
  eligibleCustomerDestinations,
  isOpenHomeServiceBooking,
} from "@/lib/home-service/active-map";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

const booking = (id: string, bookingDate: string, overrides: Partial<RealDispatchItem> = {}) =>
  ({
    id,
    bookingDate,
    bookingStatus: "confirmed",
    bookingProgressStatus: "not_started",
    lat: 14.6,
    lng: 121.0,
    currentLocation: null,
    ...overrides,
  }) as RealDispatchItem;

describe("Home Service customer destinations", () => {
  const businessDate = "2026-10-14";

  it("keeps due, future, and genuinely active overdue destinations without driver GPS", () => {
    const items = [
      booking("today", businessDate),
      booking("future", "2026-10-16"),
      booking("distant-future", "2027-01-01"),
      booking("travel", "2026-10-13", { bookingProgressStatus: "travel_started" }),
      booking("arrived", "2026-10-13", { bookingProgressStatus: "arrived" }),
      booking("session", "2026-10-13", { bookingProgressStatus: "session_started" }),
      booking("in-progress", "2026-10-13", { bookingStatus: "in_progress" }),
      booking("stale-confirmed", "2026-10-13"),
      booking("stale-payment", "2026-10-13", { bookingStatus: "pending_payment" }),
    ];
    expect(eligibleCustomerDestinations(items, businessDate).map((item) => item.id)).toEqual([
      "today",
      "future",
      "distant-future",
      "travel",
      "arrived",
      "session",
      "in-progress",
    ]);
  });

  it("excludes terminal statuses and invalid customer coordinates", () => {
    const items = [
      booking("completed", businessDate, { bookingStatus: "completed" }),
      booking("cancelled", businessDate, { bookingStatus: "cancelled" }),
      booking("no-show", businessDate, { bookingStatus: "no_show" }),
      booking("expired", businessDate, { bookingStatus: "expired" }),
      booking("progress-completed", businessDate, { bookingProgressStatus: "completed" }),
      booking("progress-no-show", businessDate, { bookingProgressStatus: "no_show" }),
      booking("bad-gps", businessDate, { lat: 999 }),
    ];
    expect(eligibleCustomerDestinations(items, businessDate)).toEqual([]);
  });

  it("shares the same overdue progression signals with the database prefilter", () => {
    expect(activeMapRelevanceFilter(businessDate)).toBe(
      "booking_date.gte.2026-10-14,booking_progress_status.in.(travel_started,arrived,session_started),status.eq.in_progress"
    );
    expect(
      isOpenHomeServiceBooking(
        booking("checked-in-past", "2026-10-13", { bookingProgressStatus: "checked_in" }),
        businessDate
      )
    ).toBe(false);
  });
});
