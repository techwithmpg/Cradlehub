import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userId: "owner-1" as string | null,
  staff: { system_role: "owner", branch_id: "main" } as {
    system_role: string;
    branch_id: string | null;
  } | null,
  selectedBranch: { id: "sm", name: "SM Branch" } as {
    id: string;
    name: string;
  } | null,
  searchCustomers: vi.fn(),
  resolveOwnerFrontDeskBranch: vi.fn(),
  staffLookup: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.userId ? { id: mocks.userId } : null } }) },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: mocks.staffLookup,
      };
      return query;
    },
  }),
}));
vi.mock("@/lib/queries/customers", () => ({ searchCustomers: mocks.searchCustomers }));
vi.mock("@/lib/queries/front-desk-branch", () => ({
  resolveOwnerFrontDeskBranch: mocks.resolveOwnerFrontDeskBranch,
}));

import { GET } from "@/app/api/customers/search/route";

function request(extra = "") {
  return new NextRequest(`https://cradlehub.test/api/customers/search?q=Ana${extra}`);
}

beforeEach(() => {
  mocks.userId = "owner-1";
  mocks.staff = { system_role: "owner", branch_id: "main" };
  mocks.selectedBranch = { id: "sm", name: "SM Branch" };
  mocks.searchCustomers.mockReset().mockResolvedValue([{ id: "customer-sm" }]);
  mocks.resolveOwnerFrontDeskBranch
    .mockReset()
    .mockImplementation(async () => mocks.selectedBranch);
  mocks.staffLookup.mockReset().mockImplementation(async () => ({ data: mocks.staff }));
});

describe("direct CRM customer search API", () => {
  it("uses the Owner's server-selected branch and ignores a browser branch override", async () => {
    const response = await GET(request("&branchId=main"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ customers: [{ id: "customer-sm" }] });
    expect(mocks.resolveOwnerFrontDeskBranch).toHaveBeenCalledWith("owner-1", "main");
    expect(mocks.searchCustomers).toHaveBeenCalledWith("Ana", "sm");

    mocks.selectedBranch = { id: "main", name: "Main Spa" };
    await GET(request("&branchId=sm"));
    expect(mocks.searchCustomers).toHaveBeenLastCalledWith("Ana", "main");
  });

  it("keeps non-Owner staff on their assigned branch", async () => {
    mocks.staff = { system_role: "crm", branch_id: "main" };
    const response = await GET(request("&branchId=sm"));
    expect(response.status).toBe(200);
    expect(mocks.resolveOwnerFrontDeskBranch).not.toHaveBeenCalled();
    expect(mocks.searchCustomers).toHaveBeenCalledWith("Ana", "main");
  });

  it("fails closed when identity or an Owner-selected branch is unavailable", async () => {
    mocks.userId = null;
    expect((await GET(request())).status).toBe(401);
    expect(mocks.searchCustomers).not.toHaveBeenCalled();

    mocks.userId = "owner-1";
    mocks.selectedBranch = null;
    expect((await GET(request())).status).toBe(403);
    expect(mocks.searchCustomers).not.toHaveBeenCalled();
  });
});
