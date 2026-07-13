import { describe, expect, it } from "vitest";
import { attendanceDateBoundaryIso } from "@/lib/attendance/recent-scans-time";
import { mapRecentScan } from "@/lib/attendance/recent-scans-map";

describe("attendance activity boundaries and audit mapping", () => {
  it("converts a branch-local day to UTC boundaries", () => {
    expect(
      attendanceDateBoundaryIso("2026-07-13", "Asia/Manila")
    ).toBe("2026-07-12T16:00:00.000Z");
    expect(
      attendanceDateBoundaryIso("2026-07-13", "America/New_York", 1)
    ).toBe("2026-07-14T04:00:00.000Z");
  });

  it("keeps staff-less blocked attendance attempts in the activity model", () => {
    expect(
      mapRecentScan(
        {
          id: "event-1",
          branch_id: "branch-1",
          staff_id: null,
          action: "scan",
          outcome: "blocked",
          reason_code: "unknown_device",
          message: "No registered device cookie was found.",
          created_at: "2026-07-13T12:00:00.000Z",
        },
        {
          branchId: "branch-1",
          branchName: "Main Branch",
          timezone: "Asia/Manila",
        }
      )
    ).toMatchObject({
      staffId: null,
      staffName: "Unknown device",
      eventType: "scan",
      outcome: "blocked",
      reasonCode: "unknown_device",
    });
  });
});
