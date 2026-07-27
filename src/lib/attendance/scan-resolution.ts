import { resolveAttendanceDiagnosticFromScan } from "@/lib/attendance/diagnostic-catalog";
import type { PublicScanResult } from "@/lib/attendance/types";

export type AttendanceResolutionOwner = "automatic" | "staff" | "crm" | "technical_support";

export type AttendanceResolutionCategory =
  | "device"
  | "schedule"
  | "branch"
  | "attendance_state"
  | "booking_or_service"
  | "duplicate"
  | "security"
  | "technical"
  | "test";

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
  staffActionLabel: string;
  staffActionHref: string;
  staffPrevention: string;
  rootCause: string;
  preventionAction: string;
  verification: string;
  operationId?: string;
  staffId?: string;
  branchId?: string;
  qrPointId?: string;
  attendanceRecordId?: string;
  relatedExceptionId?: string;
};

function resolutionCategory(
  code: string,
  category: ReturnType<typeof resolveAttendanceDiagnosticFromScan>["category"]
): AttendanceResolutionCategory {
  if (
    code === "phone_revoked" ||
    code === "device_connected_other_staff" ||
    code === "wrong_staff_account"
  ) {
    return "security";
  }
  if (code === "duplicate_scan" || code === "scan_after_clock_out") {
    return "duplicate";
  }
  if (category === "phone") return "device";
  if (category === "clock") return "attendance_state";
  if (category === "service") return "booking_or_service";
  return category;
}

export function classifyAttendanceScanResult(result: PublicScanResult): AttendanceScanResolution {
  const attendanceChanged = Boolean(result.attendance);
  const diagnostic = resolveAttendanceDiagnosticFromScan({
    reasonCode: result.reasonCode,
    title: result.title,
    message: result.message,
    attendanceChanged,
  });

  if (result.ok && attendanceChanged && !result.reviewLabel) {
    return {
      safeErrorCode: result.reasonCode ?? "attendance_changed",
      category: "attendance_state",
      title: result.title,
      staffMessage: result.message,
      crmSummary: "Attendance was committed successfully.",
      whatHappened: result.message,
      whyProtected: "The committed Attendance result is authoritative.",
      recommendedSteps: [],
      resolutionOwner: "automatic",
      staffActionRequired: false,
      crmActionRequired: false,
      technicalSupportRequired: false,
      canRetry: false,
      retryLabel: null,
      attendanceChanged: true,
      incidentRequired: false,
      severity: "info",
      suggestedActions: [],
      staffActionLabel: "View Attendance",
      staffActionHref: "/staff-portal/attendance",
      staffPrevention: "Scan once and wait for the final confirmed result.",
      rootCause: "No issue was detected.",
      preventionAction: "No prevention action is required.",
      verification: "The committed record is visible in Attendance history.",
      operationId: result.operationId,
    };
  }

  const owner: AttendanceResolutionOwner =
    diagnostic.resolutionOwner === "technical_support"
      ? "technical_support"
      : diagnostic.resolutionOwner === "automatic" || diagnostic.resolutionOwner === "system"
        ? "automatic"
        : diagnostic.resolutionOwner === "staff"
          ? "staff"
          : "crm";
  const canRetry = ["network_error", "request_timeout", "stale_app_version"].includes(
    diagnostic.code
  );

  return {
    safeErrorCode: diagnostic.code.toUpperCase(),
    category: resolutionCategory(diagnostic.code, diagnostic.category),
    title: diagnostic.staffTitle,
    staffMessage: diagnostic.staffMessage,
    crmSummary: diagnostic.crmSummary,
    whatHappened: diagnostic.crmSummary,
    whyProtected: attendanceChanged
      ? "The recorded Attendance change is preserved while the review is completed."
      : "Attendance was left unchanged to protect the staff record.",
    recommendedSteps: [diagnostic.immediateResolution, diagnostic.staffPrevention],
    resolutionOwner: owner,
    staffActionRequired: diagnostic.staffCanResolve,
    crmActionRequired: owner === "crm",
    technicalSupportRequired: owner === "technical_support",
    canRetry,
    retryLabel:
      diagnostic.code === "stale_app_version" ? "Refresh safely" : canRetry ? "Retry once" : null,
    attendanceChanged,
    incidentRequired: !["automatic", "staff"].includes(owner) || diagnostic.severity === "critical",
    severity: diagnostic.severity,
    suggestedActions: [diagnostic.crmPrimaryAction],
    staffActionLabel: diagnostic.staffActionLabel,
    staffActionHref: diagnostic.staffActionHref,
    staffPrevention: diagnostic.staffPrevention,
    rootCause: diagnostic.rootCause,
    preventionAction: diagnostic.preventionAction,
    verification: diagnostic.verification,
    operationId: result.operationId,
  };
}

export function withAttendanceScanResolution(result: PublicScanResult): PublicScanResult {
  if (result.resolution) return result;
  return { ...result, resolution: classifyAttendanceScanResult(result) };
}
