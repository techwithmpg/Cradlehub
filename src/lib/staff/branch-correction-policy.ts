import { canonicalizeSystemRole } from "@/constants/staff";

const REVIEW_ALL_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
]);

const BRANCH_REVIEW_ROLES = new Set(["crm"]);

export type BranchCorrectionActor = {
  systemRole: string;
  branchId: string | null;
};

export function canReviewBranchCorrectionRequest(
  actor: BranchCorrectionActor,
  request: { requestedBranchId: string }
): boolean {
  const role = canonicalizeSystemRole(actor.systemRole);
  if (REVIEW_ALL_ROLES.has(role)) return true;
  return (
    BRANCH_REVIEW_ROLES.has(role) &&
    actor.branchId !== null &&
    actor.branchId === request.requestedBranchId
  );
}

export function canSeeAllBranchCorrectionRequests(systemRole: string): boolean {
  return REVIEW_ALL_ROLES.has(canonicalizeSystemRole(systemRole));
}

export function canRequestBranchCorrection(params: {
  staffIsActive: boolean;
  currentBranchId: string | null;
  requestedBranchId: string;
}): boolean {
  return (
    params.staffIsActive &&
    params.currentBranchId !== null &&
    params.currentBranchId !== params.requestedBranchId
  );
}
