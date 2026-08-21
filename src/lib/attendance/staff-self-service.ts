import { recurrenceLevel, resolveAttendanceDiagnostic } from "@/lib/attendance/diagnostic-catalog";
import type { AttendanceException } from "@/lib/attendance/types";

export type StaffAttendanceIssueInput = {
  id: string;
  exception_type: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  resolution_status?: string | null;
  resolution_owner?: string | null;
  safe_error_code?: string | null;
  occurrence_count?: number | null;
  staff_response_required?: boolean | null;
};

export type StaffAttendanceIssueGuide = {
  id: string;
  kind: "phone" | "branch" | "schedule" | "scan" | "service" | "record" | "system";
  problemCode: string;
  title: string;
  guidance: string;
  actionLabel: string;
  actionHref: string;
  staffCanComplete: boolean;
  waitingForCrm: boolean;
  attendanceChanged: boolean;
  preventionGuidance: string;
  recurrenceCount: number;
  recurrenceLabel: string;
  supportReceipt: string;
};

const DEVICE_SIGN_IN_REASON_CODES = new Set([
  "unknown_device",
  "sign_in_required",
  "missing_device",
  "device_not_registered",
  "device_cookie_missing",
  "device_cookie_expired",
  "browser_data_cleared",
  "device_recovery_required",
  "unregistered_device",
]);

export function isStaffDeviceSignInReason(reasonCode: string | null | undefined): boolean {
  return DEVICE_SIGN_IN_REASON_CODES.has(reasonCode?.trim().toLowerCase() ?? "");
}

function guideKind(category: string): StaffAttendanceIssueGuide["kind"] {
  if (category === "phone") return "phone";
  if (category === "branch") return "branch";
  if (category === "schedule") return "schedule";
  if (category === "service") return "service";
  if (category === "clock") return "record";
  return "system";
}

export function buildStaffAttendanceIssueGuide(
  issue: StaffAttendanceIssueInput
): StaffAttendanceIssueGuide {
  const exception: AttendanceException = {
    id: issue.id,
    branch_id: "",
    staff_id: null,
    checkin_id: null,
    scan_event_id: null,
    staff_name: null,
    exception_type: issue.exception_type,
    severity: "warning",
    status: "open",
    message: issue.message,
    metadata: issue.metadata ?? {},
    detected_at: new Date(0).toISOString(),
    resolved_at: null,
    resolution_status: issue.resolution_status ?? null,
    resolution_owner: issue.resolution_owner ?? null,
    safe_error_code: issue.safe_error_code ?? null,
    occurrence_count: issue.occurrence_count ?? 1,
    staff_response_required: Boolean(issue.staff_response_required),
  };
  const diagnostic = resolveAttendanceDiagnostic({ exception });
  const count = Math.max(1, issue.occurrence_count ?? 1);
  const recurrence = recurrenceLevel(count);
  const waitingForCrm =
    issue.resolution_status === "waiting_for_crm" ||
    diagnostic.resolutionOwner === "crm" ||
    diagnostic.resolutionOwner === "manager" ||
    diagnostic.resolutionOwner === "technical_support";

  return {
    id: issue.id,
    kind: guideKind(diagnostic.category),
    problemCode: diagnostic.code.toUpperCase(),
    title: diagnostic.staffTitle,
    guidance: diagnostic.staffMessage,
    actionLabel: diagnostic.staffActionLabel,
    actionHref: diagnostic.staffActionHref,
    staffCanComplete: diagnostic.staffCanResolve,
    waitingForCrm,
    attendanceChanged: diagnostic.attendanceChanged,
    preventionGuidance: `${diagnostic.staffPrevention} ${recurrence.guidance}`,
    recurrenceCount: count,
    recurrenceLabel: recurrence.label,
    supportReceipt: `ATD-${issue.id.replaceAll("-", "").slice(-8).toUpperCase()}`,
  };
}
