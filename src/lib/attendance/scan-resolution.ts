import type { PublicScanResult } from "@/lib/attendance/types";

export type AttendanceResolutionOwner = "automatic" | "staff" | "crm" | "technical_support";
export type AttendanceResolutionCategory =
  | "device" | "schedule" | "branch" | "attendance_state" | "booking_or_service"
  | "duplicate" | "security" | "technical" | "test";

export type AttendanceScanResolution = {
  safeErrorCode: string;
  category: AttendanceResolutionCategory;
  title: string;
  staffMessage: string;
  crmSummary: string;
  whatHappened: string;
  whyProtected: string;
  recommendedSteps: string[];
  resolutionOwner: AttendanceResolutionOwner;
  staffActionRequired: boolean;
  crmActionRequired: boolean;
  technicalSupportRequired: boolean;
  canRetry: boolean;
  retryLabel: string | null;
  attendanceChanged: boolean;
  incidentRequired: boolean;
  severity: "info" | "warning" | "critical";
  suggestedActions: string[];
  operationId?: string;
  staffId?: string;
  branchId?: string;
  qrPointId?: string;
  attendanceRecordId?: string;
  relatedExceptionId?: string;
};

type Rule = Omit<AttendanceScanResolution, "safeErrorCode" | "operationId" | "attendanceChanged">;

const protectedCopy = "Attendance was left unchanged to protect the staff record.";
const rules: Record<string, Rule> = {
  wrong_branch: { category: "branch", title: "You scanned at a different branch", staffMessage: "This QR belongs to a different branch than your staff assignment.", crmSummary: "Branch mismatch requires review.", whatHappened: "The staff and QR branches did not match.", whyProtected: protectedCopy, recommendedSteps: ["Request branch review.", "Wait for CRM before scanning again."], resolutionOwner: "crm", staffActionRequired: true, crmActionRequired: true, technicalSupportRequired: false, canRetry: false, retryLabel: null, incidentRequired: true, severity: "warning", suggestedActions: ["approve_branch_scan", "correct_staff_branch", "ask_staff", "reject_request", "open_staff_record"] },
  outside_schedule_window: { category: "schedule", title: "This scan is outside your scheduled hours", staffMessage: "The scan time is outside the resolved shift window.", crmSummary: "Outside-schedule scan requires review.", whatHappened: "The scan did not fall within an eligible shift window.", whyProtected: protectedCopy, recommendedSteps: ["Request a schedule review."], resolutionOwner: "crm", staffActionRequired: true, crmActionRequired: true, technicalSupportRequired: false, canRetry: false, retryLabel: null, incidentRequired: true, severity: "warning", suggestedActions: ["approve_early_clock_in", "approve_late_clock_out", "create_today_override", "open_schedule", "ask_staff", "reject_request"] },
  missing_schedule: { category: "schedule", title: "Your schedule needs review", staffMessage: "The system could not find a valid schedule for you today.", crmSummary: "No valid resolved schedule was found.", whatHappened: "Schedule resolution returned no eligible shift.", whyProtected: protectedCopy, recommendedSteps: ["CRM has been asked to review your schedule."], resolutionOwner: "crm", staffActionRequired: false, crmActionRequired: true, technicalSupportRequired: false, canRetry: false, retryLabel: null, incidentRequired: true, severity: "warning", suggestedActions: ["open_schedule", "create_today_override", "assign_group_schedule", "mark_day_off", "reprocess_scan", "ask_staff"] },
  schedule_conflict: { category: "schedule", title: "Conflicting shifts were found", staffMessage: "Attendance was not changed while CRM reviews the overlapping shifts.", crmSummary: "Conflicting resolved shifts require correction.", whatHappened: "More than one shift could apply to this scan.", whyProtected: protectedCopy, recommendedSteps: ["Wait for CRM to correct the schedule."], resolutionOwner: "crm", staffActionRequired: false, crmActionRequired: true, technicalSupportRequired: false, canRetry: false, retryLabel: null, incidentRequired: true, severity: "warning", suggestedActions: ["open_conflicting_schedules", "keep_correct_shift", "remove_overlap", "rerun_interpretation"] },
  off_day_scan: { category: "schedule", title: "Today is marked as your day off", staffMessage: "Ask CRM to review this scan if you were requested to work.", crmSummary: "Staff scanned on a resolved day off.", whatHappened: "The resolved schedule marks this date as off.", whyProtected: protectedCopy, recommendedSteps: ["Request review if you were asked to work."], resolutionOwner: "crm", staffActionRequired: true, crmActionRequired: true, technicalSupportRequired: false, canRetry: false, retryLabel: null, incidentRequired: true, severity: "warning", suggestedActions: ["create_today_override", "ask_staff", "reject_request"] },
  duplicate_scan: { category: "duplicate", title: "Attendance already recorded", staffMessage: "Your previous scan was already processed.", crmSummary: "Harmless repeated scan.", whatHappened: "The same attendance action was received again.", whyProtected: "The existing committed result was kept.", recommendedSteps: ["No further action is needed."], resolutionOwner: "automatic", staffActionRequired: false, crmActionRequired: false, technicalSupportRequired: false, canRetry: false, retryLabel: null, incidentRequired: false, severity: "info", suggestedActions: [] },
  active_service_blocks_clock_out: { category: "booking_or_service", title: "Service still active", staffMessage: "Complete the active service before clocking out.", crmSummary: "An active service blocks clock-out.", whatHappened: "A service session is still active.", whyProtected: "Clock-out was blocked so service and attendance times remain consistent.", recommendedSteps: ["Open and complete the active service, then scan again."], resolutionOwner: "staff", staffActionRequired: true, crmActionRequired: false, technicalSupportRequired: false, canRetry: true, retryLabel: "Scan again after completing service", incidentRequired: false, severity: "warning", suggestedActions: ["open_active_booking", "complete_or_correct_service", "retry_interpretation"] },
  device_recovery_required: { category: "device", title: "Reconnect this phone", staffMessage: "This phone was connected before, but its secure Attendance connection is missing.", crmSummary: "A real scan requires device reconnection.", whatHappened: "The trusted device cookie could not be verified.", whyProtected: protectedCopy, recommendedSteps: ["Request reconnection from CRM."], resolutionOwner: "crm", staffActionRequired: true, crmActionRequired: true, technicalSupportRequired: false, canRetry: false, retryLabel: null, incidentRequired: true, severity: "warning", suggestedActions: ["generate_recovery_link", "approve_replacement", "open_devices", "send_instructions", "revoke_old_device"] },
  device_limit_reached: { category: "device", title: "Phone replacement needed", staffMessage: "Your account already has the maximum number of active Attendance phones.", crmSummary: "Device limit requires replacement review.", whatHappened: "A new phone could not be registered because the active-device limit was reached.", whyProtected: protectedCopy, recommendedSteps: ["Request phone replacement."], resolutionOwner: "crm", staffActionRequired: true, crmActionRequired: true, technicalSupportRequired: false, canRetry: false, retryLabel: null, incidentRequired: true, severity: "warning", suggestedActions: ["select_device_to_replace", "approve_replacement", "reject_request", "ask_staff"] },
  device_revoked: { category: "security", title: "This phone is no longer approved", staffMessage: "Ask CRM to review or replace this phone.", crmSummary: "A revoked device attempted an Attendance scan.", whatHappened: "The presented device credential was revoked.", whyProtected: protectedCopy, recommendedSteps: ["Contact CRM for device review."], resolutionOwner: "crm", staffActionRequired: true, crmActionRequired: true, technicalSupportRequired: false, canRetry: false, retryLabel: null, incidentRequired: true, severity: "warning", suggestedActions: ["approve_replacement", "open_devices", "ask_staff"] },
  invalid_qr_point: { category: "security", title: "QR not recognized", staffMessage: "Use the current Attendance QR at your branch.", crmSummary: "Invalid or inactive QR point.", whatHappened: "The QR point could not be validated.", whyProtected: protectedCopy, recommendedSteps: ["Ask the front desk for the current QR."], resolutionOwner: "staff", staffActionRequired: true, crmActionRequired: false, technicalSupportRequired: false, canRetry: true, retryLabel: "Scan the current QR", incidentRequired: false, severity: "warning", suggestedActions: [] },
  ignored_test_scan: { category: "test", title: "Test scan recorded", staffMessage: "Test mode did not change live Attendance.", crmSummary: "Test scan excluded from live attendance.", whatHappened: "The scan ran in test mode.", whyProtected: "Live Attendance is isolated from test scans.", recommendedSteps: ["No action is needed."], resolutionOwner: "automatic", staffActionRequired: false, crmActionRequired: false, technicalSupportRequired: false, canRetry: false, retryLabel: null, incidentRequired: false, severity: "info", suggestedActions: [] },
};

const aliases: Record<string, string> = {
  unknown_device: "first_time_device_registration",
  device_not_registered: "device_recovery_required", missing_device: "device_recovery_required",
  device_cookie_missing: "device_recovery_required", browser_data_cleared: "device_recovery_required",
  DEVICE_REVOKED: "device_revoked", DEVICE_LIMIT_REACHED: "device_limit_reached",
  invalid_qr: "invalid_qr_point", qr_not_found: "invalid_qr_point",
  off_day_exception: "off_day_scan", shift_conflict: "schedule_conflict",
  no_schedule: "missing_schedule", outside_shift_window: "outside_schedule_window",
  active_service: "active_service_blocks_clock_out", already_processed: "duplicate_scan",
  DEVICE_LINKED_TO_OTHER_STAFF: "device_linked_to_other_staff",
  early_clock_in: "early_clock_in_review", late_clock_out: "late_clock_out_review",
  ambiguous_scan: "ambiguous_scan", stale_open_checkin: "stale_open_attendance",
  ATTENDANCE_TRANSACTION_FAILED: "attendance_transaction_failed",
  ATTENDANCE_WRITE_FAILED: "attendance_transaction_failed",
  ATTENDANCE_RPC_MISSING: "attendance_rpc_failed",
  ATTENDANCE_RPC_SIGNATURE_MISMATCH: "attendance_schema_mismatch",
  ATTENDANCE_RLS_DENIED: "attendance_permission_denied",
  SCHEDULE_SCHEMA_MISMATCH: "attendance_schema_mismatch",
  SCAN_INTENT_EXPIRED: "scan_intent_expired",
  UNKNOWN_ATTENDANCE_ERROR: "unknown_safe_failure",
};

function technicalRule(code: string): Rule {
  const permission = code.includes("RLS") || code.includes("PERMISSION");
  const schema = code.includes("SCHEMA") || code.includes("RPC_MISSING") || code.includes("SIGNATURE");
  return { category: "technical", title: "Attendance could not be saved", staffMessage: "Your attempt was recorded for review. Do not keep scanning repeatedly.", crmSummary: permission ? "Attendance permission policy denied the operation." : schema ? "Attendance database contract does not match the application." : "Attendance processing failed before a change could be confirmed.", whatHappened: "The Attendance operation did not complete safely.", whyProtected: "No Attendance change was confirmed; technical details are restricted to authorized support staff.", recommendedSteps: ["Wait for CRM or technical support to confirm the result."], resolutionOwner: "technical_support", staffActionRequired: false, crmActionRequired: true, technicalSupportRequired: true, canRetry: false, retryLabel: null, incidentRequired: true, severity: "critical", suggestedActions: ["view_technical_details", "retry_safe_processing", "escalate_technical_support", "notify_staff", "mark_blocked_pending_deployment"] };
}

export function classifyAttendanceScanResult(result: PublicScanResult): AttendanceScanResolution {
  const raw = result.reasonCode ?? (result.ok ? "attendance_changed" : "unknown_safe_failure");
  const safeErrorCode = aliases[raw] ?? aliases[raw.toUpperCase()] ?? raw.toLowerCase();
  const familyRule = safeErrorCode === "first_time_device_registration" && result.ok
    ? undefined
    : safeErrorCode === "device_linked_to_other_staff"
      ? rules.device_revoked
      : ["early_clock_in_review", "late_clock_out_review", "ambiguous_scan", "stale_open_attendance"].includes(safeErrorCode)
        ? rules.outside_schedule_window
        : undefined;
  const rule = rules[safeErrorCode] ?? familyRule ?? (!result.ok ? technicalRule(raw.toUpperCase()) : {
    category: "attendance_state" as const, title: result.title, staffMessage: result.message,
    crmSummary: "Attendance operation completed.", whatHappened: result.message,
    whyProtected: "The committed Attendance result is authoritative.", recommendedSteps: [],
    resolutionOwner: "automatic" as const, staffActionRequired: false, crmActionRequired: false,
    technicalSupportRequired: false, canRetry: false, retryLabel: null, incidentRequired: false,
    severity: "info" as const, suggestedActions: [],
  });
  return { ...rule, safeErrorCode, title: rule.title, staffMessage: rule.staffMessage,
    attendanceChanged: Boolean(result.attendance), operationId: result.operationId };
}

export function withAttendanceScanResolution(result: PublicScanResult): PublicScanResult {
  return { ...result, resolution: classifyAttendanceScanResult(result) };
}
