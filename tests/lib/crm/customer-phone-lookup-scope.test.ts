import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  branchId: "sm",
  customerId: "customer-sm",
  selectedBranch: "",
  selectedCustomer: "",
  bookingFound: true,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === "customers") {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({
            data: { id: mocks.customerId, full_name: "Customer", phone: "09123456789" },
          }),
        };
        return query;
      }
      const query = {
        select: () => query,
        eq: (field: string, value: string) => {
          if (field === "branch_id") mocks.selectedBranch = value;
          if (field === "customer_id") mocks.selectedCustomer = value;
          return query;
        },
        limit: () => query,
        maybeSingle: async () => ({
          data:
            mocks.bookingFound && mocks.selectedBranch === mocks.branchId
              ? { id: "booking-1" }
              : null,
          error: null,
        }),
      };
      return query;
    },
  }),
}));

import { lookupCustomerByPhone } from "@/lib/queries/customers";

beforeEach(() => {
  mocks.branchId = "sm";
  mocks.selectedBranch = "";
  mocks.selectedCustomer = "";
  mocks.bookingFound = true;
});

describe("customer phone lookup branch scope", () => {
  it("returns details only when the customer has a booking in the authorized branch", async () => {
    expect(await lookupCustomerByPhone("0912 345 6789", "sm")).toMatchObject({ id: "customer-sm" });
    expect(mocks.selectedBranch).toBe("sm");
    expect(mocks.selectedCustomer).toBe("customer-sm");

    expect(await lookupCustomerByPhone("0912 345 6789", "main")).toBeNull();
    mocks.bookingFound = false;
    expect(await lookupCustomerByPhone("0912 345 6789", "sm")).toBeNull();
  });
});
