import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  executeInhouseBookingCreation,
  type InhouseBookingOperator,
} from "@/lib/bookings/inhouse-booking-engine";
import * as branchRules from "@/lib/queries/branch-booking-rules";
import * as adminSupabase from "@/lib/supabase/admin";
import * as serviceCatalog from "@/lib/services/service-catalog";
import { DEFAULT_BRANCH_BOOKING_RULES } from "@/lib/validations/booking-rules";

vi.mock("@/lib/queries/branch-booking-rules", () => ({
  validateBookingAgainstBranchRules: vi.fn(),
  getBranchBookingRulesOrDefault: vi.fn(),
}));

vi.mock("@/lib/services/service-catalog", () => ({
  validateBranchServiceEligibility: vi.fn(),
  isConsultationOnlyService: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const BRANCH_AAA = "11111111-1111-1111-1111-111111111111";
const BRANCH_BBB = "22222222-2222-2222-2222-222222222222";
const SERVICE_ID_1 = "33333333-3333-3333-3333-333333333333";

describe("Inhouse Booking Engine Authorization & Branch Boundary", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("rejects non-owner operator attempting cross-branch booking before any DB mutation", async () => {
    const nonOwnerOperator: InhouseBookingOperator = {
      authUserId: "user-receptionist-1",
      staff: {
        id: "staff-rec-1",
        branch_id: BRANCH_AAA,
        system_role: "crm",
      },
      staffRole: "crm",
      isDevBypass: false,
    };

    const crossBranchPayload = {
      branchId: BRANCH_BBB, // Different branch from operator's assigned branch
      fullName: "Cross Branch Customer",
      phone: "09171234567",
      serviceIds: [SERVICE_ID_1],
      date: "2026-09-15",
      startTime: "10:00",
      type: "walkin",
    };

    const result = await executeInhouseBookingCreation(crossBranchPayload, nonOwnerOperator);

    expect(result).toEqual({
      ok: false,
      code: "CRM_BRANCH_FORBIDDEN",
      message: "You can only create bookings for your assigned branch.",
    });

    // Assert that NO downstream privileged domain operations occurred
    expect(branchRules.validateBookingAgainstBranchRules).not.toHaveBeenCalled();
    expect(serviceCatalog.validateBranchServiceEligibility).not.toHaveBeenCalled();
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects non-owner cross-branch booking even when DEV_AUTH_BYPASS=true because operator isDevBypass is false", async () => {
    process.env = {
      ...originalEnv,
      DEV_AUTH_BYPASS: "true",
      DEV_ALLOW_ALL_MODULES: "true",
      NODE_ENV: "development",
    };

    const nonOwnerOperator: InhouseBookingOperator = {
      authUserId: "user-receptionist-1",
      staff: {
        id: "staff-rec-1",
        branch_id: BRANCH_AAA,
        system_role: "crm",
      },
      staffRole: "crm",
      isDevBypass: false,
    };

    const crossBranchPayload = {
      branchId: BRANCH_BBB,
      fullName: "Cross Branch Customer",
      phone: "09171234567",
      serviceIds: [SERVICE_ID_1],
      date: "2026-09-15",
      startTime: "10:00",
      type: "walkin",
    };

    const result = await executeInhouseBookingCreation(crossBranchPayload, nonOwnerOperator);

    expect(result).toEqual({
      ok: false,
      code: "CRM_BRANCH_FORBIDDEN",
      message: "You can only create bookings for your assigned branch.",
    });

    expect(branchRules.validateBookingAgainstBranchRules).not.toHaveBeenCalled();
    expect(serviceCatalog.validateBranchServiceEligibility).not.toHaveBeenCalled();
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });

  it("allows non-owner operator to proceed when targeting their assigned branch", async () => {
    const nonOwnerOperator: InhouseBookingOperator = {
      authUserId: "user-receptionist-1",
      staff: {
        id: "staff-rec-1",
        branch_id: BRANCH_AAA,
        system_role: "crm",
      },
      staffRole: "crm",
      isDevBypass: false,
    };

    vi.mocked(branchRules.validateBookingAgainstBranchRules).mockResolvedValueOnce({
      ok: false,
      message: "The selected time is outside branch booking hours.",
      rules: {
        branchId: BRANCH_AAA,
        ...DEFAULT_BRANCH_BOOKING_RULES,
      },
    });

    const sameBranchPayload = {
      branchId: BRANCH_AAA,
      fullName: "Same Branch Customer",
      phone: "09171234567",
      serviceIds: [SERVICE_ID_1],
      date: "2026-09-15",
      startTime: "10:00",
      type: "walkin",
    };

    const result = await executeInhouseBookingCreation(sameBranchPayload, nonOwnerOperator);

    // Confirms it proceeded past the branch check and reached branch rules validation
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("BOOKING_RULES_ERROR");
    }
    expect(branchRules.validateBookingAgainstBranchRules).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: BRANCH_AAA,
      })
    );
  });

  it("allows owner operator to target explicit different branch (cross-branch authorized)", async () => {
    const ownerOperator: InhouseBookingOperator = {
      authUserId: "user-owner-1",
      staff: {
        id: "staff-owner-1",
        branch_id: BRANCH_AAA,
        system_role: "owner",
      },
      staffRole: "owner",
      isDevBypass: false,
    };

    vi.mocked(branchRules.validateBookingAgainstBranchRules).mockResolvedValueOnce({
      ok: false,
      message: "The selected time is outside branch booking hours.",
      rules: {
        branchId: BRANCH_BBB,
        ...DEFAULT_BRANCH_BOOKING_RULES,
      },
    });

    const explicitTargetBranchPayload = {
      branchId: BRANCH_BBB, // Different branch than owner's default
      fullName: "VIP Client",
      phone: "09171234567",
      serviceIds: [SERVICE_ID_1],
      date: "2026-09-15",
      startTime: "10:00",
      type: "walkin",
    };

    const result = await executeInhouseBookingCreation(explicitTargetBranchPayload, ownerOperator);

    // Confirms owner is NOT blocked by CRM_BRANCH_FORBIDDEN
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("BOOKING_RULES_ERROR");
    }
    expect(branchRules.validateBookingAgainstBranchRules).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: BRANCH_BBB,
      })
    );
  });

  it("denies execution when operator lacks CRM permission", async () => {
    const unauthorizedOperator: InhouseBookingOperator = {
      authUserId: "user-staff-1",
      staff: {
        id: "staff-therapist-1",
        branch_id: BRANCH_AAA,
        system_role: "staff",
      },
      staffRole: "staff",
      isDevBypass: false,
    };

    const payload = {
      branchId: BRANCH_AAA,
      fullName: "Guest Customer",
      phone: "09171234567",
      serviceIds: [SERVICE_ID_1],
      date: "2026-09-15",
      startTime: "10:00",
      type: "walkin",
    };

    const result = await executeInhouseBookingCreation(payload, unauthorizedOperator);

    expect(result).toEqual({
      ok: false,
      code: "UNAUTHORIZED",
      message: "You do not have permission to create bookings.",
    });
    expect(branchRules.validateBookingAgainstBranchRules).not.toHaveBeenCalled();
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });

  it("denies execution when branch is missing from both input and staff profile", async () => {
    const unassignedOperator: InhouseBookingOperator = {
      authUserId: "user-crm-no-branch",
      staff: {
        id: "staff-crm-1",
        branch_id: null,
        system_role: "crm",
      },
      staffRole: "crm",
      isDevBypass: false,
    };

    const payloadWithoutBranch = {
      fullName: "Guest Customer",
      phone: "09171234567",
      serviceIds: [SERVICE_ID_1],
      date: "2026-09-15",
      startTime: "10:00",
      type: "walkin",
    };

    const result = await executeInhouseBookingCreation(payloadWithoutBranch, unassignedOperator);

    expect(result).toEqual({
      ok: false,
      code: "BRANCH_MISSING",
      message: "You are not assigned to a branch. Please contact an administrator.",
    });
    expect(branchRules.validateBookingAgainstBranchRules).not.toHaveBeenCalled();
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });
});
