import { describe, expect, it } from "vitest";
import {
  buildAttendanceOverviewSummary,
  getAttendanceIssueRecommendation,
  getAttendanceOverviewStatus,
} from "@/lib/attendance/overview-summary";

function staffState(
  operationalStatus: Parameters<typeof getAttendanceOverviewStatus>[0]["operationalStatus"],
  displayLabel: string
) {
  return { operationalStatus, displayLabel };
}

describe("attendance overview summary", () => {
  it("classifies mutually exclusive daily staff states", () => {
    const summary = buildAttendanceOverviewSummary(
      [
        staffState("clocked_in", "Clocked In"),
        staffState("on_service", "In Service"),
        staffState("expected_later", "Expected Soon"),
        staffState("missing", "Late"),
        staffState("clocked_out", "Clocked Out"),
        staffState("needs_review", "Needs Review"),
        staffState("scan_captured", "Scan Captured"),
        staffState("not_expected", "Day Off"),
      ],
      [{ status: "open" }, { status: "resolved" }, { status: "open" }]
    );

    expect(summary).toEqual({
      onDuty: 2,
      notInYet: 2,
      completed: 1,
      needsReviewStaff: 2,
      reviewItems: 2,
      scheduledTotal: 7,
      offDuty: 1,
    });
  });

  it("keeps late staff in not-in-yet instead of review", () => {
    expect(getAttendanceOverviewStatus(staffState("missing", "Late"))).toEqual({
      key: "not_in_yet",
      label: "Late",
      tone: "warn",
    });
  });

  it("provides repair guidance by issue family", () => {
    expect(getAttendanceIssueRecommendation({ exception_type: "wrong_branch" })).toContain(
      "permanent branch"
    );
    expect(getAttendanceIssueRecommendation({ exception_type: "missing_schedule" })).toContain(
      "staff schedule"
    );
    expect(
      getAttendanceIssueRecommendation({ exception_type: "device_recovery_required" })
    ).toContain("recovery link");
  });
});
