/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { resolveAttendanceDiagnostic } from "@/lib/attendance/diagnostic-catalog";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";
import type { AttendanceStaffDiagnostic } from "@/lib/attendance/staff-diagnostics";
import type {
  AttendanceException,
  AttendanceSettings,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";

vi.mock("@/app/(dashboard)/crm/attendance/actions", () => ({
  bulkAcknowledgeAttendanceExceptionsAction: vi.fn(async () => ({ ok: true })),
  quickFixAttendanceExceptionAction: vi.fn(async () => ({ ok: true })),
  reviewAttendanceExceptionAction: vi.fn(async () => ({ ok: true })),
  correctAttendanceRecordAction: vi.fn(async () => ({ ok: true })),
  allowAttendanceExceptionAction: vi.fn(async () => ({ ok: true })),
  approveMissingScheduleExceptionAction: vi.fn(async () => ({ ok: true })),
  approveOffDayExceptionAction: vi.fn(async () => ({ ok: true })),
  approveScheduleExceptionAction: vi.fn(async () => ({ ok: true })),
  clearAttendanceExceptionAction: vi.fn(async () => ({ ok: true })),
  forceEndActiveServiceAction: vi.fn(async () => ({ ok: true })),
  resetDeviceAndSendLinkAction: vi.fn(async () => ({ ok: true })),
  revokeAttendanceDeviceAction: vi.fn(async () => ({ ok: true })),
}));

import { AttendanceReviewView } from "@/components/features/attendance/review/attendance-review-view";
import { AttendanceTodayView } from "@/components/features/attendance/today/attendance-today-view";

afterEach(cleanup);

function makeSettings(): AttendanceSettings {
  return {
    branch_id: "branch-1",
    duplicate_scan_window_seconds: 90,
    clock_in_early_grace_minutes: 15,
    clock_in_late_grace_minutes: 10,
    clock_out_early_grace_minutes: 10,
    clock_out_late_grace_minutes: 15,
    overnight_shift_cutoff_time: "04:00",
    active_service_blocks_clock_out: false,
    require_registered_device_for_attendance: false,
    timezone: "Asia/Manila",
    attendance_day_boundary: "04:00",
    early_clock_in_allowed_minutes: 30,
    late_grace_minutes: 10,
    clock_in_window_before_shift_minutes: 60,
    clock_in_window_after_shift_start_minutes: 180,
    clock_out_window_before_shift_end_minutes: 60,
    clock_out_window_after_shift_end_minutes: 180,
    early_leave_threshold_minutes: 15,
    overtime_threshold_minutes: 15,
    branch_operating_close_time: "22:00",
    crm_closing_policy_enabled: true,
    crm_closing_buffer_minutes: 30,
    crm_manager_escalation_delay_minutes: 30,
    crm_hard_cutoff_delay_minutes: 90,
    closing_intervention_last_run_at: null,
    closing_intervention_last_error: null,
    duplicate_scan_debounce_minutes: 5,
    first_scan_closing_behavior: "flag_for_recovery",
    missing_schedule_behavior: "flag_for_recovery",
    off_day_scan_behavior: "flag_for_recovery",
    ambiguous_scan_behavior: "flag_for_recovery",
    launch_recovery_enabled: false,
    launch_recovery_start_date: null,
    launch_recovery_end_date: null,
    launch_recovery_closing_start_time: "20:00",
    launch_recovery_closing_end_time: "23:59",
    launch_recovery_reason: null,
    test_mode_enabled: false,
    test_mode_reason: null,
    test_mode_enabled_at: null,
    test_mode_enabled_by: null,
    test_mode_disabled_at: null,
    test_mode_disabled_by: null,
    updated_by: null,
  };
}

function makeWorkspaceData(overrides: Partial<AttendanceWorkspaceData> = {}): AttendanceWorkspaceData {
  return {
    branchId: "branch-1",
    branchName: "Main Spa",
    businessDate: "2026-11-15",
    timezone: "Asia/Manila",
    serverNowMs: Date.parse("2026-11-15T11:30:00.000Z"),
    settings: makeSettings(),
    summary: {
      checkedInNow: 1,
      recordsToday: 1,
      openExceptions: 2,
      resolvedToday: 0,
      activeSessions: 0,
      activeDevices: 1,
    },
    qrConfiguration: { isConfigured: true, baseUrl: "https://app.example.com", error: null },
    qrPoints: [],
    devices: [],
    deviceRegistry: {
      branchId: "branch-1",
      branchName: "Main Spa",
      canSwitchBranch: false,
      branches: [{ id: "branch-1", name: "Main Spa" }],
      staffOptions: [],
      activeDevices: [],
      entries: [],
      pendingRecoveryLinks: [],
      registrationRequests: [],
    },
    records: [],
    testRecords: [],
    exceptions: [],
    corrections: [],
    scanEvents: [],
    sessions: [],
    dailyStaffStates: [],
    staffOptions: [
      { id: "staff-1", full_name: "Anthony Rico Morcilla", staff_type: "therapist" },
      { id: "staff-2", full_name: "Divina Batislaon", staff_type: "therapist" },
    ],
    resourceOptions: [],
    ...overrides,
  };
}

function makeDiagnosticRow(overrides: Partial<AttendanceStaffDiagnostic> = {}): AttendanceStaffDiagnostic {
  return {
    staff: {
      staffId: "staff-1",
      staffName: "Anthony Rico Morcilla",
      staffType: "therapist",
      branchId: "branch-1",
      businessDate: "2026-11-15",
      timezone: "Asia/Manila",
      scheduleSource: "individual",
      scheduleState: "expected_now",
      shiftWindows: [],
      currentShiftWindow: null,
      nextShiftWindow: null,
      scheduledStart: "2026-11-15T02:00:00.000Z", // 10:00 AM Asia/Manila
      scheduledEnd: "2026-11-15T10:00:00.000Z", // 6:00 PM Asia/Manila
      attendanceRecordId: "rec-1",
      clockInAt: "2026-11-15T01:55:00.000Z",
      clockOutAt: null,
      currentAttendanceState: "clocked_in",
      operationalStatus: "clocked_in",
      workedMinutes: 575,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 90,
      activeBookingId: null,
      activeServiceSession: null,
      availabilityState: "available",
      exceptionState: "clear",
      currentExceptionIds: [],
      issueCodes: [],
      displayLabel: "Working",
      actionRequired: false,
      ...(overrides.staff ?? {}),
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
    ...overrides,
  };
}

function makeReviewItem(overrides: Partial<AttendanceReviewItem> = {}): AttendanceReviewItem {
  const exception: AttendanceException = {
    id: "exc-1",
    branch_id: "branch-1",
    staff_id: "staff-1",
    checkin_id: "rec-1",
    scan_event_id: null,
    staff_name: "Anthony Rico Morcilla",
    exception_type: "missing_clock_out",
    severity: "critical",
    status: "open",
    resolution_status: "open",
    message: "Clock-in at 2026-11-14T06:14:00.000Z has no departure.",
    metadata: {},
    detected_at: "2026-11-15T06:00:00.000Z",
    last_detected_at: "2026-11-15T06:00:00.000Z",
    resolved_at: null,
    ...(overrides.exception ?? {}),
  };

  return {
    id: "review-1",
    category: "clock",
    priority: "critical",
    title: "Previous shift still open",
    recommendedAction: "Record missing clock-out",
    diagnostic: resolveAttendanceDiagnostic({ exception }),
    recurrenceCount: 1,
    recurrenceLabel: "New",
    relatedExceptionIds: [exception.id],
    ...overrides,
    exception,
  };
}

describe("Attendance UI visual & functional fidelity regressions", () => {
  it("renders horizontal shift progress bar capped at 100% with Beyond schedule pill in Today view", () => {
    const data = makeWorkspaceData();
    const workingRow = makeDiagnosticRow();
    const item = makeReviewItem();
    const onOpenReviewItem = vi.fn();

    const { container } = render(
      <AttendanceTodayView
        data={data}
        rows={[workingRow]}
        reviewItems={[item]}
        onOpen={vi.fn()}
        onOpenReviewItem={onOpenReviewItem}
        onOpenAllReview={vi.fn()}
        onOpenHistory={vi.fn()}
        onOpenPhone={vi.fn()}
      />
    );

    const progress = container.querySelector('[role="progressbar"]');
    expect(progress).toBeTruthy();
    expect(progress?.getAttribute("aria-label")).toMatch(/Anthony Rico Morcilla shift progress/i);
    expect(progress?.getAttribute("aria-valuenow")).toBe("100");
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("Beyond schedule")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Review & Fix/i }));
    expect(onOpenReviewItem).toHaveBeenCalledWith(item);
  });

  it("hides raw ISO timestamps, renders visible All filter pill, and gates Review & Fix for unlinked technical issues", () => {
    const missingClockOutItem = makeReviewItem({
      id: "review-clock",
      category: "clock",
      exception: {
        id: "exc-clock",
        branch_id: "branch-1",
        staff_id: "staff-1",
        checkin_id: "rec-1",
        scan_event_id: null,
        staff_name: "Anthony Rico Morcilla",
        exception_type: "missing_clock_out",
        severity: "high",
        status: "open",
        resolution_status: "open",
        message: "Shift started at 2026-11-15T02:00:00.000Z without clock-out.",
        metadata: {},
        detected_at: "2026-11-15T06:00:00.000Z",
        last_detected_at: "2026-11-15T06:00:00.000Z",
        resolved_at: null,
      },
    });

    const unlinkedTechnicalItem = makeReviewItem({
      id: "review-tech",
      category: "technical",
      priority: "normal",
      title: "QR telemetry error",
      recommendedAction: "Inspect diagnostic",
      exception: {
        id: "exc-tech",
        branch_id: "branch-1",
        staff_id: "staff-2",
        checkin_id: null,
        scan_event_id: null,
        staff_name: "Divina Batislaon",
        exception_type: "system_error",
        severity: "medium",
        status: "open",
        resolution_status: "open",
        message: "Expected shift 2026-11-15T02:00:00.000Z had no valid scan token.",
        metadata: {},
        detected_at: "2026-11-15T02:05:00.000Z",
        last_detected_at: "2026-11-15T02:05:00.000Z",
        resolved_at: null,
      },
    });

    const data = makeWorkspaceData({
      records: [
        {
          id: "rec-1",
          branch_id: "branch-1",
          staff_id: "staff-1",
          staff_name: "Anthony Rico Morcilla",
          staff_nickname: null,
          staff_type: "therapist",
          system_role: null,
          shift_date: "2026-11-15",
          shift_type: "regular",
          scheduled_start_at: "2026-11-15T02:00:00.000Z",
          scheduled_end_at: "2026-11-15T10:00:00.000Z",
          checked_in_at: "2026-11-15T02:00:00.000Z",
          checked_out_at: null,
          status: "clocked_in",
          attendance_status: "present",
          exception_state: "open",
          worked_minutes: 0,
          late_minutes: 0,
          early_leave_minutes: 0,
          overtime_minutes: 0,
          clock_in_method: "qr",
          clock_out_method: null,
          attendance_expected_end_at: "2026-11-15T10:00:00.000Z",
          earliest_normal_clock_out_at: null,
          latest_normal_clock_out_at: null,
          attendance_policy_source: "schedule",
          attendance_policy_snapshot: {},
          provisional_auto_closed_at: null,
          clock_out_confirmation_required: false,
          actual_clock_out_reconciled_at: null,
          source_label: "Main QR",
        },
      ],
      dailyStaffStates: [
        {
          ...makeDiagnosticRow({
            staff: {
              ...makeDiagnosticRow().staff,
              staffId: "staff-2",
              staffName: "Divina Batislaon",
              scheduledStart: "2026-11-15T02:00:00.000Z",
              scheduledEnd: "2026-11-15T09:30:00.000Z",
              attendanceRecordId: null,
              clockInAt: null,
              clockOutAt: null,
              operationalStatus: "missing",
              currentAttendanceState: "not_arrived",
            },
          }).staff,
        },
      ],
    });

    const { container } = render(
      <AttendanceReviewView
        data={data}
        items={[missingClockOutItem, unlinkedTechnicalItem]}
        onRefresh={vi.fn()}
        onManagePhone={vi.fn()}
      />
    );

    // No raw ISO timestamps should leak into visible text
    expect(container.textContent).not.toContain("2026-11-15T02:00:00.000Z");
    expect(container.textContent).not.toContain("2026-11-15T09:30:00.000Z");
    expect(screen.getByText("10:00 AM–5:30 PM")).toBeTruthy();

    // Active "All (2)" pill has explicit dark-green contrast fill & white label
    const allPill = screen.getByRole("button", { name: /All\s*\(2\)/i });
    expect(allPill.textContent).toMatch(/All\s*\(2\)/);
    expect(allPill.getAttribute("style")).toContain("rgb(31, 78, 51)");

    // Clock issue has Review & Fix; unlinked technical issue gets Inspect (not Review & Fix)
    expect(screen.getAllByRole("button", { name: /Review & Fix/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: /Inspect/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: /Acknowledge/i }).length).toBeGreaterThanOrEqual(2);
  });
});
