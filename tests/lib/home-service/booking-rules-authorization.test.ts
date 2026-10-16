import { beforeEach, describe, expect, it, vi } from "vitest";

const BRANCH_MAIN_ID = "11111111-1111-4111-8111-111111111111";
const BRANCH_SM_ID = "22222222-2222-4222-8222-222222222222";
const BRANCH_SPOOFED_ID = "33333333-3333-4333-8333-333333333333";

const mocks = vi.hoisted(() => ({
  user: { id: "test-user-id" } as { id: string } | null,
  staff: {
    id: "staff-1",
    branch_id: "11111111-1111-4111-8111-111111111111",
    system_role: "front_desk",
    is_active: true,
  } as {
    id: string;
    branch_id: string;
    system_role: string;
    is_active: boolean;
  } | null,
  upsertResult: {
    data: {
      id: "rules-1",
      branch_id: "11111111-1111-4111-8111-111111111111",
      in_spa_start_time: "09:00:00",
      in_spa_end_time: "21:00:00",
      home_service_enabled: true,
      home_service_start_time: "09:00:00",
      home_service_end_time: "20:00:00",
      travel_buffer_mins: 30,
      max_advance_booking_days: 30,
      home_service_driver_capacity: 2,
      home_service_base_fee: 100,
      home_service_free_km: 1,
      home_service_extra_km_fee: 40,
      created_at: "2026-10-16T00:00:00Z",
      updated_at: "2026-10-16T00:00:00Z",
    },
    error: null,
  },
  lastUpsertPayload: null as unknown,
  revalidatedTags: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/dev-bypass", () => ({
  isDevAuthBypassEnabled: () => false,
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: (tag: string) => {
    mocks.revalidatedTags.push(tag);
  },
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock("@/lib/cache/cache-tags", () => ({
  cacheTags: {
    branchBookingRules: (id: string) => `rules:${id}`,
    branchServices: (id: string) => `services:${id}`,
    branchAssignableServices: (id: string) => `assignable:${id}`,
  },
  invalidateTag: vi.fn(),
  invalidateCrmWorkspace: vi.fn(),
  invalidateManagerWorkspace: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      update: () => ({
        eq: () => ({
          eq: async () => ({ error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: mocks.user },
      }),
    },
    from: (table: string) => {
      if (table === "staff") {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({ data: mocks.staff }),
        };
        return query;
      }
      if (table === "branch_booking_rules") {
        return {
          upsert: (payload: unknown) => {
            mocks.lastUpsertPayload = payload;
            return {
              select: () => ({
                single: async () => mocks.upsertResult,
              }),
            };
          },
        };
      }
      return {};
    },
  }),
}));

import { updateBranchBookingRules } from "@/lib/queries/branch-booking-rules";
import { updateBranchBookingRulesAction } from "@/app/(dashboard)/owner/branches/actions";

describe("updateBranchBookingRules server mutation authorization boundary", () => {
  const validPayload = {
    branchId: BRANCH_MAIN_ID,
    inSpaStartTime: "09:00",
    inSpaEndTime: "21:00",
    homeServiceEnabled: true,
    homeServiceStartTime: "09:00",
    homeServiceEndTime: "20:00",
    travelBufferMins: 30,
    maxAdvanceBookingDays: 30,
    homeServiceDriverCapacity: 2,
    homeServiceBaseFee: 100,
    homeServiceFreeKm: 1,
    homeServiceExtraKmFee: 40,
  };

  beforeEach(() => {
    mocks.user = { id: "test-user-id" };
    mocks.staff = {
      id: "staff-1",
      branch_id: BRANCH_MAIN_ID,
      system_role: "crm",
      is_active: true,
    };
    mocks.lastUpsertPayload = null;
    mocks.revalidatedTags = [];
  });

  it("Owner can update an authorized branch", async () => {
    mocks.staff = {
      id: "owner-staff",
      branch_id: BRANCH_MAIN_ID,
      system_role: "owner",
      is_active: true,
    };

    const result = await updateBranchBookingRules(validPayload);
    expect(result.success).toBe(true);
    expect(mocks.lastUpsertPayload).toMatchObject({
      branch_id: BRANCH_MAIN_ID,
      home_service_base_fee: 100,
      home_service_free_km: 1,
      home_service_extra_km_fee: 40,
    });
  });

  it("Owner can update across branches (e.g. branch-sm)", async () => {
    mocks.staff = {
      id: "owner-staff",
      branch_id: BRANCH_MAIN_ID,
      system_role: "owner",
      is_active: true,
    };

    const smPayload = { ...validPayload, branchId: BRANCH_SM_ID };
    const result = await updateBranchBookingRules(smPayload);
    expect(result.success).toBe(true);
    expect(mocks.lastUpsertPayload).toMatchObject({
      branch_id: BRANCH_SM_ID,
    });
  });

  it("CRM clerk can update their own branch (branch-main)", async () => {
    mocks.staff = {
      id: "clerk-main",
      branch_id: BRANCH_MAIN_ID,
      system_role: "crm",
      is_active: true,
    };

    const result = await updateBranchBookingRules(validPayload);
    expect(result.success).toBe(true);
    expect(mocks.lastUpsertPayload).toMatchObject({
      branch_id: BRANCH_MAIN_ID,
    });
  });

  it("CRM clerk cannot update another branch (branch-sm)", async () => {
    mocks.staff = {
      id: "clerk-main",
      branch_id: BRANCH_MAIN_ID,
      system_role: "crm",
      is_active: true,
    };

    const smPayload = { ...validPayload, branchId: BRANCH_SM_ID };
    const result = await updateBranchBookingRules(smPayload);
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mocks.lastUpsertPayload).toBeNull();
  });

  it("client-supplied branch ID cannot override authenticated staff.branch_id", async () => {
    mocks.staff = {
      id: "clerk-main",
      branch_id: BRANCH_MAIN_ID,
      system_role: "crm",
      is_active: true,
    };

    // Client maliciously attempts to tamper with branchId to target a different branch
    const spoofedPayload = { ...validPayload, branchId: BRANCH_SPOOFED_ID };
    const result = await updateBranchBookingRulesAction(spoofedPayload);
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mocks.lastUpsertPayload).toBeNull();
  });

  it("unauthorized staff roles (therapist, driver, utility) are rejected", async () => {
    const unauthorizedRoles = ["therapist", "driver", "utility", "client", "guest"];

    for (const role of unauthorizedRoles) {
      mocks.staff = {
        id: `staff-${role}`,
        branch_id: BRANCH_MAIN_ID,
        system_role: role,
        is_active: true,
      };

      const result = await updateBranchBookingRules(validPayload);
      expect(result).toEqual({ success: false, error: "Unauthorized" });
      expect(mocks.lastUpsertPayload).toBeNull();
    }
  });

  it("unauthenticated user is rejected", async () => {
    mocks.user = null;
    mocks.staff = null;

    const result = await updateBranchBookingRules(validPayload);
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(mocks.lastUpsertPayload).toBeNull();
  });
});
