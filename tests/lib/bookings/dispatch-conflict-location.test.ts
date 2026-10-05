import { describe, expect, it, vi } from "vitest";

const query = {
  eq: vi.fn(),
  then: (resolve: (value: { data: unknown[] }) => unknown) => resolve({ data: [] }),
};
query.eq.mockReturnValue(query);

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => query }),
  }),
}));

import { checkHomeServiceDispatchConflict } from "@/lib/bookings/dispatch-conflict";

const base = {
  branchId: "550e8400-e29b-41d4-a716-446655440000",
  bookingDate: "2026-10-20",
  startTime: "21:00",
  endTime: "22:40",
  selectedZone: "unknown",
  driverCapacity: 2,
};

describe("Home Service dispatch location review", () => {
  it("accepts a precise destination when its optional zone is unknown", async () => {
    expect(
      await checkHomeServiceDispatchConflict({
        ...base,
        selectedLat: 10.67,
        selectedLng: 122.95,
      })
    ).toEqual({ conflict: "none" });
  });

  it("continues to flag an unknown zone without coordinates", async () => {
    expect(await checkHomeServiceDispatchConflict(base)).toMatchObject({
      conflict: "warning",
      needs_location_review: true,
    });
  });
});
