import { describe, expect, it } from "vitest";

import {
  buildOnboardingMetadata,
  validateOnboardingBranch,
} from "@/lib/staff/onboarding-validation";

const BRANCHES = [
  { id: "branch-main", name: "Cradle Wellness Main Spa" },
  { id: "branch-sm", name: "Cradle Wellness Living SM" },
];

describe("validateOnboardingBranch", () => {
  it("rejects a missing branch", () => {
    const result = validateOnboardingBranch({
      preferredBranchId: "",
      branchConfirmed: false,
      activeBranches: BRANCHES,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
    expect(result.fieldErrors.preferredBranchId).toBe(
      "Please select the branch where you normally work."
    );
  });

  it("rejects a branch that the applicant did not confirm", () => {
    const result = validateOnboardingBranch({
      preferredBranchId: "branch-main",
      branchConfirmed: false,
      activeBranches: BRANCHES,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
    expect(result.fieldErrors.branchConfirmed).toBe(
      "Please confirm this is the branch where you normally work."
    );
  });

  it("rejects an inactive or unknown branch", () => {
    const result = validateOnboardingBranch({
      preferredBranchId: "branch-unknown",
      branchConfirmed: true,
      activeBranches: BRANCHES,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
    expect(result.fieldErrors.preferredBranchId).toBe(
      "Please select a valid active branch."
    );
  });

  it("returns the selected active branch", () => {
    const result = validateOnboardingBranch({
      preferredBranchId: "branch-sm",
      branchConfirmed: true,
      activeBranches: BRANCHES,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected success");
    expect(result.branch).toEqual({
      id: "branch-sm",
      name: "Cradle Wellness Living SM",
    });
  });
});

describe("buildOnboardingMetadata", () => {
  it("records branch confirmation and applicant-selected branch details", () => {
    const metadata = buildOnboardingMetadata({
      serviceIds: ["svc-1"],
      experienceNotes: "Previous spa experience",
      nickname: "Mia",
      branch: BRANCHES[0]!,
    });

    expect(metadata.requested_service_ids).toEqual(["svc-1"]);
    expect(metadata.profile_notes).toBe("Previous spa experience");
    expect(metadata.nickname).toBe("Mia");
    expect(metadata.branch_confirmed).toBe(true);
    expect(typeof metadata.branch_confirmed_at).toBe("string");
    expect(metadata.applicant_selected_branch_id).toBe("branch-main");
    expect(metadata.applicant_selected_branch_name).toBe(
      "Cradle Wellness Main Spa"
    );
  });
});
