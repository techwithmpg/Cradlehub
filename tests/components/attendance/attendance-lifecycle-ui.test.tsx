/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";
import type { AttendanceStaffDiagnostic } from "@/lib/attendance/staff-diagnostics";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";

const actionMocks = vi.hoisted(() => ({
  sendScheduledClockInRemindersAction: vi.fn(),
  loadOpenCheckinContextAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: unknown; href: string }) => (
    <a href={href}>{children as never}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/crm/attendance",
}));
vi.mock("@/components/features/dashboard/use-workspace-generation", () => ({
  useGenerationAwareWorkspaceSWR: (
    _key: string,
    _path: string,
    _fetcher: unknown,
    initialData: AttendanceWorkspaceData
  ) => ({
    data: initialData,
    error: null,
    generation: { store: { invalidate: vi.fn() } },
    revalidate: vi.fn(async () => initialData),
  }),
}));
vi.mock("@/components/features/attendance/use-attendance-workspace-realtime", () => ({
  useAttendanceWorkspaceRealtime: vi.fn(),
}));
vi.mock("@/components/features/attendance/setup/attendance-setup-view", () => ({
  AttendanceSetupView: () => <div>Setup view</div>,
}));
vi.mock("@/app/(dashboard)/crm/attendance/actions", () => ({
  sendScheduledClockInRemindersAction: actionMocks.sendScheduledClockInRemindersAction,
  loadOpenCheckinContextAction: actionMocks.loadOpenCheckinContextAction,
  refreshCrmAttendanceWorkspaceAction: vi.fn(async () => ({ ok: false, error: "noop" })),
  reviewAttendanceExceptionAction: vi.fn(async () => ({ ok: true, message: "reviewed" })),
  bulkAcknowledgeAttendanceExceptionsAction: vi.fn(async () => ({ ok: true, message: "acked" })),
  quickFixAttendanceExceptionAction: vi.fn(async () => ({ ok: true, message: "synced" })),
}));
vi.mock("sonner", () => ({
  toast: {
    success: actionMocks.toastSuccess,
    error: actionMocks.toastError,
  },
}));

import { CrmAttendanceHeader } from "@/components/features/attendance/crm-attendance-header";
import { CrmAttendanceWorkspace } from "@/components/features/attendance/crm-attendance-workspace";
import { AttendanceIssueModalRouter } from "@/components/features/attendance/review/attendance-issue-modal-router";
import { AttendanceReviewView } from "@/components/features/attendance/review/attendance-review-view";
import { AttendanceTodayView } from "@/components/features/attendance/today/attendance-today-view";
import { AttendanceReadinessCard } from "@/components/features/staff-portal/attendance-readiness-card";
import { StaffAttendanceHistory } from "@/components/features/staff-portal/staff-attendance-history";
import { attendancePushTransport } from "@/lib/notifications/push/delivery";
import type { StaffAttendanceData } from "@/lib/staff-portal/attendance";
import type { WorkspaceNotification } from "@/lib/notifications/types";

vi.mock("server-only", () => ({}));

  beforeEach(() => {
    actionMocks.sendScheduledClockInRemindersAction.mockReset();
    actionMocks.loadOpenCheckinContextAction.mockReset();
    actionMocks.loadOpenCheckinContextAction.mockResolvedValue({ ok: false });
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

  it("keeps Staff Portal readiness and Today history green when only priorShiftIssues exist", () => {
    const portalData = {
      staffId: "staff-1",
      staffName: "Maria Santos",
      today: "2026-11-18",
      scheduleLabel: "2:00 PM – 10:00 PM",
      scheduleState: "scheduled",
      currentClockState: "clocked_in",
      currentRecord: {
        id: "checkin-today",
        shiftDate: "2026-11-18",
        shiftType: "single",
        scheduledStartAt: "2026-11-18T06:00:00.000Z",
        scheduledEndAt: "2026-11-18T14:00:00.000Z",
        checkedInAt: "2026-11-18T05:30:00.000Z",
        checkedOutAt: null,
        status: "checked_in",
        attendanceStatus: "present",
        workedMinutes: 30,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        reviewState: "open",
        reviewLabel: "Shift in progress",
        credit: null,
      },
      todayState: {
        timezone: "Asia/Manila",
        workedMinutes: 30,
        displayLabel: "Working",
        actionRequired: false,
      },
      history: [],
      issues: [],
      priorShiftIssues: [
        {
          id: "exc-prior",
          kind: "record",
          problemCode: "stale_open_checkin",
          title: "Previous shift needs confirmation",
          guidance: "Awaiting CRM review of yesterday's open shift.",
          actionLabel: "View attendance",
          actionHref: "/staff/attendance",
          staffCanComplete: false,
          waitingForCrm: true,
          attendanceChanged: true,
          preventionGuidance: "Scan out after your shift.",
          recurrenceCount: 1,
          recurrenceLabel: "First time",
          supportReceipt: "ATT-1",
        },
      ],
    } as unknown as StaffAttendanceData;

    render(
      <>
        <AttendanceReadinessCard
          data={portalData}
          phoneState={{ registeredDevice: { label: "Maria Phone" } } as never}
        />
        <StaffAttendanceHistory data={portalData} />
      </>
    );

    expect(screen.getByText("Ready to scan")).toBeTruthy();
    expect(screen.getByText("Attendance is ready")).toBeTruthy();
    expect(screen.getByText("No open Attendance issues need your action.")).toBeTruthy();
    expect(screen.getByText(/Prior shift under CRM review/)).toBeTruthy();
  });

  it("hydrates prior-day Review context on historyDays=0, shows original date on mobile, and keeps Working Now clicks clean", () => {
    const yesterdayRecord = {
      id: "checkin-yesterday",
      branch_id: "branch-1",
      staff_id: "staff-1",
      staff_name: "Maria Santos",
      staff_nickname: null,
      staff_type: "therapist",
      system_role: "staff",
      shift_date: "2026-11-17",
      shift_type: "single",
      scheduled_start_at: "2026-11-17T06:00:00.000Z",
      scheduled_end_at: "2026-11-17T14:00:00.000Z",
      checked_in_at: "2026-11-17T06:00:00.000Z",
      checked_out_at: "2026-11-17T14:00:00.000Z",
      status: "checked_out",
      attendance_status: "exception",
      exception_state: "open",
      worked_minutes: 480,
      late_minutes: 0,
      early_leave_minutes: 0,
      overtime_minutes: 0,
      clock_in_method: "qr",
      clock_out_method: "system_auto_close",
      attendance_expected_end_at: "2026-11-17T14:00:00.000Z",
      earliest_normal_clock_out_at: null,
      latest_normal_clock_out_at: null,
      attendance_policy_source: "schedule",
      attendance_policy_snapshot: {},
      provisional_auto_closed_at: "2026-11-18T02:00:00.000Z",
      clock_out_confirmation_required: true,
      actual_clock_out_reconciled_at: null,
      source_label: "Main QR",
    };
    const todayRecord = {
      ...yesterdayRecord,
      id: "checkin-today",
      shift_date: "2026-11-18",
      scheduled_start_at: "2026-11-18T06:00:00.000Z",
      scheduled_end_at: "2026-11-18T14:00:00.000Z",
      checked_in_at: "2026-11-18T06:00:00.000Z",
      checked_out_at: null,
      status: "checked_in",
      attendance_status: "present",
      exception_state: "none",
      clock_out_method: null,
      provisional_auto_closed_at: null,
      clock_out_confirmation_required: false,
    };
    const staleExc = {
      id: "exc-stale",
      branch_id: "branch-1",
      staff_id: "staff-1",
      checkin_id: "checkin-yesterday",
      scan_event_id: "scan-yesterday",
      staff_name: "Maria Santos",
      exception_type: "missed_checkout",
      severity: "warning",
      status: "open",
      message: "Yesterday unclosed",
      metadata: {
        internalExceptionType: "stale_open_checkin",
        staleCheckinId: "checkin-yesterday",
        staleShiftDate: "2026-11-17",
        staleBusinessDate: "2026-11-17",
      },
      detected_at: "2026-11-18T02:00:00.000Z",
      resolved_at: null,
    };
    const workspaceData = {
      branchId: "branch-1",
      branchName: "Main Branch",
      businessDate: "2026-11-18",
      timezone: "Asia/Manila",
      serverNowMs: Date.parse("2026-11-18T07:00:00.000Z"),
      settings: {
        branch_id: "branch-1",
        timezone: "Asia/Manila",
        attendance_day_boundary: "06:00:00",
        clock_in_early_grace_minutes: 15,
        clock_in_late_grace_minutes: 10,
        late_grace_minutes: 10,
      },
      summary: {
        checkedInNow: 1,
        recordsToday: 1,
        openExceptions: 1,
        resolvedToday: 0,
        activeSessions: 0,
        activeDevices: 1,
      },
      qrPoints: [],
      devices: [],
      deviceRegistry: { entries: [] },
      records: [todayRecord],
      exceptionRecords: [yesterdayRecord],
      testRecords: [],
      exceptions: [staleExc],
      scanEvents: [],
      sessions: [],
      corrections: [],
      dailyStaffStates: [
        {
          staffId: "staff-1",
          staffName: "Maria Santos",
          staffType: "therapist",
          branchId: "branch-1",
          businessDate: "2026-11-18",
          timezone: "Asia/Manila",
          scheduleSource: "individual",
          scheduleState: "expected_now",
          shiftWindows: [
            {
              id: "w-1",
              shiftType: "single",
              windowOrder: 1,
              startTime: "14:00:00",
              endTime: "22:00:00",
              scheduledStartAt: "2026-11-18T06:00:00.000Z",
              scheduledEndAt: "2026-11-18T14:00:00.000Z",
              endsNextDay: false,
            },
          ],
          currentShiftWindow: {
            id: "w-1",
            shiftType: "single",
            windowOrder: 1,
            startTime: "14:00:00",
            endTime: "22:00:00",
            scheduledStartAt: "2026-11-18T06:00:00.000Z",
            scheduledEndAt: "2026-11-18T14:00:00.000Z",
            endsNextDay: false,
          },
          nextShiftWindow: null,
          scheduledStart: "2026-11-18T06:00:00.000Z",
          scheduledEnd: "2026-11-18T14:00:00.000Z",
          attendanceRecordId: "checkin-today",
          clockInAt: "2026-11-18T06:00:00.000Z",
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
      ],
      staffOptions: [],
      resourceOptions: [],
    } as unknown as AttendanceWorkspaceData;

    render(
      <CrmAttendanceWorkspace
        data={workspaceData}
        initialNavigation={{ view: "today", section: "phones" }}
      />
    );

    // Click clean active worker in Today view -> modal must NOT show yesterday's stale issue banner
    fireEvent.click(screen.getByRole("button", { name: /Maria Santos/i }));
    expect(
      screen.getByText(/Attendance is currently operating within expected shift parameters/i)
    ).toBeTruthy();

    // Render Review View & Modal Router with historyDays=0 hydrated exceptionRecords
    cleanup();
    const reviewItem = {
      id: "stale-review-1",
      exception: staleExc,
      relatedExceptionIds: ["exc-stale"],
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
        crmInstruction: "Confirm yesterday's clock-out time.",
        resolutionKind: "technical",
        resolutionOwner: "crm",
        staffCanResolve: false,
        attendanceChanged: true,
        preventionAction: "Send clock-out reminder.",
      },
      recurrenceCount: 1,
      recurrenceLabel: "First time",
    } as unknown as AttendanceReviewItem;

    render(
      <>
        <AttendanceReviewView
          data={workspaceData}
          items={[reviewItem]}
          onRefresh={vi.fn()}
          onManagePhone={vi.fn()}
        />
        <AttendanceIssueModalRouter
          data={workspaceData}
          item={reviewItem}
          onClose={vi.fn()}
          onRefresh={vi.fn()}
          onManagePhone={vi.fn()}
        />
      </>
    );

    // Desktop + mobile stack show Nov 17, 2026 original date and yesterday's record times (not Scans: None)
    expect(screen.getAllByText(/Nov 17, 2026/).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/Scans:/)).toBeNull();
    // Modal router resolves to AttendanceCorrectionDialog rather than ResolveScan when hydrated record exists
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
