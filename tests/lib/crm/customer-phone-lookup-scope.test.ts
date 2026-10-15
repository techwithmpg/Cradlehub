import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  phone: "",
  customer: { id: "customer-main", full_name: "Ana", phone: "09123456789", email: null } as
    | object
    | null,
  select: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from }),
}));

import { lookupCustomerByPhone } from "@/lib/queries/customers";

beforeEach(() => {
  mocks.phone = "";
  mocks.customer = { id: "customer-main", full_name: "Ana", phone: "09123456789", email: null };
  mocks.select.mockReset();
  mocks.from.mockReset().mockImplementation((table: string) => {
    const query = {
      select: (fields: string) => {
        mocks.select(fields);
        return query;
      },
      eq: (_field: string, value: string) => {
        mocks.phone = value;
        return query;
      },
      maybeSingle: async () => ({ data: mocks.customer, error: null }),
    };
    expect(table).toBe("customers");
    return query;
  });
});

describe("exact phone identity lookup", () => {
  it("finds a customer without checking current-branch bookings", async () => {
    expect(await lookupCustomerByPhone("0912 345 6789")).toMatchObject({ id: "customer-main" });
    expect(mocks.phone).toBe("09123456789");
    expect(mocks.select).toHaveBeenCalledWith("id, full_name, phone, email");
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it("rejects an insufficient phone and returns no unknown identity", async () => {
    expect(await lookupCustomerByPhone("123")).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
    mocks.customer = null;
    expect(await lookupCustomerByPhone("09123456789")).toBeNull();
  });
});
