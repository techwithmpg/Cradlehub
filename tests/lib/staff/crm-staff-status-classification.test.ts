import { describe, expect, it, vi } from "vitest";
import {
  getStaffStatus,
  getStaffStatusLabel,
  type StaffMember,
} from "@/components/features/staff/staff-management-utils";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  isDevAuthBypassEnabled: vi.fn(() => false),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/dev-bypass", () => ({
  isDevAuthBypassEnabled: mocks.isDevAuthBypassEnabled,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { toggleStaffActiveAction } from "@/app/(dashboard)/owner/staff/actions";

// Fixture 1: Mary Jean Luceño — Archived duplicate profile
const maryJeanArchived: StaffMember = {
  id: "1d43ec1e-54b4-4114-94bb-a82ed9c140a3",
  branch_id: "branch-sm",
  branches: { id: "branch-sm", name: "Cradle Wellness Living SM" },
  full_name: "Mary Jean Luceño",
  nickname: "Mary Jean",
  phone: "09171234567",
  auth_user_id: "auth-mj-old",
  is_active: false,
  archived_at: "2026-06-01T10:00:00Z",
  archive_reason: "Merged into primary active account",
  merged_into_staff_id: "staff-mj-active",
  is_cross_branch: false,
  is_head: false,
  staff_type: "therapist",
  system_role: "staff",
  tier: "junior",
  created_at: "2026-01-01T08:00:00Z",
  updated_at: "2026-06-01T10:00:00Z",
  identity_verified_at: "2026-01-02T08:00:00Z",
  temporary_access_expires_at: null,
  access_notes: null,
  avatar_path: null,
  avatar_url: null,
  metadata: {},
  workspace_access: ["staff"],
  has_submitted_onboarding: false,
  onboarding_request_status: "approved",
};

// Fixture 2: Mary Jean Luceño — Current active profile
const maryJeanActive: StaffMember = {
  id: "staff-mj-active",
  branch_id: "branch-sm",
  branches: { id: "branch-sm", name: "Cradle Wellness Living SM" },
  full_name: "Mary Jean Luceño",
  nickname: "Mary Jean",
  phone: "09171234567",
  auth_user_id: "auth-mj-current",
  is_active: true,
  archived_at: null,
  archive_reason: null,
  merged_into_staff_id: null,
  is_cross_branch: false,
  is_head: false,
  staff_type: "therapist",
  system_role: "staff",
  tier: "mid",
  created_at: "2026-06-01T10:00:00Z",
  updated_at: "2026-06-01T10:00:00Z",
  identity_verified_at: "2026-06-01T10:00:00Z",
  temporary_access_expires_at: null,
  access_notes: null,
  avatar_path: null,
  avatar_url: null,
  metadata: {},
  workspace_access: ["staff"],
  has_submitted_onboarding: false,
  onboarding_request_status: null,
};

// Fixture 3: Ma. Lovina Israel — Inactive approved staff member
const maLovinaInactive: StaffMember = {
  id: "0422dd81-4356-41f6-9128-ed9cf233c30b",
  branch_id: "branch-sm",
  branches: { id: "branch-sm", name: "Cradle Wellness Living SM" },
  full_name: "Ma. Lovina Israel",
  nickname: "Lovina",
  phone: "09181234567",
  auth_user_id: "auth-lovina-123",
  is_active: false,
  archived_at: null,
  archive_reason: null,
  merged_into_staff_id: null,
  is_cross_branch: false,
  is_head: false,
  staff_type: "therapist",
  system_role: "staff",
  tier: "senior",
  created_at: "2026-02-15T08:00:00Z",
  updated_at: "2026-07-01T08:00:00Z",
  identity_verified_at: "2026-02-16T08:00:00Z",
  temporary_access_expires_at: null,
  access_notes: null,
  avatar_path: null,
  avatar_url: null,
  metadata: {},
  workspace_access: ["staff"],
  has_submitted_onboarding: false,
  onboarding_request_status: "approved",
};

// Fixture 4: Ma. Theresa Dela Cruz — Retired SM duplicate
const maTheresaArchivedSM: StaffMember = {
  id: "b24c64a0-ace4-4f9f-bd29-f1f02da51373",
  branch_id: "branch-sm",
  branches: { id: "branch-sm", name: "Cradle Wellness Living SM" },
  full_name: "Ma. Theresa Dela Cruz",
  nickname: "Theresa",
  phone: "09191234567",
  auth_user_id: "auth-theresa-old",
  is_active: false,
  archived_at: "2026-05-10T12:00:00Z",
  archive_reason: "Transferred and merged into Main Spa profile",
  merged_into_staff_id: "2a44db7e-55e0-47f2-b560-e6c0e9e37ea7",
  is_cross_branch: false,
  is_head: false,
  staff_type: "therapist",
  system_role: "staff",
  tier: "junior",
  created_at: "2026-01-10T08:00:00Z",
  updated_at: "2026-05-10T12:00:00Z",
  identity_verified_at: "2026-01-11T08:00:00Z",
  temporary_access_expires_at: null,
  access_notes: null,
  avatar_path: null,
  avatar_url: null,
  metadata: {},
  workspace_access: ["staff"],
  has_submitted_onboarding: false,
  onboarding_request_status: "approved",
};

// Fixture 5: Ma. Theresa Dela Cruz — Active Main Spa profile
const maTheresaActiveMainSpa: StaffMember = {
  id: "2a44db7e-55e0-47f2-b560-e6c0e9e37ea7",
  branch_id: "branch-main",
  branches: { id: "branch-main", name: "Cradle Wellness Living Main Spa" },
  full_name: "Ma. Theresa Dela Cruz",
  nickname: "Theresa",
  phone: "09191234567",
  auth_user_id: "auth-theresa-main",
  is_active: true,
  archived_at: null,
  archive_reason: null,
  merged_into_staff_id: null,
  is_cross_branch: false,
  is_head: false,
  staff_type: "therapist",
  system_role: "staff",
  tier: "mid",
  created_at: "2026-05-10T12:00:00Z",
  updated_at: "2026-05-10T12:00:00Z",
  identity_verified_at: "2026-05-10T12:00:00Z",
  temporary_access_expires_at: null,
  access_notes: null,
  avatar_path: null,
  avatar_url: null,
  metadata: {},
  workspace_access: ["staff"],
  has_submitted_onboarding: false,
  onboarding_request_status: null,
};

// Fixture 6: Unclaimed invited staff member (link generated, no auth account)
const invitedStaff: StaffMember = {
  id: "staff-invited-1",
  branch_id: "branch-sm",
  branches: { id: "branch-sm", name: "Cradle Wellness Living SM" },
  full_name: "Pending Invitation",
  nickname: null,
  phone: null,
  auth_user_id: null,
  is_active: false,
  archived_at: null,
  archive_reason: null,
  merged_into_staff_id: null,
  is_cross_branch: false,
  is_head: false,
  staff_type: "therapist",
  system_role: "staff",
  tier: "junior",
  created_at: "2026-07-20T08:00:00Z",
  updated_at: "2026-07-20T08:00:00Z",
  identity_verified_at: null,
  temporary_access_expires_at: null,
  access_notes: null,
  avatar_path: null,
  avatar_url: null,
  metadata: {},
  workspace_access: ["staff"],
  has_submitted_onboarding: false,
  onboarding_request_status: null,
};

// Fixture 7: New applicant with submitted onboarding request awaiting authorized review
const applicantAwaitingReview: StaffMember = {
  id: "staff-applicant-1",
  branch_id: "branch-sm",
  branches: { id: "branch-sm", name: "Cradle Wellness Living SM" },
  full_name: "Jane Applicant",
  nickname: "Jane",
  phone: "09201234567",
  auth_user_id: "auth-applicant-1",
  is_active: false,
  archived_at: null,
  archive_reason: null,
  merged_into_staff_id: null,
  is_cross_branch: false,
  is_head: false,
  staff_type: "therapist",
  system_role: "staff",
  tier: "junior",
  created_at: "2026-07-25T08:00:00Z",
  updated_at: "2026-07-25T08:00:00Z",
  identity_verified_at: null,
  temporary_access_expires_at: null,
  access_notes: null,
  avatar_path: null,
  avatar_url: null,
  metadata: {},
  workspace_access: ["staff"],
  has_submitted_onboarding: true,
  onboarding_request_status: "submitted",
};

describe("P1 CRM Staff Status Classification & Operational Correctness", () => {
  describe("getStaffStatus & getStaffStatusLabel", () => {
    it("1. classifies active staff as 'active'", () => {
      expect(getStaffStatus(maryJeanActive)).toBe("active");
      expect(getStaffStatusLabel("active")).toBe("Active");

      expect(getStaffStatus(maTheresaActiveMainSpa)).toBe("active");
    });

    it("2. classifies actual submitted onboarding request awaiting review as 'awaiting'", () => {
      expect(getStaffStatus(applicantAwaitingReview)).toBe("awaiting");
      expect(getStaffStatusLabel("awaiting")).toBe("Awaiting Approval");
    });

    it("3. does NOT classify inactive staff with approved onboarding as 'awaiting'", () => {
      // Ma. Lovina Israel has an approved onboarding request and is inactive
      expect(getStaffStatus(maLovinaInactive)).toBe("inactive");
      expect(getStaffStatus(maLovinaInactive)).not.toBe("awaiting");
      expect(getStaffStatusLabel(getStaffStatus(maLovinaInactive))).toBe("Inactive");
    });

    it("4. does NOT classify inactive staff with rejected onboarding as 'awaiting'", () => {
      const rejectedStaff: StaffMember = {
        ...maLovinaInactive,
        id: "staff-rejected-1",
        onboarding_request_status: "rejected",
        has_submitted_onboarding: false,
      };
      expect(getStaffStatus(rejectedStaff)).toBe("inactive");
      expect(getStaffStatus(rejectedStaff)).not.toBe("awaiting");
    });

    it("5. classifies archived and merged duplicates as 'archived', never pending or awaiting", () => {
      // Mary Jean Luceño old archived duplicate
      expect(getStaffStatus(maryJeanArchived)).toBe("archived");
      expect(getStaffStatus(maryJeanArchived)).not.toBe("awaiting");
      expect(getStaffStatusLabel(getStaffStatus(maryJeanArchived))).toBe("Archived");

      // Ma. Theresa Dela Cruz old SM duplicate
      expect(getStaffStatus(maTheresaArchivedSM)).toBe("archived");
      expect(getStaffStatus(maTheresaArchivedSM)).not.toBe("awaiting");
      expect(getStaffStatusLabel(getStaffStatus(maTheresaArchivedSM))).toBe("Archived");
    });

    it("6. classifies unclaimed staff invitations as 'invited'", () => {
      expect(getStaffStatus(invitedStaff)).toBe("invited");
      expect(getStaffStatusLabel("invited")).toBe("Invite Sent");

      const noAuthStaff: StaffMember = {
        ...maLovinaInactive,
        id: "staff-no-auth",
        auth_user_id: null,
      };
      expect(getStaffStatus(noAuthStaff)).toBe("invited");
    });
  });

  describe("toggleStaffActiveAction Server Security", () => {
    function setupAuthMock(role: string, branchId: string, targetStaffRecord: Record<string, unknown> | null, updateResultData?: unknown[]) {
      const authUser = { id: "00000000-0000-4000-8000-000000000001" };
      const me = { id: "00000000-0000-4000-8000-000000000002", branch_id: branchId, system_role: role };

      const client = {
        auth: {
          getUser: vi.fn(async () => ({ data: { user: authUser }, error: null })),
        },
        from: vi.fn(() => {
          let hasQueriedMe = false;
          const chain: Record<string, unknown> = {};
          chain.select = vi.fn(() => chain);
          chain.update = vi.fn(() => chain);
          chain.eq = vi.fn((col: string) => {
            if (col === "auth_user_id") {
              hasQueriedMe = true;
            }
            return chain;
          });
          chain.is = vi.fn(() => chain);
          chain.limit = vi.fn(() => chain);
          chain.maybeSingle = vi.fn(async () => {
            if (hasQueriedMe) {
              return { data: me, error: null };
            }
            return { data: targetStaffRecord, error: null };
          });
          chain.single = vi.fn(async () => {
            if (hasQueriedMe) {
              return { data: me, error: null };
            }
            return { data: targetStaffRecord, error: null };
          });
          // For select after update:
          chain.then = (resolve: (value: unknown) => unknown) =>
            Promise.resolve({
              data: updateResultData ?? (targetStaffRecord ? [{ ...targetStaffRecord, is_active: true, updated_at: "2026-10-27T12:00:00Z" }] : []),
              error: null,
            }).then(resolve);

          return chain;
        }),
      };

      mocks.createClient.mockResolvedValue(client);
      return { client, me };
    }

    it("7. rejects reactivating archived profiles via toggleStaffActiveAction", async () => {
      const targetRecord = {
        id: maryJeanArchived.id,
        branch_id: "branch-sm",
        system_role: "staff",
        is_active: false,
        archived_at: maryJeanArchived.archived_at,
        merged_into_staff_id: maryJeanArchived.merged_into_staff_id,
      };

      setupAuthMock("crm", "branch-sm", targetRecord);

      const result = await toggleStaffActiveAction({
        staffId: maryJeanArchived.id,
        isActive: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/archived or merged staff profiles cannot be reactivated/i);
    });

    it("8. rejects activating staff when an onboarding request is awaiting review", async () => {
      const applicantId = "a1111111-1111-4111-8111-111111111111";
      const targetRecord = {
        id: applicantId,
        branch_id: "branch-sm",
        system_role: "staff",
        is_active: false,
        archived_at: null,
        merged_into_staff_id: null,
      };

      setupAuthMock("crm", "branch-sm", targetRecord);

      const adminChain: Record<string, unknown> = {};
      adminChain.select = vi.fn(() => adminChain);
      adminChain.eq = vi.fn(() => adminChain);
      adminChain.limit = vi.fn(() => adminChain);
      adminChain.maybeSingle = vi.fn(async () => ({
        data: { id: "req-1" },
        error: null,
      }));

      mocks.createAdminClient.mockReturnValue({
        from: vi.fn(() => adminChain),
      });

      const result = await toggleStaffActiveAction({
        staffId: applicantId,
        isActive: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/submitted onboarding request.*approve & activate/i);
    });

    it("9. enforces CRM branch scoping (rejects cross-branch activation)", async () => {
      const crossBranchStaffId = "b2222222-2222-4222-8222-222222222222";
      const targetRecord = {
        id: crossBranchStaffId,
        branch_id: "branch-main", // target belongs to branch-main
        system_role: "staff",
        is_active: false,
        archived_at: null,
        merged_into_staff_id: null,
      };

      setupAuthMock("crm", "branch-sm", targetRecord); // CRM actor is branch-sm

      const result = await toggleStaffActiveAction({
        staffId: crossBranchStaffId,
        isActive: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/only manage staff in your branch/i);
    });

    it("10. permits legitimate reactivation of non-archived inactive staff in authorized branch", async () => {
      const targetRecord = {
        id: maLovinaInactive.id,
        branch_id: "branch-sm",
        system_role: "staff",
        is_active: false,
        archived_at: null,
        merged_into_staff_id: null,
      };

      setupAuthMock("crm", "branch-sm", targetRecord, [
        { id: maLovinaInactive.id, is_active: true, updated_at: "2026-10-27T12:00:00Z" },
      ]);

      const adminChain: Record<string, unknown> = {};
      adminChain.select = vi.fn(() => adminChain);
      adminChain.eq = vi.fn(() => adminChain);
      adminChain.limit = vi.fn(() => adminChain);
      adminChain.maybeSingle = vi.fn(async () => ({
        data: null, // No submitted onboarding request
        error: null,
      }));

      mocks.createAdminClient.mockReturnValue({
        from: vi.fn(() => adminChain),
      });

      const result = await toggleStaffActiveAction({
        staffId: maLovinaInactive.id,
        isActive: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.staff.is_active).toBe(true);
      }
    });
  });
});
