import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  selected: "",
  filter: "",
  pattern: "",
  rows: [
    { id: "customer-main", full_name: "Anna Reyes", phone: "09123454821" },
    { id: "customer-other", full_name: "Anne Flores", phone: "09123459014" },
  ],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from }),
}));

import { searchCustomerIdentities } from "@/lib/queries/customers";

beforeEach(() => {
  mocks.selected = "";
  mocks.filter = "";
  mocks.pattern = "";
  mocks.from.mockReset().mockImplementation((table: string) => {
    const query = {
      select: (fields: string) => {
        mocks.selected = fields;
        return query;
      },
      order: () => query,
      limit: () => query,
      ilike: async (field: string, pattern: string) => {
        mocks.filter = field;
        mocks.pattern = pattern;
        return { data: mocks.rows, error: null };
      },
    };
    expect(table).toBe("customers");
    return query;
  });
});

describe("global customer identity search", () => {
  it("finds customers without querying branch bookings and returns only masked identity", async () => {
    expect(await searchCustomerIdentities("Ann")).toEqual([
      { id: "customer-main", full_name: "Anna Reyes", phone_suffix: "4821" },
      { id: "customer-other", full_name: "Anne Flores", phone_suffix: "9014" },
    ]);
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.selected).toBe("id, full_name, phone");
    expect(mocks.filter).toBe("full_name");
    expect(mocks.pattern).toBe("%Ann%");
  });

  it("uses a bounded exact phone prefix for numeric identity search", async () => {
    await searchCustomerIdentities("0912 345 6789");
    expect(mocks.filter).toBe("phone");
    expect(mocks.pattern).toBe("09123456789%");
  });

  it("does not query for fewer than two characters", async () => {
    expect(await searchCustomerIdentities("A")).toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
