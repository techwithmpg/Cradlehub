import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectedBranch: { id: "sm", name: "SM Branch" } as { id: string; name: string } | null,
  staff: { id: "owner-staff", branch_id: "main", system_role: "owner" },
  execute: vi.fn(),
  resolve: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "owner-user" } } }) },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: mocks.staff }),
      };
      return query;
    },
  }),
}));
vi.mock("@/lib/dev-bypass", () => ({ isDevAuthBypassEnabled: () => false }));
vi.mock("@/lib/bookings/inhouse-booking-engine", () => ({
  executeInhouseBookingCreation: mocks.execute,
}));
vi.mock("@/lib/queries/front-desk-branch", () => ({
  resolveOwnerFrontDeskBranch: mocks.resolve,
}));

import { createInhouseBookingMultiAction } from "@/lib/actions/inhouse-booking";

beforeEach(() => {
  mocks.staff = { id: "owner-staff", branch_id: "main", system_role: "owner" };
  mocks.selectedBranch = { id: "sm", name: "SM Branch" };
  mocks.resolve.mockReset().mockImplementation(async () => mocks.selectedBranch);
  mocks.execute.mockReset().mockResolvedValue({ ok: true, bookingId: "booking-sm" });
});

describe("hosted Owner booking branch authorization", () => {
  it("passes the selected SM branch and global customer ID to the booking engine", async () => {
    const input = { branchId: "sm", customerId: "customer-main" };
    expect(await createInhouseBookingMultiAction(input)).toEqual({
      ok: true,
      bookingId: "booking-sm",
    });
    expect(mocks.resolve).toHaveBeenCalledWith("owner-user", "main");
    expect(mocks.execute).toHaveBeenCalledWith(
      input,
      expect.objectContaining({ staffRole: "owner" })
    );
  });

  it("rejects a browser override to Main while Owner views SM", async () => {
    const result = await createInhouseBookingMultiAction({
      branchId: "main",
      customerId: "customer-main",
    });
    expect(result).toMatchObject({ ok: false, code: "CRM_BRANCH_FORBIDDEN" });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("uses the updated Owner branch after switching and preserves non-Owner checks in the engine", async () => {
    mocks.selectedBranch = { id: "main", name: "Main Spa" };
    await createInhouseBookingMultiAction({ branchId: "main" });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    mocks.execute.mockClear();
    mocks.staff = { id: "staff-sm", branch_id: "sm", system_role: "crm" };
    await createInhouseBookingMultiAction({ branchId: "main" });
    expect(mocks.resolve).toHaveBeenCalledTimes(1);
    expect(mocks.execute).toHaveBeenCalledWith(
      { branchId: "main" },
      expect.objectContaining({ staffRole: "crm" })
    );
  });
});
