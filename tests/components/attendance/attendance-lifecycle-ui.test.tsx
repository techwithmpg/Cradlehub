/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";
import type { AttendanceStaffDiagnostic } from "@/lib/attendance/staff-diagnostics";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";

const actionMocks = vi.hoisted(() => ({
  sendScheduledClockInRemindersAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(dashboard)/crm/attendance/actions", () => ({
  sendScheduledClockInRemindersAction: actionMocks.sendScheduledClockInRemindersAction,
}));
vi.mock("sonner", () => ({
  toast: {
    success: actionMocks.toastSuccess,
    error: actionMocks.toastError,
  },
}));

import { CrmAttendanceHeader } from "@/components/features/attendance/crm-attendance-header";
import { AttendanceTodayView } from "@/components/features/attendance/today/attendance-today-view";
import { attendancePushTransport } from "@/lib/notifications/push/delivery";
import type { WorkspaceNotification } from "@/lib/notifications/types";

vi.mock("server-only", () => ({}));

beforeEach(() => {
  actionMocks.sendScheduledClockInRemindersAction.mockReset();
  actionMocks.toastSuccess.mockReset();
  actionMocks.toastError.mockReset();
});

afterEach(cleanup);

describe("Attendance lifecycle UI & push contracts", () => {
  it("retains CRM manual Send Clock-In Reminder button and invokes server action", async () => {
    actionMocks.sendScheduledClockInRemindersAction.mockResolvedValue({
      ok: true,
      sentCount: 2,
      message: "Sent QR clock-in push reminder to 2 scheduled staff member(s).",
    });

    render(
      <CrmAttendanceHeader
        branchName="Main Branch"
        timezone="Asia/Manila"
        businessDate="2026-11-18"
        nowMs={Date.parse("2026-11-18T02:00:00Z")}
        activeView="today"
        unscannedCount={2}
        refreshing={false}
        onRefresh={vi.fn()}
      />
    );

    const button = screen.getByRole("button", { name: /Send Clock-In Reminder \(2\)/i });
    fireEvent.click(button);

    await waitFor(() =>
      expect(actionMocks.sendScheduledClockInRemindersAction).toHaveBeenCalledTimes(1)
    );
    expect(actionMocks.toastSuccess).toHaveBeenCalledWith(
      "Sent QR clock-in push reminder to 2 scheduled staff member(s)."
    );
  });

  it("displays prior-day stale exception with its original shift date while today's active worker stays Working Now", () => {
    const activeWorkerRow = {
      staff: {
        staffId: "staff-1",
        staffName: "Maria Santos",
        staffType: "therapist",
        branchId: "branch-1",
        businessDate: "2026-11-18",
        timezone: "Asia/Manila",
        scheduleSource: "individual",
        scheduleState: "expected_now",
        shiftWindows: [],
        currentShiftWindow: {
          id: "w-1",
          shiftType: "single",
          windowOrder: 1,
          startTime: "10:00:00",
          endTime: "19:00:00",
          scheduledStartAt: "2026-11-18T02:00:00.000Z",
          scheduledEndAt: "2026-11-18T11:00:00.000Z",
          endsNextDay: false,
        },
        nextShiftWindow: null,
        scheduledStart: "2026-11-18T02:00:00.000Z",
        scheduledEnd: "2026-11-18T11:00:00.000Z",
        attendanceRecordId: "checkin-today",
        clockInAt: "2026-11-18T02:00:00.000Z",
        clockOutAt: null,
        currentAttendanceState: "clocked_in",
        operationalStatus: "clocked_in",
        workedMinutes: 60,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        activeBookingId: null,
        activeServiceSession: null,
        availabilityState: "available",
        exceptionState: "clear",
        currentExceptionIds: [],
        issueCodes: [],
        displayLabel: "Working",
        actionRequired: false,
      },
      status: "working",
      statusLabel: "Working",
      needsHelp: false,
      working: true,
      notScannedIn: false,
      checkedOut: false,
      device: null,
      latestScan: null,
      openException: null,
      issue: null,
    } as unknown as AttendanceStaffDiagnostic;

    const priorDayReviewItem = {
      id: "stale-item-1",
      exception: {
        id: "exc-1",
        branch_id: "branch-1",
        staff_id: "staff-1",
        checkin_id: "checkin-yesterday",
        scan_event_id: "scan-yesterday",
        staff_name: "Maria Santos",
        exception_type: "missed_checkout",
        severity: "warning",
        status: "open",
        message: "Maria Santos's earlier open Attendance record was recovered before today's clock-in.",
        metadata: {
          internalExceptionType: "stale_open_checkin",
          staleCheckinId: "checkin-yesterday",
          staleShiftDate: "2026-11-17",
          staleBusinessDate: "2026-11-17",
        },
        detected_at: "2026-11-18T02:00:00.000Z",
        resolved_at: null,
      },
      relatedExceptionIds: ["exc-1"],
      category: "clock",
      priority: "high",
      title: "Maria Santos left a previous attendance shift open",
      recommendedAction: "Review Previous Record",
      diagnostic: {
        code: "stale_open_checkin",
        category: "clock",
        severity: "warning",
        crmTitle: "left a previous attendance shift open",
        crmSummary: "Yesterday's shift was provisionally closed when today's shift opened.",
        crmPrimaryAction: "Review Previous Record",
        staffTitle: "Previous shift needs review",
        staffMessage: "Your previous shift is awaiting CRM confirmation.",
        staffActionLabel: "View attendance",
        staffActionHref: "/staff/attendance",
        resolutionOwner: "crm",
        staffCanResolve: false,
        attendanceChanged: true,
        resolutionKind: "attendance_correction",
        preventionAction: "Send clock-out reminder.",
      },
      recurrenceCount: 1,
      recurrenceLabel: "First time",
    } as unknown as AttendanceReviewItem;

    const data = {
      branchId: "branch-1",
      branchName: "Main Branch",
      businessDate: "2026-11-18",
      timezone: "Asia/Manila",
      serverNowMs: Date.parse("2026-11-18T03:00:00.000Z"),
      records: [],
      testRecords: [],
      exceptions: [priorDayReviewItem.exception],
      scanEvents: [],
      sessions: [],
      corrections: [],
      dailyStaffStates: [activeWorkerRow.staff],
    } as unknown as AttendanceWorkspaceData;

    render(
      <AttendanceTodayView
        data={data}
        rows={[activeWorkerRow]}
        reviewItems={[priorDayReviewItem]}
        onOpen={vi.fn()}
        onOpenReviewItem={vi.fn()}
        onOpenAllReview={vi.fn()}
        onOpenHistory={vi.fn()}
        onOpenPhone={vi.fn()}
      />
    );

    expect(screen.getByText("Working Now (1)")).toBeTruthy();
    expect(screen.getByText(/Original shift: Nov 17, 2026/)).toBeTruthy();
  });

  it("enforces zero-TTL and deterministic dedupe tag on V2 attendance push reminders", () => {
    const notice = {
      id: "n-1",
      type: "attendance_clock_out_reminder",
      entity_type: "attendance_record",
      entity_id: "checkin-1",
      recipient_staff_id: "staff-1",
      metadata: {
        attendanceVersion: 2,
        reminderKind: "final_home_service",
        portalClockOutEligible: true,
      },
    } as unknown as WorkspaceNotification;

    expect(attendancePushTransport(notice)).toMatchObject({
      TTL: 0,
      tag: "cradlehub-attendance:checkin-1",
    });
  });
});
