/** @vitest-environment jsdom */

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffPreviewPanel } from "@/components/features/staff/staff-preview-panel";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: () => null,
  DropdownMenuContent: () => null,
  DropdownMenuItem: () => null,
}));

vi.mock("@/components/features/staff/staff-account-access-panel", () => ({
  StaffAccountAccessPanel: ({ staffId }: { staffId: string }) => (
    <div data-testid="owner-account-diagnostics">{staffId}</div>
  ),
}));

afterEach(cleanup);

function staff(): StaffMember {
  return {
    id: "staff-1",
    full_name: "Test Therapist",
    nickname: null,
    email: "example@example.test",
    phone: null,
    avatar_url: null,
    branch_id: "branch-1",
    branches: { id: "branch-1", name: "Main Spa" },
    system_role: "staff",
    staff_type: "therapist",
    tier: "junior",
    is_head: false,
    is_active: true,
    auth_user_id: "user-1",
    created_at: "2026-10-01T08:00:00Z",
  } as StaffMember;
}

describe("unified staff profile", () => {
  it("shows verified CRM service assignments and uses the existing edit callback", () => {
    const onManageServices = vi.fn();
    render(
      <StaffPreviewPanel
        staff={staff()}
        onClearSelection={vi.fn()}
        workspaceContext="crm"
        serviceNames={["Swedish Massage", "Foot Spa"]}
        onManageServices={onManageServices}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "services" }));
    expect(screen.getByText("Swedish Massage")).toBeTruthy();
    expect(screen.getByText("Foot Spa")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Edit services/i }));
    expect(onManageServices).toHaveBeenCalledOnce();
    expect(onManageServices).toHaveBeenCalledWith(expect.objectContaining({ id: "staff-1" }));
  });

  it("does not expose Owner diagnostics in the CRM access view", () => {
    render(
      <StaffPreviewPanel
        staff={staff()}
        onClearSelection={vi.fn()}
        workspaceContext="crm"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "access" }));
    expect(screen.getByText("Workspace Access")).toBeTruthy();
    expect(screen.queryByTestId("owner-account-diagnostics")).toBeNull();
    expect(screen.getByText(/restricted to the Owner/i)).toBeTruthy();
  });

  it("keeps Owner account diagnostics behind the Access section", () => {
    render(
      <StaffPreviewPanel
        staff={staff()}
        onClearSelection={vi.fn()}
        workspaceContext="owner"
      />
    );
    expect(screen.queryByTestId("owner-account-diagnostics")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "access" }));
    expect(screen.getByTestId("owner-account-diagnostics").textContent).toBe("staff-1");
  });
});
