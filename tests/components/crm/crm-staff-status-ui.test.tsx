// @vitest-environment jsdom

import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { StaffManagementWorkspace } from "@/components/features/staff/staff-management-workspace";
import { CrmStaffStatusTab } from "@/components/features/crm/staff/crm-staff-status-tab";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

// SM Branch active profile: Mary Jean Luceño
const maryJeanActive: StaffMember = {
  id: "staff-mj-active",
  branch_id: "branch-sm",
  branches: { id: "branch-sm", name: "Cradle Wellness Living SM" },
  full_name: "Mary Jean Luceño",
  nickname: "Mary Jean",
  phone: "09171234567",
  auth_user_id: "auth-mj-active",
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

// SM Branch inactive staff: Ma. Lovina Israel
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

// SM Branch archived duplicate: Mary Jean Luceño old profile
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

// SM Branch retired duplicate: Ma. Theresa Dela Cruz old SM profile
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

describe("CRM Staff UI Classification and Roster Consistency", () => {
  describe("StaffManagementWorkspace with SM Branch data", () => {
    it("1. displays active staff under Active Staff tab and correctly calculates tab counts", () => {
      render(
        <StaffManagementWorkspace
          allStaff={[maryJeanActive]}
          pendingStaff={[maLovinaInactive, maryJeanArchived, maTheresaArchivedSM]}
          initialTab="active"
          workspaceContext="crm"
        />
      );

      // Active Staff tab button should show (1)
      expect(screen.getByRole("tab", { name: /active staff \(1\)/i })).toBeTruthy();

      // Pending tab button should show (0) because neither Ma. Lovina (inactive) nor archived accounts are pending!
      expect(screen.getByRole("tab", { name: /pending \(0\)/i })).toBeTruthy();

      // Inactive tab button should show (1) for Ma. Lovina Israel
      expect(screen.getByRole("tab", { name: /inactive \(1\)/i })).toBeTruthy();

      // Mary Jean active should be displayed in the active list
      expect(screen.getAllByText(/Mary Jean Luceño/).length).toBeGreaterThan(0);
    });

    it("2. displays Ma. Lovina Israel under Inactive tab with Inactive status", () => {
      render(
        <StaffManagementWorkspace
          allStaff={[maryJeanActive]}
          pendingStaff={[maLovinaInactive, maryJeanArchived, maTheresaArchivedSM]}
          initialTab="inactive"
          workspaceContext="crm"
        />
      );

      // Ma. Lovina Israel should be visible
      expect(screen.getAllByText(/Ma\. Lovina Israel/).length).toBeGreaterThan(0);

      // Should have Inactive badge, NOT Awaiting Approval
      expect(screen.getAllByText("Inactive").length).toBeGreaterThan(0);
      expect(screen.queryByText("Awaiting Approval")).toBeNull();
    });

    it("3. does NOT show inactive or archived staff in the Pending tab", () => {
      render(
        <StaffManagementWorkspace
          allStaff={[maryJeanActive]}
          pendingStaff={[maLovinaInactive, maryJeanArchived, maTheresaArchivedSM]}
          initialTab="pending"
          workspaceContext="crm"
        />
      );

      // Pending tab should be empty ("No pending staff")
      expect(screen.getByText(/no pending staff/i)).toBeTruthy();

      // Ma. Lovina, Mary Jean archived, and Ma. Theresa archived must NOT appear in the table
      expect(screen.queryByText(/Ma\. Lovina Israel/)).toBeNull();
    });

    it("4. Stats cards accurately report 0 awaiting approval for SM branch", () => {
      render(
        <StaffManagementWorkspace
          allStaff={[maryJeanActive]}
          pendingStaff={[maLovinaInactive, maryJeanArchived, maTheresaArchivedSM]}
          initialTab="active"
          workspaceContext="crm"
        />
      );

      // The "Pending Approval" stat card should show 0, not 2 or 3
      const pendingApprovalLabel = screen.getByText("Pending Approval");
      const statContainer = pendingApprovalLabel.closest("div");
      expect(statContainer?.textContent).toContain("0");
    });

    it("5. Offers Activate action (not Approve Staff) for inactive staff in CRM preview", () => {
      const onToggleActive = vi.fn();
      render(
        <StaffManagementWorkspace
          allStaff={[maryJeanActive]}
          pendingStaff={[maLovinaInactive]}
          initialTab="inactive"
          workspaceContext="crm"
          onToggleActive={onToggleActive}
        />
      );

      // Select Ma. Lovina (first match is the table row button)
      const lovinaRowBtn = screen.getAllByText(/Ma\. Lovina Israel/)[0];
      expect(lovinaRowBtn).toBeDefined();
      fireEvent.click(lovinaRowBtn!);

      // In the preview panel, "Activate" should be visible
      const activateBtn = screen.getByRole("button", { name: /activate/i });
      expect(activateBtn).toBeTruthy();

      // "Approve Staff" should NOT be present
      expect(screen.queryByRole("link", { name: /approve staff/i })).toBeNull();

      fireEvent.click(activateBtn);
      expect(onToggleActive).toHaveBeenCalledWith(
        expect.objectContaining({ id: maLovinaInactive.id })
      );
    });
  });

  describe("CrmStaffStatusTab with SM Branch data", () => {
    it("6. computes exact KPIs without inflation from archived duplicates", () => {
      render(
        <CrmStaffStatusTab
          allStaff={[maryJeanActive]}
          pendingStaff={[maLovinaInactive, maryJeanArchived, maTheresaArchivedSM]}
        />
      );

      // Total Staff should be 2 (Mary Jean active + Ma. Lovina inactive)
      // Active should be 1
      // Awaiting Approval should be 0
      // Invites Sent should be 0
      // Inactive should be 1
      const totalStaffCard = screen.getByText("Total Staff").closest("div");
      expect(totalStaffCard?.textContent).toContain("2");

      const activeCard = screen.getByText("Active").closest("div");
      expect(activeCard?.textContent).toContain("1");

      const awaitingCard = screen.getByText("Awaiting Approval").closest("div");
      expect(awaitingCard?.textContent).toContain("0");

      const invitesCard = screen.getByText("Invites Sent").closest("div");
      expect(invitesCard?.textContent).toContain("0");

      const inactiveCard = screen.getByText("Inactive").closest("div");
      expect(inactiveCard?.textContent).toContain("1");
    });
  });
});
