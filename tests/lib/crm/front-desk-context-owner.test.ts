import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  role: "owner",
  selectedBranch: { id: "sm", name: "SM Branch" },
  resolveOwnerFrontDeskBranch: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                branch_id: "main",
                branches: { name: "Main Spa" },
                system_role: mocks.role,
              },
            }),
          }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/auth/super-admin", () => ({ resolveSuperAdminContext: async () => null }));
vi.mock("@/lib/dev-bypass", () => ({ isDevAuthBypassEnabled: () => false }));
vi.mock("@/lib/queries/front-desk-branch", () => ({
  resolveOwnerFrontDeskBranch: mocks.resolveOwnerFrontDeskBranch,
}));

import { getFrontDeskContext } from "@/lib/queries/crm-context";

beforeEach(() => {
  mocks.role = "owner";
  mocks.resolveOwnerFrontDeskBranch.mockReset().mockResolvedValue(mocks.selectedBranch);
});

describe("Front Desk server context", () => {
  it("keeps the Owner role while resolving the selected branch for data queries", async () => {
    const context = await getFrontDeskContext();
    expect(context).toMatchObject({ role: "owner", userId: "user-1", branchId: "sm", branchName: "SM Branch" });
    expect(context.capabilities.canManageBookings).toBe(true);
    expect(mocks.resolveOwnerFrontDeskBranch).toHaveBeenCalledWith("user-1", "main");
  });

  it("keeps non-Owner staff on their assigned branch", async () => {
    mocks.role = "crm";
    const context = await getFrontDeskContext();
    expect(context).toMatchObject({ role: "crm", branchId: "main", branchName: "Main Spa" });
    expect(mocks.resolveOwnerFrontDeskBranch).not.toHaveBeenCalled();
  });
});
