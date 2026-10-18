import { describe, expect, it } from "vitest";
import {
  isOwnerBookingsBranchParamInvalid,
  ownerBookingsInitialRead,
  ownerBookingsRequestKey,
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
});
