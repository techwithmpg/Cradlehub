/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/staff-onboarding/actions", () => ({
  approveOnboardingAction: vi.fn(),
  rejectOnboardingAction: vi.fn(),
}));

import { RequestCard } from "@/components/features/staff-onboarding/onboarding-review-list";

const BRANCHES = [
  { id: "branch-main", name: "Cradle Wellness Main Spa" },
  { id: "branch-sm", name: "Cradle Wellness Living SM" },
];

function makeRequest(overrides?: Partial<Parameters<typeof RequestCard>[0]["request"]>) {
  return {
    id: "req-1",
    full_name: "Maria Santos",
    email: "maria@example.com",
    phone: "+63 999 123 4567",
    address: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    experience_notes: null,
    preferred_role: "therapist",
    requested_branch_id: "branch-main",
    auth_user_id: null,
    staff_id: "staff-1",
    status: "submitted",
    reviewed_by_staff_id: null,
    reviewed_at: null,
    rejection_reason: null,
    metadata: {
      applicant_selected_branch_id: "branch-main",
      applicant_selected_branch_name: "Cradle Wellness Main Spa",
    },
    created_at: "2026-07-09T00:00:00Z",
    updated_at: "2026-07-09T00:00:00Z",
    ...overrides,
  } as Parameters<typeof RequestCard>[0]["request"];
}

afterEach(() => cleanup());

describe("OnboardingReviewList RequestCard branch display", () => {
  it("shows the requested branch name in the details grid", () => {
    render(
      <RequestCard
        request={makeRequest()}
        branches={BRANCHES}
        reviewerSystemRole="owner"
        reviewerBranchId="branch-main"
      />
    );

    fireEvent.click(screen.getByText("Maria Santos"));

    expect(screen.getByText("Requested branch")).toBeTruthy();
    expect(screen.getAllByText("Cradle Wellness Main Spa").length).toBeGreaterThan(0);
  });

  it("warns owner/manager when the approval branch is changed from the requested branch", () => {
    render(
      <RequestCard
        request={makeRequest()}
        branches={BRANCHES}
        reviewerSystemRole="owner"
        reviewerBranchId="branch-main"
      />
    );

    fireEvent.click(screen.getByText("Maria Santos"));

    const branchSelect = screen.getByTitle("Assign branch") as HTMLSelectElement;
    fireEvent.change(branchSelect, { target: { value: "branch-sm" } });

    expect(screen.getByText(/Branch change:/)).toBeTruthy();
    expect(screen.getByText(/instead of the requested/)).toBeTruthy();
  });

  it("locks the branch selector for CRM reviewers", () => {
    render(
      <RequestCard
        request={makeRequest()}
        branches={BRANCHES}
        reviewerSystemRole="crm"
        reviewerBranchId="branch-main"
      />
    );

    fireEvent.click(screen.getByText("Maria Santos"));

    const branchSelect = screen.getByTitle("Assign branch") as HTMLSelectElement;
    expect(branchSelect.disabled).toBe(true);
    expect(
      screen.getByText(/Only owners and managers can change the requested branch/)
    ).toBeTruthy();
  });
});
