import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  booking: { id: "booking-sm" } as { id: string } | null,
  bookingError: null as Error | null,
  customer: { id: "customer-1", full_name: "Ana", phone: "123", email: null },
  from: vi.fn(),
  filters: [] as Array<[string, string, string]>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mocks.from,
  }),
}));

import { getQuickBookingCustomerPrefill } from "@/lib/queries/quick-booking-options";

beforeEach(() => {
  mocks.booking = { id: "booking-sm" };
  mocks.bookingError = null;
  mocks.filters = [];
  mocks.from.mockReset().mockImplementation((table: string) => {
    const query = {
      select: () => query,
      eq: (column: string, value: string) => {
        mocks.filters.push([table, column, value]);
        return query;
      },
      limit: () => query,
      maybeSingle: async () =>
        table === "bookings"
          ? { data: mocks.booking, error: mocks.bookingError }
          : { data: mocks.customer, error: null },
    };
    return query;
  });
});

describe("Quick Booking customer prefill branch boundary", () => {
  it("reads customer details only after finding a booking in the selected branch", async () => {
    const result = await getQuickBookingCustomerPrefill("customer-1", "sm");
    expect(result).toEqual({ id: "customer-1", fullName: "Ana", phone: "123", email: null });
    expect(mocks.filters).toContainEqual(["bookings", "customer_id", "customer-1"]);
    expect(mocks.filters).toContainEqual(["bookings", "branch_id", "sm"]);
    expect(mocks.from).toHaveBeenCalledWith("customers");
  });

  it("does not expose a customer from another branch", async () => {
    mocks.booking = null;
    expect(await getQuickBookingCustomerPrefill("customer-1", "sm")).toBeNull();
    expect(mocks.from).not.toHaveBeenCalledWith("customers");
  });

  it("fails closed if branch membership cannot be verified", async () => {
    mocks.bookingError = new Error("lookup failed");
    await expect(getQuickBookingCustomerPrefill("customer-1", "sm")).rejects.toThrow(
      "Customer branch could not be verified."
    );
    expect(mocks.from).not.toHaveBeenCalledWith("customers");
  });
});
