import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  resolveNotificationsForEntity: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/lib/notifications/create", () => ({
  resolveNotificationsForEntity: mocks.resolveNotificationsForEntity,
}));

import { updateWaitlistStatusAction } from "@/app/(dashboard)/crm/waitlist/actions";

const testRequestId = "11111111-1111-4111-8111-111111111111";
const testBranchId = "branch-crm-authorized";
const testStaffId = "staff-crm-1";

let mockUser: { id: string } | null = { id: "auth-user-1" };
let mockStaff: Record<string, unknown> | null = {
  id: testStaffId,
  branch_id: testBranchId,
  system_role: "crm",
};
let updatedRows: Array<{ id: string }> | null = [{ id: testRequestId }];
let updateError: { message: string } | null = null;
let lastEqCalls: Record<string, string> = {};

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { id: "auth-user-1" };
  mockStaff = {
    id: testStaffId,
    branch_id: testBranchId,
    system_role: "crm",
  };
  updatedRows = [{ id: testRequestId }];
  updateError = null;
  lastEqCalls = {};

  const staffQuery = {
    select: () => staffQuery,
    eq: () => staffQuery,
    maybeSingle: async () => ({ data: mockStaff, error: null }),
  };

  const waitlistUpdateQuery: Record<string, unknown> = {
    update: () => waitlistUpdateQuery,
    eq: (col: string, val: string) => {
      lastEqCalls[col] = val;
      return waitlistUpdateQuery;
    },
    select: async () => ({ data: updatedRows, error: updateError }),
  };

  mocks.createClient.mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user: mockUser } }),
    },
    from: (table: string) => {
      if (table === "staff") return staffQuery;
      if (table === "waitlist_requests") return waitlistUpdateQuery;
      throw new Error(`Unexpected table ${table}`);
    },
  });
});

describe("PERF-6 Waitlist status action server revalidation contract", () => {
  it("preserves /crm/waitlist and /crm/bookings revalidation and eliminates /crm/customers revalidation", async () => {
    const result = await updateWaitlistStatusAction({
      requestId: testRequestId,
      status: "contacted",
    });

    expect(result).toEqual({ ok: true });

    // Preserved revalidations
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/crm/waitlist");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/crm/bookings");

    // Eliminated redundant Customers revalidation path
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/crm/customers");

    // Branch scoping safety
    expect(lastEqCalls["id"]).toBe(testRequestId);
    expect(lastEqCalls["branch_id"]).toBe(testBranchId);
  });

  it("rejects unauthorized caller and does not trigger any revalidation", async () => {
    mockUser = null;

    const result = await updateWaitlistStatusAction({
      requestId: testRequestId,
      status: "contacted",
    });

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects invalid input schema and does not trigger any revalidation", async () => {
    const result = await updateWaitlistStatusAction({
      requestId: "not-a-uuid",
      status: "invalid-status",
    });

    expect(result.ok).toBe(false);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
