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
  searchCustomerIdentities: vi.fn(),
  lookupCustomerByPhone: vi.fn(),
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
vi.mock("@/lib/queries/customers", () => ({
  searchCustomerIdentities: mocks.searchCustomerIdentities,
  lookupCustomerByPhone: mocks.lookupCustomerByPhone,
}));
vi.mock("@/lib/queries/front-desk-branch", () => ({
  resolveOwnerFrontDeskBranch: mocks.resolveOwnerFrontDeskBranch,
}));

import { GET } from "@/app/api/customers/search/route";
import { GET as lookupGET } from "@/app/api/customers/lookup/route";

function request(extra = "") {
  return new NextRequest(`https://cradlehub.test/api/customers/search?q=Ana${extra}`);
}

beforeEach(() => {
  mocks.userId = "owner-1";
  mocks.staff = { system_role: "owner", branch_id: "main" };
  mocks.selectedBranch = { id: "sm", name: "SM Branch" };
  mocks.searchCustomerIdentities.mockReset().mockResolvedValue([{ id: "customer-main", full_name: "Ana", phone_suffix: "6789" }]);
  mocks.lookupCustomerByPhone.mockReset().mockResolvedValue({ id: "customer-sm" });
  mocks.resolveOwnerFrontDeskBranch
    .mockReset()
    .mockImplementation(async () => mocks.selectedBranch);
  mocks.staffLookup.mockReset().mockImplementation(async () => ({ data: mocks.staff }));
});

describe("direct customer phone lookup API", () => {
  it("uses the selected Owner branch and ignores a browser branch override", async () => {
    const response = await lookupGET(
      new NextRequest("https://cradlehub.test/api/customers/lookup?phone=09123456789&branchId=main")
    );
    expect(response.status).toBe(200);
    expect(mocks.lookupCustomerByPhone).toHaveBeenCalledWith("09123456789");

    mocks.selectedBranch = { id: "main", name: "Main Spa" };
    await lookupGET(
      new NextRequest("https://cradlehub.test/api/customers/lookup?phone=09123456789&branchId=sm")
    );
    expect(mocks.lookupCustomerByPhone).toHaveBeenLastCalledWith("09123456789");
  });

  it("keeps branch staff scoped and fails closed without a selected branch", async () => {
    mocks.staff = { system_role: "manager", branch_id: "main" };
    await lookupGET(
      new NextRequest("https://cradlehub.test/api/customers/lookup?phone=09123456789")
    );
    expect(mocks.lookupCustomerByPhone).toHaveBeenCalledWith("09123456789");

    mocks.staff = { system_role: "owner", branch_id: "main" };
    mocks.selectedBranch = null;
    expect(
      (
        await lookupGET(
          new NextRequest("https://cradlehub.test/api/customers/lookup?phone=09123456789")
        )
      ).status
    ).toBe(403);
    expect(mocks.lookupCustomerByPhone).toHaveBeenCalledTimes(1);
  });
});

describe("direct CRM customer search API", () => {
  it("allows global identity after resolving Owner context and ignores a browser branch override", async () => {
    const response = await GET(request("&branchId=main"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ customers: [{ id: "customer-main", full_name: "Ana", phone_suffix: "6789" }] });
    expect(mocks.resolveOwnerFrontDeskBranch).toHaveBeenCalledWith("owner-1", "main");
    expect(mocks.searchCustomerIdentities).toHaveBeenCalledWith("Ana");

    mocks.selectedBranch = { id: "main", name: "Main Spa" };
    await GET(request("&branchId=sm"));
    expect(mocks.searchCustomerIdentities).toHaveBeenLastCalledWith("Ana");
  });

  it("keeps non-Owner staff on their assigned branch", async () => {
    mocks.staff = { system_role: "crm", branch_id: "main" };
    const response = await GET(request("&branchId=sm"));
    expect(response.status).toBe(200);
    expect(mocks.resolveOwnerFrontDeskBranch).not.toHaveBeenCalled();
    expect(mocks.searchCustomerIdentities).toHaveBeenCalledWith("Ana");
  });

  it("fails closed when identity or an Owner-selected branch is unavailable", async () => {
    mocks.userId = null;
    expect((await GET(request())).status).toBe(401);
    expect(mocks.searchCustomerIdentities).not.toHaveBeenCalled();

    mocks.userId = "owner-1";
    mocks.selectedBranch = null;
    expect((await GET(request())).status).toBe(403);
    expect(mocks.searchCustomerIdentities).not.toHaveBeenCalled();
  });
});
