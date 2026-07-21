import type { BranchCorrectionReviewResult } from "./branch-correction-types";

type BranchCorrectionFailure = Extract<BranchCorrectionReviewResult, { ok: false }>;

export function mapBranchResolutionCode(
  code: string | null | undefined
): BranchCorrectionFailure {
  switch (code) {
    case "request_not_found":
    case "invalid_decision":
    case "unsupported_decision_type":
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "This branch correction request or decision is not valid.",
      };
    case "already_resolved":
    case "request_not_pending":
      return {
        ok: false,
        code: "NOT_PENDING",
        message: "This request already has a final decision. Refresh to see the latest result.",
      };
    case "not_authorized":
      return {
        ok: false,
        code: "UNAUTHORIZED",
        message: "You can only resolve requests for branches you manage.",
      };
    case "staff_inactive":
    case "stale_request":
    case "branch_state_changed":
      return {
        ok: false,
        code: "STALE_REQUEST",
        message: "The staff assignment changed or is no longer active. Refresh before retrying.",
      };
    case "inactive_branch":
      return {
        ok: false,
        code: "INACTIVE_BRANCH",
        message: "The source or scanned branch is not active.",
      };
    case "source_scan_unavailable":
      return {
        ok: false,
        code: "SOURCE_SCAN_UNAVAILABLE",
        message: "The original Attendance scan can no longer be resumed safely. Ask the staff member to scan again.",
      };
    case "scan_commit_missing":
    case "scan_commit_invalid":
    case "scan_commit_identity_mismatch":
      return {
        ok: false,
        code: "SOURCE_SCAN_UNAVAILABLE",
        message: "The original Attendance scan no longer matches this request. Ask the staff member to scan again.",
      };
    case "conflicting_temporary_authorization":
      return {
        ok: false,
        code: "CONFLICTING_AUTHORIZATION",
        message: "Another temporary branch authorization already covers this Attendance period.",
      };
    case "reason_required":
      return {
        ok: false,
        code: "REASON_REQUIRED",
        message: "Enter a short reason for this decision.",
      };
    case "test_mode_permanent_transfer_blocked":
      return {
        ok: false,
        code: "TEST_MODE_RESTRICTED",
        message: "Permanent staff transfers are disabled for Test Mode scans.",
      };
    case "invalid_validity":
      return {
        ok: false,
        code: "INVALID_VALIDITY",
        message: "The temporary branch authorization period is no longer valid. Refresh and try again.",
      };
    case "effective_date_required":
      return {
        ok: false,
        code: "EFFECTIVE_DATE_REQUIRED",
        message: "Choose a valid effective date for the permanent transfer.",
      };
    case "already_checked_in":
    case "already_checked_out":
    case "attendance_already_completed":
      return {
        ok: false,
        code: "ATTENDANCE_ALREADY_COMPLETED",
        message: "This Attendance action was already completed. Refresh to see the latest result.",
      };
    case "checkin_not_open":
    case "open_attendance_conflict":
      return {
        ok: false,
        code: "ATTENDANCE_CONFLICT",
        message: "Attendance changed while this request was being reviewed. Refresh and review the latest record.",
      };
    default:
      return {
        ok: false,
        code: "REVIEW_FAILED",
        message: "Branch resolution could not be completed. No changes were made. Please retry or contact system support.",
      };
  }
}
