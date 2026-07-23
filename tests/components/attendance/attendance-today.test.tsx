/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AttendanceRecentActivity } from "@/components/features/attendance/today/attendance-recent-activity";
import { AttendanceStaffTable } from "@/components/features/attendance/today/attendance-staff-table";
import { AttendanceSummaryCards } from "@/components/features/attendance/today/attendance-summary-cards";
import type { AttendanceStaffDiagnostic } from "@/lib/attendance/staff-diagnostics";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

function row(
  id: string,
  name: string,
  flags: Partial<AttendanceStaffDiagnostic> = {}
): AttendanceStaffDiagnostic {
  return {
    staff: {
      staffId: id,
      staffName: name,
      staffType: "therapist",
      branchId: "branch-1",
      businessDate: "2026-07-22",
      timezone: "Asia/Manila",
      scheduleSource: "individual",
      scheduleState: "expected_now",
      shiftWindows: [],
      currentShiftWindow: null,
      nextShiftWindow: null,
      scheduledStart: null,
      scheduledEnd: null,
      attendanceRecordId: null,
      clockInAt: null,
      clockOutAt: null,
      currentAttendanceState: "not_arrived",
      operationalStatus: "expected_later",
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
      displayLabel: "Not Arrived",
      actionRequired: false,
    },
    status: "not_scanned_in",
    statusLabel: "Not scanned in",
    needsHelp: false,
    working: false,
    notScannedIn: true,
    checkedOut: false,
    device: null,
    latestScan: null,
    openException: null,
    issue: null,
    ...flags,
  };
}

afterEach(cleanup);

describe("Attendance Today", () => {
  const rows = [
    row("one", "Maria Santos", {
      status: "working",
      statusLabel: "Working",
      working: true,
      notScannedIn: false,
    }),
    row("two", "John Dela Cruz", {
      status: "wrong_branch",
      statusLabel: "Wrong branch",
      needsHelp: true,
    }),
    row("three", "Rose Lim", {
      status: "checked_out",
      statusLabel: "Checked out",
      checkedOut: true,
      notScannedIn: false,
    }),
  ];

  it("renders all four live summary counts", () => {
    render(<AttendanceSummaryCards rows={rows} />);
    expect(screen.getByText("Working")).toBeTruthy();
    expect(screen.getByText("Not in yet")).toBeTruthy();
    expect(screen.getByText("Needs review")).toBeTruthy();
    expect(screen.getByText("Checked out")).toBeTruthy();
  });

  it("filters problem rows and searches staff names", () => {
    render(
      <AttendanceStaffTable
        rows={rows}
        onOpen={vi.fn()}
        onOpenHistory={vi.fn()}
        onOpenPhone={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Needs help" }));
    expect(screen.getByText("John Dela Cruz")).toBeTruthy();
    expect(screen.queryByText("Maria Santos")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.change(screen.getByLabelText("Search staff by name"), { target: { value: "Rose" } });
    expect(screen.getByText("Rose Lim")).toBeTruthy();
    expect(screen.queryByText("John Dela Cruz")).toBeNull();
  });

  it("renders recent scan activity in plain language with expandable system details", () => {
    const data = {
      branchName: "Main Branch",
      timezone: "Asia/Manila",
      scanEvents: [
        {
          id: "scan-1",
          staff_id: "one",
          staff_name: "Maria Santos",
          scan_type: "attendance",
          action: "clock_in",
          outcome: "success",
          reason_code: "clock_in",
          message: null,
          created_at: "2026-07-22T01:00:00Z",
          point_label: "Main Attendance",
          booking_id: null,
        },
      ],
    } as AttendanceWorkspaceData;
    render(<AttendanceRecentActivity data={data} onViewHistory={vi.fn()} />);
    expect(screen.getByText("Scanned in")).toBeTruthy();
    expect(screen.getByText("System details")).toBeTruthy();
    expect(screen.queryByText("clock_in · success")).toBeTruthy();
  });
});
