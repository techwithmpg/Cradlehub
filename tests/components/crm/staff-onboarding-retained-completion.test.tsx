/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RequestCard } from "@/components/features/staff-onboarding/onboarding-review-list";
import { approveOnboardingAction, rejectOnboardingAction } from "@/app/staff-onboarding/actions";

vi.mock("@/app/staff-onboarding/actions", () => ({
  approveOnboardingAction: vi.fn(),
  rejectOnboardingAction: vi.fn(),
}));

vi.mock("@/lib/staff/approval-permissions", () => ({
  canApproveStaffOnboarding: () => ({
    allowed: true,
    assignableRoles: ["staff"],
  }),
}));

const request = {
  id: "request-1",
  staff_id: "11111111-1111-4111-8111-111111111111",
  full_name: "Therapist One",
  email: "therapist@example.com",
  phone: "09170000000",
  preferred_role: "therapist",
  requested_branch_id: "branch-a",
  metadata: {},
  status: "submitted",
  rejection_reason: null,
  experience_notes: null,
  address: null,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  created_at: "2026-10-18T00:00:00.000Z",
} as Parameters<typeof RequestCard>[0]["request"];

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("PERF-7 retained CRM onboarding completion", () => {
  it("uses the retained success callback after approval instead of requiring a page reload", async () => {
    const onRequestResolved = vi.fn();
    vi.mocked(approveOnboardingAction).mockResolvedValue({
      success: true,
    });

    render(
      <RequestCard
        request={request}
        branches={[{ id: "branch-a", name: "Main Branch" }]}
        reviewerSystemRole="crm"
        reviewerBranchId="branch-a"
        onRequestResolved={onRequestResolved}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Therapist One/i }));

    fireEvent.click(
      screen.getByRole("button", { name: "Approve & Activate" })
    );

    await waitFor(() =>
      expect(approveOnboardingAction).toHaveBeenCalledTimes(1)
    );
    await waitFor(() =>
      expect(onRequestResolved).toHaveBeenCalledWith("request-1")
    );
  });

  it("does not remove the request when rejection fails", async () => {
    const onRequestResolved = vi.fn();
    vi.mocked(rejectOnboardingAction).mockResolvedValue({
      success: false,
      error: "Rejected action failed",
    });

    render(
      <RequestCard
        request={request}
        branches={[{ id: "branch-a", name: "Main Branch" }]}
        reviewerSystemRole="crm"
        reviewerBranchId="branch-a"
        onRequestResolved={onRequestResolved}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Therapist One/i }));

    fireEvent.click(
      screen.getByRole("button", { name: "Reject Application" })
    );

    await waitFor(() =>
      expect(rejectOnboardingAction).toHaveBeenCalledTimes(1)
    );
    expect(onRequestResolved).not.toHaveBeenCalled();
    expect(
      screen.getByText("Rejected action failed")
    ).toBeTruthy();
  });
});
