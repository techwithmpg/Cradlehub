import { describe, expect, it } from "vitest";
import {
  isOwnerBookingsBranchParamInvalid,
  normalizeBookingMetadata,
  ownerBookingsInitialRead,
  ownerBookingsRequestKey,
  toWorkspaceBookingRow,
} from "@/lib/owner/owner-bookings-query";

describe("PERF-9B Owner Bookings query authority and presentation", () => {
  it("isolates server query dimensions without refetching for local search or tab", () => {
    const base = { date: "2026-10-18" };
    const all = ownerBookingsRequestKey(base);
    expect(all).toBe(ownerBookingsRequestKey({ ...base, branch: undefined }));
    expect(all).not.toBe(ownerBookingsRequestKey({ ...base, branch: "main" }));
    expect(all).not.toBe(ownerBookingsRequestKey({ ...base, status: "confirmed" }));
    expect(all).not.toBe(ownerBookingsRequestKey({ ...base, type: "online" }));
    expect(all).not.toBe(ownerBookingsRequestKey({ date: "2026-10-19" }));
  });

  it("fails closed on repeated branch parameters instead of using the first branch", () => {
    expect(isOwnerBookingsBranchParamInvalid(new URLSearchParams("branch=main&branch=sm"))).toBe(true);
    expect(isOwnerBookingsBranchParamInvalid(new URLSearchParams("branch=main"))).toBe(false);
    expect(isOwnerBookingsBranchParamInvalid(new URLSearchParams())).toBe(false);
  });

  it("distinguishes legitimate empty results from a failed or denied list", () => {
    expect(ownerBookingsInitialRead({ bookings: [] })).toEqual({
      status: "ready",
      bookings: [],
    });
    expect(ownerBookingsInitialRead({ error: "Unauthorized" })).toEqual({
      status: "error",
      message: "Unauthorized",
    });
    expect(ownerBookingsInitialRead({ error: "Branch unavailable" })).not.toHaveProperty("bookings");
  });

  it("normalizes booking metadata while preserving legitimate legacy home service metadata", () => {
    const legacyHomeService = { delivery_type: "home_service", address: "123 Elm St" };
    expect(normalizeBookingMetadata(legacyHomeService)).toEqual(legacyHomeService);
    expect(normalizeBookingMetadata(JSON.stringify(legacyHomeService))).toEqual(legacyHomeService);
    expect(normalizeBookingMetadata("invalid json {")).toBeNull();
    expect(normalizeBookingMetadata([1, 2, 3])).toBeNull();
    expect(normalizeBookingMetadata(null)).toBeNull();
    expect(normalizeBookingMetadata(undefined)).toBeNull();
  });

  it("safely boundaries raw booking rows into WorkspaceBookingRow with normalized metadata", () => {
    const rawRow = {
      id: "b-1",
      booking_date: "2026-10-18",
      start_time: "10:00",
      type: "online",
      status: "confirmed",
      metadata: { type: "home_service", client_address: "Quezon City" },
    };
    const row = toWorkspaceBookingRow(rawRow);
    expect(row.id).toBe("b-1");
    expect(row.payment_method).toBe("pay_on_site");
    expect(row.payment_status).toBe("unpaid");
    expect(row.amount_paid).toBe(0);
    expect(row.metadata).toEqual({ type: "home_service", client_address: "Quezon City" });
  });

  it("preserves legitimate legacy metadata inside ownerBookingsInitialRead", () => {
    const result = ownerBookingsInitialRead({
      bookings: [
        {
          id: "b-legacy",
          booking_date: "2026-10-18",
          start_time: "14:00",
          type: "home_service",
          status: "confirmed",
          payment_method: "cash",
          payment_status: "paid",
          amount_paid: 1500,
          metadata: { delivery_type: "home_service", location_note: "Gate 4" },
        },
      ],
    });
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.bookings[0]?.metadata).toEqual({
        delivery_type: "home_service",
        location_note: "Gate 4",
      });
    }
  });
});
