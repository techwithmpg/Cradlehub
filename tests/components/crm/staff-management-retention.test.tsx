/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffManagementWorkspace } from "@/components/features/staff/staff-management-workspace";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";

vi.mock("@/components/features/staff/staff-stats-cards", () => ({ StaffStatsCards: () => null }));
vi.mock("@/components/features/staff/staff-empty-list", () => ({ StaffEmptyList: () => <div>No staff</div> }));
vi.mock("@/components/features/staff/staff-filter-bar", () => ({
  StaffFilterBar: ({ filters, onFiltersChange }: {
    filters: { search: string };
    onFiltersChange: (filters: Record<string, string>) => void;
  }) => (
    <input
      aria-label="Search staff"
      value={filters.search}
      onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
    />
  ),
}));
vi.mock("@/components/features/staff/staff-tabs", () => ({
  StaffTabs: ({ activeTab, onTabChange }: {
    activeTab: string;
    onTabChange: (tab: "active" | "pending") => void;
  }) => (
    <div>
      <button aria-pressed={activeTab === "active"} onClick={() => onTabChange("active")}>Active</button>
      <button aria-pressed={activeTab === "pending"} onClick={() => onTabChange("pending")}>Pending</button>
    </div>
  ),
}));
vi.mock("@/components/features/staff/staff-branch-section", () => ({
  StaffBranchSection: ({ group, selectedStaffId, onSelectStaff }: {
    group: { staff: StaffMember[] };
    selectedStaffId: string | null;
    onSelectStaff: (staff: StaffMember) => void;
  }) => (
    <div>
      {group.staff.map((staff) => (
        <button
          key={staff.id}
          aria-pressed={selectedStaffId === staff.id}
          onClick={() => onSelectStaff(staff)}
        >
          Select {staff.full_name}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("@/components/features/staff/staff-preview-panel", () => ({
  StaffPreviewPanel: ({ staff }: { staff: StaffMember | null }) => (
    <div data-testid="selected-staff">{staff?.full_name ?? "None"}</div>
  ),
}));

function staff(id: string, fullName: string): StaffMember {
  return {
    id,
    full_name: fullName,
    nickname: null,
    phone: null,
    branch_id: "branch-1",
    branches: { id: "branch-1", name: "Main Branch" },
    system_role: "staff",
    staff_type: "therapist",
    tier: "senior",
    is_active: true,
    auth_user_id: `auth-${id}`,
  } as StaffMember;
}

afterEach(cleanup);

describe("CRM staff retained interaction state", () => {
  it("preserves active tab, search, and selected staff while the edited row is patched", () => {
    const initial = [staff("staff-1", "Alpha Therapist"), staff("staff-2", "Beta Therapist")];
    const view = render(
      <StaffManagementWorkspace
        allStaff={initial}
        pendingStaff={[]}
        initialTab="active"
        workspaceContext="crm"
      />
    );

    fireEvent.change(screen.getByLabelText("Search staff"), { target: { value: "Alpha" } });
    fireEvent.click(screen.getByRole("button", { name: "Select Alpha Therapist" }));

    view.rerender(
      <StaffManagementWorkspace
        allStaff={[staff("staff-1", "Alpha Therapist Updated"), initial[1]!]}
        pendingStaff={[]}
        initialTab="active"
        workspaceContext="crm"
      />
    );

    expect((screen.getByLabelText("Search staff") as HTMLInputElement).value).toBe("Alpha");
    expect(screen.getByRole("button", { name: "Active" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("selected-staff").textContent).toBe("Alpha Therapist Updated");
  });
});
