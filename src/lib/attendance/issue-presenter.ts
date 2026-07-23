import { ATTENDANCE_ISSUE_CATALOG } from "@/lib/attendance/issue-presentation-catalog";
import type { AttendanceDeviceStatus } from "@/lib/attendance/types";
import type {
  AttendanceIssueCategory,
  AttendanceIssuePresentation,
} from "@/lib/attendance/issue-presentation-types";

const CODE_CATEGORY: Record<string, AttendanceIssueCategory> = {
  unknown_device: "phone_not_connected",
  device_not_registered: "phone_not_connected",
  missing_device: "phone_not_connected",
  device_cookie_missing: "phone_not_connected",
  browser_data_cleared: "phone_not_connected",
  revoked_device: "phone_revoked",
  device_revoked: "phone_revoked",
  replacement_phone_required: "replacement_phone_required",
  recovery_pending: "replacement_phone_required",
  wrong_branch: "wrong_branch",
  branch_assignment_issue: "branch_assignment_review",
  missing_schedule: "no_schedule",
  no_schedule: "no_schedule",
  no_schedule_configured: "no_schedule",
  early_clock_in: "scan_too_early",
  scan_too_early: "scan_too_early",
  late_clock_in: "scan_too_late",
  scan_too_late: "scan_too_late",
  stale_open_checkin: "stale_open_attendance",
  conflicting_open_checkin: "stale_open_attendance",
  stale_open_attendance: "stale_open_attendance",
  duplicate_scan: "duplicate_scan",
  duplicate_scan_debounced: "duplicate_scan",
  likely_closing_scan_without_clock_in: "clock_out_review",
  early_clock_out: "clock_out_review",
  overtime_clock_out: "clock_out_review",
  active_service_blocks_clock_out: "clock_out_review",
  clock_out_review: "clock_out_review",
  device_limit_reached: "device_limit_reached",
  inactive_staff: "inactive_staff",
};

function normalizeCode(code: string): string {
  return code.trim().toLowerCase().replaceAll("-", "_");
}

export function resolveAttendanceIssueCategory(codes: string[]): {
  category: AttendanceIssueCategory;
  technicalCode: string;
} | null {
  for (const rawCode of codes) {
    const category = CODE_CATEGORY[normalizeCode(rawCode)];
    if (category) return { category, technicalCode: rawCode };
  }
  return codes[0] ? { category: "unknown_issue", technicalCode: codes[0] } : null;
}

export function presentAttendanceIssue(input: {
  technicalCodes: Array<string | null | undefined>;
  deviceStatus?: AttendanceDeviceStatus | null;
  scheduleState?: string | null;
  operationalStatus?: string | null;
  phoneRelevant?: boolean;
}): AttendanceIssuePresentation | null {
  const codes = input.technicalCodes.filter((code): code is string => Boolean(code));
  let resolved = resolveAttendanceIssueCategory(codes);
  if (!resolved && input.scheduleState === "schedule_missing") {
    resolved = { category: "no_schedule", technicalCode: "schedule_missing" };
  }
  if (!resolved && input.deviceStatus === "inactive_staff") {
    resolved = { category: "inactive_staff", technicalCode: "inactive_staff" };
  }
  if (!resolved && input.deviceStatus === "revoked") {
    resolved = { category: "phone_revoked", technicalCode: "revoked_device" };
  }
  if (!resolved && input.deviceStatus === "recovery_pending") {
    resolved = { category: "replacement_phone_required", technicalCode: "recovery_pending" };
  }
  if (
    !resolved &&
    input.phoneRelevant &&
    ["no_device", "never_used"].includes(input.deviceStatus ?? "")
  ) {
    resolved = { category: "phone_not_connected", technicalCode: "device_not_registered" };
  }
  if (!resolved && ["needs_review", "scan_captured"].includes(input.operationalStatus ?? "")) {
    resolved = { category: "unknown_issue", technicalCode: "attendance_review_required" };
  }
  if (!resolved) return null;
  return {
    category: resolved.category,
    ...ATTENDANCE_ISSUE_CATALOG[resolved.category],
    technicalCode: resolved.technicalCode,
  };
}
