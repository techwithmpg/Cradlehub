import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  customer: { id: "customer-main", full_name: "Ana", phone: "09123456789", email: null } as
    | object
    | null,
  error: null as Error | null,
  from: vi.fn(),
  selected: "",
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from }),
}));

import { getQuickBookingCustomerPrefill } from "@/lib/queries/quick-booking-options";

beforeEach(() => {
  mocks.customer = { id: "customer-main", full_name: "Ana", phone: "09123456789", email: null };
  mocks.error = null;
  mocks.selected = "";
  mocks.from.mockReset().mockImplementation((table: string) => {
    const query = {
      select: (fields: string) => {
        mocks.selected = fields;
        return query;
      },
      eq: () => query,
      maybeSingle: async () => ({ data: mocks.customer, error: mocks.error }),
    };
    expect(table).toBe("customers");
    return query;
  });
});

describe("Quick Booking global identity prefill", () => {
  it("loads only identity fields without reading another branch's bookings", async () => {
    expect(await getQuickBookingCustomerPrefill("customer-main")).toEqual({
      id: "customer-main",
      fullName: "Ana",
      phone: "09123456789",
      email: null,
    });
    expect(mocks.selected).toBe("id, full_name, phone, email");
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it("returns null for a missing customer and fails on query errors", async () => {
    mocks.customer = null;
    expect(await getQuickBookingCustomerPrefill("missing")).toBeNull();
    mocks.error = new Error("failure");
    await expect(getQuickBookingCustomerPrefill("missing")).rejects.toThrow(
      "Customer identity could not be loaded."
    );
  });
});
