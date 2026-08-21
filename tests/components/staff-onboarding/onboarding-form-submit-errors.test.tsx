/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submitStaffOnboardingAction: vi.fn(),
}));

vi.mock("@/app/staff-onboarding/actions", () => ({
  submitStaffOnboardingAction: mocks.submitStaffOnboardingAction,
}));

import { StaffOnboardingForm } from "@/app/staff-onboarding/onboarding-form";

const BRANCHES = [{ id: "branch-sm", name: "Cradle Wellness Living SM" }];

function clickContinue() {
  fireEvent.click(screen.getByRole("button", { name: /continue|review application/i }));
}

afterEach(() => {
  cleanup();
  mocks.submitStaffOnboardingAction.mockReset();
});

describe("StaffOnboardingForm submit errors", () => {
  it("shows server field errors instead of silently failing final submit", async () => {
    mocks.submitStaffOnboardingAction.mockResolvedValue({
      fieldErrors: {
        preferredRole: "This role is not available for onboarding.",
      },
    });

    render(<StaffOnboardingForm branches={BRANCHES} />);

    fireEvent.change(screen.getByLabelText(/access code/i), {
      target: { value: "staff-code" },
    });
    clickContinue();

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Sam Marketer" },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "sam@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: "+63 999 111 2222" },
    });
    clickContinue();

    fireEvent.click(screen.getByRole("button", { name: /social media \/ marketing/i }));
    fireEvent.click(screen.getByLabelText(/I confirm this is the branch where I normally work/i));
    clickContinue();
    clickContinue();
    clickContinue();

    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: "Password123!" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "Password123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /review application/i }));

    fireEvent.click(screen.getByLabelText(/I confirm that all information is accurate/i));
    fireEvent.click(screen.getByRole("button", { name: /submit application/i }));

    await waitFor(() => {
      expect(screen.getByText("This role is not available for onboarding.")).toBeTruthy();
    });
    expect(screen.getByText("Role & Branch")).toBeTruthy();
  });
});
