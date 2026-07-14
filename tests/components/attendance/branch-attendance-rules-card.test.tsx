/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BranchAttendanceRulesCard } from "@/app/(dashboard)/owner/branches/[branchId]/branch-attendance-rules-card";
import type { BranchAttendanceRulesData } from "@/lib/attendance/branch-attendance-rules";
import type { AttendanceSettings } from "@/lib/attendance/types";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock(
  "@/app/(dashboard)/owner/branches/[branchId]/attendance-rule-actions",
  () => ({
    saveBranchAttendanceRulesAction: vi.fn(),
    saveAttendanceCategoryRuleAction: vi.fn(),
  })
);

const settings: AttendanceSettings = {
  branch_id: "branch-1",
  duplicate_scan_window_seconds: 90,
  clock_in_early_grace_minutes: 15,
  clock_in_late_grace_minutes: 5,
  clock_out_early_grace_minutes: 5,
  clock_out_late_grace_minutes: 15,
  overnight_shift_cutoff_time: "06:00:00",
  active_service_blocks_clock_out: true,
  require_registered_device_for_attendance: false,
  timezone: "Asia/Manila",
  attendance_day_boundary: "06:00:00",
  early_clock_in_allowed_minutes: 30,
  late_grace_minutes: 10,
  clock_in_window_before_shift_minutes: 30,
  clock_in_window_after_shift_start_minutes: 120,
  clock_out_window_before_shift_end_minutes: 120,
  clock_out_window_after_shift_end_minutes: 120,
  early_leave_threshold_minutes: 5,
  overtime_threshold_minutes: 15,
  branch_operating_close_time: "22:30:00",
  crm_closing_policy_enabled: true,
  crm_closing_buffer_minutes: 30,
  crm_manager_escalation_delay_minutes: 30,
  crm_hard_cutoff_delay_minutes: 60,
  closing_intervention_last_run_at: null,
  closing_intervention_last_error: null,
  duplicate_scan_debounce_minutes: 3,
  first_scan_closing_behavior: "flag_for_recovery",
  missing_schedule_behavior: "flag_for_recovery",
  off_day_scan_behavior: "flag_for_recovery",
  ambiguous_scan_behavior: "flag_for_recovery",
  launch_recovery_enabled: false,
  launch_recovery_start_date: null,
  launch_recovery_end_date: null,
  launch_recovery_closing_start_time: "20:30:00",
  launch_recovery_closing_end_time: "23:59:00",
  launch_recovery_reason: null,
  test_mode_enabled: false,
  test_mode_reason: null,
  test_mode_enabled_at: null,
  test_mode_enabled_by: null,
  test_mode_disabled_at: null,
  test_mode_disabled_by: null,
  updated_by: null,
};

const data: BranchAttendanceRulesData = {
  settings,
  previewBusinessDate: "2026-07-14",
  closingPreview: {
    kind: "crm_closing",
    category: "crm_front_desk",
    appliesCrmClosingPolicy: true,
    expectedEndAt: "2026-07-14T15:00:00.000Z",
    earliestNormalClockOutAt: "2026-07-14T14:30:00.000Z",
    latestNormalClockOutAt: "2026-07-14T15:00:00.000Z",
    reminderAt: "2026-07-14T15:00:00.000Z",
    managerEscalationAt: "2026-07-14T15:30:00.000Z",
    hardCutoffAt: "2026-07-14T16:00:00.000Z",
    provisionalClockOutAt: "2026-07-14T15:00:00.000Z",
    lateGraceMinutes: 10,
    earlyLeaveThresholdMinutes: 5,
    overtimeThresholdMinutes: 15,
    activeServiceBlocksClockOut: true,
    source: { branchRuleVersionId: null, categoryRuleId: null },
  },
  categories: [
    "crm_front_desk",
    "therapists",
    "salon",
    "drivers",
    "utility",
    "managers",
    "other",
  ].map((category) => ({
    category: category as BranchAttendanceRulesData["categories"][number]["category"],
    label: category.replaceAll("_", " "),
    ruleId: null,
    effectiveFrom: null,
    effectiveUntil: null,
    override: {
      late_grace_minutes: null,
      early_leave_threshold_minutes: null,
      overtime_threshold_minutes: null,
      active_service_blocks_clock_out: null,
      crm_closing_policy_enabled: null,
    },
    resolved: {
      lateGraceMinutes: 10,
      earlyLeaveThresholdMinutes: 5,
      overtimeThresholdMinutes: 15,
      activeServiceBlocksClockOut: true,
      crmClosingPolicyEnabled: true,
    },
  })),
  history: [],
  affectedClosingScheduleRows: 4,
  scheduler: {
    sourceConfigured: true,
    lastRunAt: null,
    lastError: null,
    recentlyObserved: false,
    nextExpectedRunAt: null,
  },
};

describe("BranchAttendanceRulesCard", () => {
  beforeEach(() => refresh.mockReset());
  afterEach(() => cleanup());

  it("renders the default policy, honest scheduler status, and raw-schedule safety copy", () => {
    render(<BranchAttendanceRulesCard branchId="branch-1" data={data} />);
    expect(screen.getByText("Attendance Rules")).toBeInTheDocument();
    expect(screen.getByText("Configured in source · deployment unverified")).toBeInTheDocument();
    expect(screen.getByText("Raw schedules remain unchanged")).toBeInTheDocument();
    expect(screen.getByText("10:30 PM")).toBeInTheDocument();
    expect(screen.getAllByText("11:00 PM").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("11:30 PM")).toBeInTheDocument();
    expect(screen.getByText("12:00 AM")).toBeInTheDocument();
    expect(screen.getByText("4 active CRM closing schedule rows may use this policy.")).toBeInTheDocument();
  });

  it("updates the derived preview when the owner edits branch closing time", () => {
    render(<BranchAttendanceRulesCard branchId="branch-1" data={data} />);
    fireEvent.change(screen.getByLabelText("Branch closes"), { target: { value: "22:00" } });
    expect(screen.getByText("10:00 PM")).toBeInTheDocument();
    expect(screen.getAllByText("10:30 PM").length).toBeGreaterThanOrEqual(2);
  });

  it("switches to category overrides and history without leaving the branch page", () => {
    render(<BranchAttendanceRulesCard branchId="branch-1" data={data} />);
    fireEvent.click(screen.getByRole("tab", { name: "Category overrides" }));
    expect(screen.getByText("CRM closing policy")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save category override" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    expect(screen.getByText("No rule changes have been recorded yet.")).toBeInTheDocument();
  });
});
