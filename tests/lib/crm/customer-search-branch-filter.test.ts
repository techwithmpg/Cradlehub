import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  branchCustomers: {
    sm: ["customer-sm"],
    main: ["customer-main"],
  } as Record<string, string[]>,
  selectedBranch: "sm",
  selectedIds: [] as string[],
  inFilter: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === "bookings") {
        const query = {
          select: () => query,
          eq: (_field: string, value: string) => {
            mocks.selectedBranch = value;
            return query;
          },
          not: () =>
            Promise.resolve({
              data: (mocks.branchCustomers[mocks.selectedBranch] ?? []).map((customer_id) => ({
                customer_id,
              })),
            }),
        };
        return query;
      }
      const query = {
        select: () => query,
        or: () => query,
        order: () => query,
        limit: () => query,
        in: (_field: string, ids: string[]) => {
          mocks.selectedIds = ids;
          mocks.inFilter(ids);
          return query;
        },
        then: (resolve: (value: unknown) => void) =>
          resolve({
            data: [{ id: "customer-sm" }, { id: "customer-main" }].filter((customer) =>
              mocks.selectedIds.includes(customer.id)
            ),
            error: null,
          }),
      };
      return query;
    },
  }),
}));

import { searchCustomers } from "@/lib/queries/customers";

beforeEach(() => {
  mocks.selectedBranch = "sm";
  mocks.selectedIds = [];
  mocks.inFilter.mockReset();
});

describe("CRM customer search branch membership", () => {
  it("uses only customer IDs with a booking at the selected branch after switching", async () => {
    expect(await searchCustomers("Ana", "sm")).toEqual([{ id: "customer-sm" }]);
    expect(mocks.inFilter).toHaveBeenLastCalledWith(["customer-sm"]);

    expect(await searchCustomers("Ana", "main")).toEqual([{ id: "customer-main" }]);
    expect(mocks.inFilter).toHaveBeenLastCalledWith(["customer-main"]);
  });

  it("returns no customers when the branch has no booking membership", async () => {
    expect(await searchCustomers("Ana", "empty")).toEqual([]);
    expect(mocks.inFilter).not.toHaveBeenCalled();
  });
});
