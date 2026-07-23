/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AttendanceFixScanView } from "@/components/features/attendance/fix-scan/attendance-fix-scan-view";
import { presentAttendanceIssue } from "@/lib/attendance/issue-presenter";
import type { AttendanceStaffDiagnostic } from "@/lib/attendance/staff-diagnostics";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

function diagnostic(id: string, name: string, code: string): AttendanceStaffDiagnostic {
  const issue = presentAttendanceIssue({ technicalCodes: [code] });
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
      currentAttendanceState: "needs_review",
      operationalStatus: "needs_review",
      workedMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      activeBookingId: null,
      activeServiceSession: null,
      availabilityState: "not_available",
      exceptionState: "open",
      currentExceptionIds: [],
      issueCodes: [code],
      displayLabel: "Needs Review",
      actionRequired: true,
    },
    status: "needs_review",
    statusLabel: issue?.title ?? "Needs review",
    needsHelp: true,
    working: false,
    notScannedIn: true,
    checkedOut: false,
    device: null,
    latestScan: null,
    openException: null,
    issue,
  };
}

afterEach(cleanup);

describe("AttendanceFixScanView", () => {
  const data = {
    branchName: "Main Branch",
    corrections: [],
    records: [],
  } as unknown as AttendanceWorkspaceData;

  it("searches and selects staff before showing plain-language guidance", () => {
    render(
      <AttendanceFixScanView
        data={data}
        rows={[
          diagnostic("one", "Maria Santos", "wrong_branch"),
          diagnostic("two", "John Dela Cruz", "device_not_registered"),
        ]}
        advancedRecovery={() => <div>Existing recovery workspace</div>}
        onAction={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText("Who is having a problem?"), {
      target: { value: "John" },
    });
    fireEvent.click(screen.getByRole("button", { name: /John Dela Cruz/ }));
    expect(screen.getAllByText("Phone not connected")).toHaveLength(2);
    expect(screen.getByText("What happened")).toBeTruthy();
    expect(screen.getByText("What to do next")).toBeTruthy();
    expect(screen.getByText("Technical details")).toBeTruthy();
  });

  it("shows the authoritative recommended action and opens existing recovery tools", () => {
    const onAction = vi.fn();
    render(
      <AttendanceFixScanView
        data={data}
        rows={[diagnostic("one", "Maria Santos", "stale_open_checkin")]}
        advancedRecovery={() => <div>Existing recovery workspace</div>}
        onAction={onAction}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Review Previous Record" }));
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: "review_previous_record" }),
      expect.objectContaining({ statusLabel: "Previous clock-in is still open" })
    );
    expect(screen.getByText("Existing recovery workspace")).toBeTruthy();
  });
});
