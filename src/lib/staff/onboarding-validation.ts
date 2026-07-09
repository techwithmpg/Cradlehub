/**
 * Pure validation helpers for staff onboarding submissions.
 *
 * These helpers are separated from the server action so the branching and
 * duplicate-check rules can be unit-tested without spinning up Supabase.
 */

export type ActiveBranch = { id: string; name: string };

export type OnboardingBranchValidationInput = {
  preferredBranchId: string;
  branchConfirmed: boolean;
  activeBranches: ActiveBranch[];
};

export type OnboardingBranchValidationSuccess = {
  ok: true;
  branch: ActiveBranch;
};

export type OnboardingBranchValidationFailure = {
  ok: false;
  fieldErrors: Record<string, string>;
};

export type OnboardingBranchValidationResult =
  | OnboardingBranchValidationSuccess
  | OnboardingBranchValidationFailure;

/**
 * Validate that the applicant explicitly selected an active branch and
 * confirmed it. Never falls back to a default branch.
 */
export function validateOnboardingBranch(
  input: OnboardingBranchValidationInput
): OnboardingBranchValidationResult {
  const fieldErrors: Record<string, string> = {};

  if (!input.preferredBranchId.trim()) {
    fieldErrors.preferredBranchId = "Please select the branch where you normally work.";
  }

  if (input.preferredBranchId.trim() && !input.branchConfirmed) {
    fieldErrors.branchConfirmed = "Please confirm this is the branch where you normally work.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  const branch = input.activeBranches.find((b) => b.id === input.preferredBranchId.trim());
  if (!branch) {
    return {
      ok: false,
      fieldErrors: {
        preferredBranchId: "Please select a valid active branch.",
      },
    };
  }

  return { ok: true, branch };
}

export type OnboardingMetadataInput = {
  serviceIds: string[];
  experienceNotes: string | null;
  nickname: string | null;
  branch: ActiveBranch;
};

export type DuplicateCheckInput = {
  email: string;
  phone: string;
  fullName: string;
};

export type ExistingDuplicates = {
  authEmails: string[];
  requestEmails: string[];
  activeStaffPhones: { full_name: string | null; phone: string | null }[];
  requestPhones: { full_name: string | null; phone: string | null }[];
};

export type DuplicateCheckResult = {
  emailDuplicate: boolean;
  phoneDuplicate: boolean;
  namePhoneDuplicate: boolean;
};

/**
 * Pure duplicate evaluation used by the server action. Separated so the rules
 * can be unit-tested without a Supabase connection.
 */
export function evaluateDuplicateCheck(
  input: DuplicateCheckInput,
  existing: ExistingDuplicates
): DuplicateCheckResult {
  const result: DuplicateCheckResult = {
    emailDuplicate: false,
    phoneDuplicate: false,
    namePhoneDuplicate: false,
  };

  const normalizedEmail = input.email.toLowerCase();

  if (existing.authEmails.some((e) => e.toLowerCase() === normalizedEmail)) {
    result.emailDuplicate = true;
    return result;
  }

  if (existing.requestEmails.some((e) => e.toLowerCase() === normalizedEmail)) {
    result.emailDuplicate = true;
    return result;
  }

  const matchingActivePhone = existing.activeStaffPhones.find(
    (s) => s.phone === input.phone
  );
  if (matchingActivePhone) {
    result.phoneDuplicate = true;
    if (matchingActivePhone.full_name === input.fullName) {
      result.namePhoneDuplicate = true;
    }
    return result;
  }

  const matchingRequestPhone = existing.requestPhones.find(
    (r) => r.phone === input.phone
  );
  if (matchingRequestPhone) {
    result.phoneDuplicate = true;
    if (matchingRequestPhone.full_name === input.fullName) {
      result.namePhoneDuplicate = true;
    }
    return result;
  }

  return result;
}

/**
 * Build the metadata object stored on staff_onboarding_requests.
 */
export function buildOnboardingMetadata(input: OnboardingMetadataInput): Record<string, unknown> {
  return {
    requested_service_ids: input.serviceIds.length > 0 ? input.serviceIds : [],
    profile_notes: input.experienceNotes,
    nickname: input.nickname,
    branch_confirmed: true,
    branch_confirmed_at: new Date().toISOString(),
    applicant_selected_branch_id: input.branch.id,
    applicant_selected_branch_name: input.branch.name,
  };
}
