import { describe, expect, it } from "vitest";
import { eligibleCustomerDestinations } from "@/lib/home-service/active-map";
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
  it("keeps overdue, today, and future open destinations without driver GPS", () => {
    const items = [
      booking("pending", "2026-10-13", { bookingStatus: "pending" }),
      booking("pending-payment", "2026-10-13", { bookingStatus: "pending_payment" }),
      booking("pending-crm", "2026-10-13", { bookingStatus: "pending_crm_confirmation" }),
      booking("in-progress", "2026-10-13", { bookingStatus: "in_progress" }),
      booking("overdue", "2026-10-12"),
      booking("today", "2026-10-13"),
      booking("future", "2026-10-16"),
    ];
    expect(eligibleCustomerDestinations(items).map((item) => item.id)).toEqual([
      "pending",
      "pending-payment",
      "pending-crm",
      "in-progress",
      "overdue",
      "today",
      "future",
    ]);
  });

  it("excludes terminal statuses and invalid customer coordinates", () => {
    const items = [
      booking("completed", "2026-10-13", { bookingStatus: "completed" }),
      booking("cancelled", "2026-10-13", { bookingStatus: "cancelled" }),
      booking("no-show", "2026-10-13", { bookingStatus: "no_show" }),
      booking("expired", "2026-10-13", { bookingStatus: "expired" }),
      booking("progress-completed", "2026-10-13", { bookingProgressStatus: "completed" }),
      booking("progress-no-show", "2026-10-13", { bookingProgressStatus: "no_show" }),
      booking("bad-gps", "2026-10-13", { lat: 999 }),
    ];
    expect(eligibleCustomerDestinations(items)).toEqual([]);
  });
});
