/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StaffAttendanceHistory } from "@/components/features/staff-portal/staff-attendance-history";
import type { StaffAttendanceData } from "@/lib/staff-portal/attendance";

afterEach(() => cleanup());

describe("StaffAttendanceHistory", () => {
  it("renders self-service attendance as a read-only surface", () => {
    const data: StaffAttendanceData = {
      staffId: "staff-1",
      staffName: "Maria Santos",
      today: "2026-07-14",
      scheduleLabel: "9:00 AM–6:00 PM",
      scheduleState: "scheduled",
      currentClockState: "clocked_out",
      currentRecord: null,
      todayState: {
        staffId: "staff-1",
        staffName: "Maria Santos",
        staffType: "therapist",
        branchId: "branch-1",
        businessDate: "2026-07-14",
        timezone: "Asia/Manila",
        scheduleSource: "individual",
        scheduleState: "shift_complete",
        shiftWindows: [],
        currentShiftWindow: null,
        nextShiftWindow: null,
        scheduledStart: null,
        scheduledEnd: null,
        attendanceRecordId: null,
        clockInAt: null,
        clockOutAt: null,
        currentAttendanceState: "clocked_out",
        operationalStatus: "clocked_out",
        workedMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        activeBookingId: null,
        activeServiceSession: null,
        availabilityState: "not_available",
        exceptionState: "clear",
        currentExceptionIds: [],
        issueCodes: [],
        displayLabel: "Clocked Out",
        actionRequired: false,
      },
      history: [],
      issues: [],
    };
    render(<StaffAttendanceHistory data={data} />);
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Attendance history")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/clock in/i)).toBeNull();
    expect(screen.queryByText(/correct attendance/i)).toBeNull();
  });
});
