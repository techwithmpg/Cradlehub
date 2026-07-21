import { describe, expect, it } from "vitest";

import { mapBranchResolutionCode } from "@/lib/staff/branch-correction-errors";

describe("branch correction resolution errors", () => {
  it.each([
    ["already_resolved", "NOT_PENDING"],
    ["not_authorized", "UNAUTHORIZED"],
    ["staff_inactive", "STALE_REQUEST"],
    ["inactive_branch", "INACTIVE_BRANCH"],
    ["conflicting_temporary_authorization", "CONFLICTING_AUTHORIZATION"],
    ["reason_required", "REASON_REQUIRED"],
    ["invalid_validity", "INVALID_VALIDITY"],
    ["effective_date_required", "EFFECTIVE_DATE_REQUIRED"],
    ["attendance_already_completed", "ATTENDANCE_ALREADY_COMPLETED"],
    ["open_attendance_conflict", "ATTENDANCE_CONFLICT"],
  ])("maps %s to %s", (rpcCode, expectedCode) => {
    expect(mapBranchResolutionCode(rpcCode).code).toBe(expectedCode);
  });

  it("tells the operator to rescan when source identity cannot be recovered", () => {
    const failure = mapBranchResolutionCode("source_scan_unavailable");

    expect(failure.code).toBe("SOURCE_SCAN_UNAVAILABLE");
    expect(failure.message).toContain("scan again");
  });

  it("keeps an unknown database failure sanitized", () => {
    expect(mapBranchResolutionCode("unexpected_live_database_failure")).toEqual({
      ok: false,
      code: "REVIEW_FAILED",
      message: "Branch resolution could not be completed. No changes were made. Please retry or contact system support.",
    });
  });
});
