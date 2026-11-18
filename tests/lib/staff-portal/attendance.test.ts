import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { deriveStaffAttendanceReviewState, portalAvailabilityCopy } from "@/lib/staff-portal/attendance";

describe("staff attendance review labels", () => {
  it("keeps raw exception metadata out of the staff label", () => {
    expect(deriveStaffAttendanceReviewState({ status: "checked_out", attendance_status: "exception", exception_state: "late_arrival_unverified" })).toEqual({
      state: "review",
      label: "Needs CRM review",
    });
  });

  it("distinguishes an open shift from a completed clear record", () => {
    expect(deriveStaffAttendanceReviewState({ status: "checked_in", attendance_status: "present", exception_state: null })).toEqual({ state: "open", label: "Shift in progress" });
    expect(deriveStaffAttendanceReviewState({ status: "checked_out", attendance_status: "present", exception_state: "clear" })).toEqual({ state: "clear", label: "Attendance recorded" });
  });

  it("explains open cash session custody holds clearly for portal clock-out", () => {
    expect(
      portalAvailabilityCopy({
        code: "open_cash_session",
        eligible: false,
        expectedClockOutAt: "2026-11-18T14:00:00.000Z",
        nextAssignmentAt: null,
      })
    ).toEqual({
      enabled: false,
      code: "open_cash_session",
      label: "Close cash session first",
      message: "Close or hand over your open cash session before clocking out.",
      expectedClockOutAt: "2026-11-18T14:00:00.000Z",
      nextAssignmentAt: null,
    });
  });
});
