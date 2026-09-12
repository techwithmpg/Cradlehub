import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/cache/cache-tags", () => ({
  invalidateCrmWorkspace: vi.fn(),
  invalidateManagerWorkspace: vi.fn(),
}));

const mockAdminClient = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdminClient,
}));

import {
  updateStaffProfileService,
  assignStaffRoleService,
  deactivateStaffService,
} from "@/lib/staff/staff-mutation-service";

describe("staff-mutation-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateStaffProfileService", () => {
    it("returns FORBIDDEN if actor is not an authorized operational role", async () => {
      const res = await updateStaffProfileService({
        actor: {
          staffId: "staff-actor",
          authUserId: "user-1",
          systemRole: "service_staff",
          branchId: "branch-main",
        },
        staffId: "staff-target",
        input: { fullName: "New Name" },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("FORBIDDEN");
      }
    });

    it("returns NOT_FOUND if target staff does not exist", async () => {
      mockAdminClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const res = await updateStaffProfileService({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        staffId: "staff-404",
        input: { fullName: "New Name" },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("NOT_FOUND");
      }
    });

    it("returns BRANCH_MISMATCH if manager attempts to update staff in another branch", async () => {
      mockAdminClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "staff-north",
                branch_id: "branch-north",
                system_role: "staff",
                is_active: true,
              },
              error: null,
            }),
          }),
        }),
      });

      const res = await updateStaffProfileService({
        actor: {
          staffId: "mgr-main",
          authUserId: "user-mgr",
          systemRole: "manager",
          branchId: "branch-main",
        },
        staffId: "staff-north",
        input: { fullName: "New Name" },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("BRANCH_MISMATCH");
      }
    });

    it("returns FORBIDDEN if non-owner attempts to edit sensitive staff profile", async () => {
      mockAdminClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "other-mgr",
                branch_id: "branch-main",
                system_role: "manager", // sensitive
                is_active: true,
              },
              error: null,
            }),
          }),
        }),
      });

      const res = await updateStaffProfileService({
        actor: {
          staffId: "mgr-main",
          authUserId: "user-mgr",
          systemRole: "crm",
          branchId: "branch-main",
        },
        staffId: "other-mgr",
        input: { fullName: "New Name" },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("FORBIDDEN");
      }
    });

    it("successfully updates staff profile with narrow schema", async () => {
      const updatedMock = {
        id: "staff-target",
        full_name: "Updated Name",
        nickname: "Nikki",
        phone: "+63 912 345 6789",
        tier: "senior",
        system_role: "staff",
        staff_type: "therapist",
        is_head: true,
        branch_id: "branch-main",
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      mockAdminClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "staff-target",
                branch_id: "branch-main",
                system_role: "staff",
                is_active: true,
              },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: updatedMock, error: null }),
            }),
          }),
        }),
      });

      const res = await updateStaffProfileService({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        staffId: "staff-target",
        input: {
          fullName: "Updated Name",
          nickname: "Nikki",
          tier: "senior",
          isHead: true,
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.staff.full_name).toBe("Updated Name");
        expect(res.data.staff.tier).toBe("senior");
      }
    });
  });

  describe("assignStaffRoleService", () => {
    it("returns FORBIDDEN if actor attempts to assign role outside their hierarchy", async () => {
      // Manager cannot assign "owner"
      const res = await assignStaffRoleService({
        actor: {
          staffId: "mgr-main",
          authUserId: "user-mgr",
          systemRole: "manager",
          branchId: "branch-main",
        },
        staffId: "staff-target",
        input: { systemRole: "owner" },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("FORBIDDEN");
      }
    });

    it("returns FORBIDDEN if actor attempts self-escalation / role modification", async () => {
      mockAdminClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "actor-self",
                branch_id: "branch-main",
                system_role: "manager",
                is_active: true,
              },
              error: null,
            }),
          }),
        }),
      });

      const res = await assignStaffRoleService({
        actor: {
          staffId: "actor-self",
          authUserId: "user-self",
          systemRole: "manager",
          branchId: "branch-main",
        },
        staffId: "actor-self",
        input: { systemRole: "staff" },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("FORBIDDEN");
        expect(res.error).toContain("cannot change your own system role");
      }
    });

    it("successfully assigns role to subordinate and adapts staff_type if digital_marketer", async () => {
      const updatedMock = {
        id: "staff-target",
        full_name: "Target Staff",
        nickname: null,
        phone: "+63 912 345 6789",
        tier: "mid",
        system_role: "digital_marketer",
        staff_type: "managerial",
        is_head: false,
        branch_id: "branch-main",
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: updatedMock, error: null }),
          }),
        }),
      });

      mockAdminClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "staff-target",
                branch_id: "branch-main",
                system_role: "staff",
                is_active: true,
              },
              error: null,
            }),
          }),
        }),
        update: updateMock,
      });

      const res = await assignStaffRoleService({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        staffId: "staff-target",
        input: { systemRole: "digital_marketer" },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.staff.system_role).toBe("digital_marketer");
        expect(res.data.staff.staff_type).toBe("managerial");
      }
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          system_role: "digital_marketer",
          staff_type: "managerial",
        })
      );
    });
  });

  describe("deactivateStaffService", () => {
    it("returns FORBIDDEN on self-deactivation attempt", async () => {
      mockAdminClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "self-id",
                branch_id: "branch-main",
                system_role: "manager",
                is_active: true,
              },
              error: null,
            }),
          }),
        }),
      });

      const res = await deactivateStaffService({
        actor: {
          staffId: "self-id",
          authUserId: "user-self",
          systemRole: "manager",
          branchId: "branch-main",
        },
        staffId: "self-id",
        input: { reason: "Leaving" },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("FORBIDDEN");
        expect(res.error).toContain("cannot deactivate your own account");
      }
    });

    it("returns BRANCH_MISMATCH if manager attempts to deactivate staff in another branch", async () => {
      mockAdminClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "staff-north",
                branch_id: "branch-north",
                system_role: "staff",
                is_active: true,
              },
              error: null,
            }),
          }),
        }),
      });

      const res = await deactivateStaffService({
        actor: {
          staffId: "mgr-main",
          authUserId: "user-mgr",
          systemRole: "manager",
          branchId: "branch-main",
        },
        staffId: "staff-north",
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("BRANCH_MISMATCH");
      }
    });

    it("successfully soft-deactivates staff without deleting row", async () => {
      const updatedMock = {
        id: "staff-target",
        is_active: false,
        updated_at: new Date().toISOString(),
        branch_id: "branch-main",
      };

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: updatedMock, error: null }),
          }),
        }),
      });

      mockAdminClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "staff-target",
                branch_id: "branch-main",
                system_role: "staff",
                is_active: true,
              },
              error: null,
            }),
          }),
        }),
        update: updateMock,
      });

      const res = await deactivateStaffService({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        staffId: "staff-target",
        input: { reason: "Resigned" },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.staff.is_active).toBe(false);
      }
      expect(updateMock).toHaveBeenCalledWith({ is_active: false });
    });
  });
});
