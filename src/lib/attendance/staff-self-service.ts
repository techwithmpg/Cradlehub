export type StaffAttendanceIssueInput = {
  id: string;
  exception_type: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  resolution_status?: string | null;
  staff_response_required?: boolean | null;
};

export type StaffAttendanceIssueGuide = {
  id: string;
  kind: "phone" | "branch" | "schedule" | "scan" | "service" | "record" | "system";
  title: string;
  guidance: string;
  actionLabel: string;
  actionHref: string;
  staffCanComplete: boolean;
  waitingForCrm: boolean;
};

const DEVICE_SIGN_IN_REASON_CODES = new Set([
  "unknown_device",
  "missing_device",
  "device_not_registered",
  "device_cookie_missing",
  "device_cookie_expired",
  "browser_data_cleared",
  "device_recovery_required",
  "unregistered_device",
]);

function internalType(issue: StaffAttendanceIssueInput): string {
  const value = issue.metadata?.internalExceptionType;
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : issue.exception_type.toLowerCase();
}

export function isStaffDeviceSignInReason(reasonCode: string | null | undefined): boolean {
  return DEVICE_SIGN_IN_REASON_CODES.has(reasonCode?.trim().toLowerCase() ?? "");
}

export function buildStaffAttendanceIssueGuide(
  issue: StaffAttendanceIssueInput
): StaffAttendanceIssueGuide {
  const type = internalType(issue);
  const message = issue.message.toLowerCase();
  const waitingForCrm = issue.resolution_status === "waiting_for_crm";

  if (
    type.includes("unknown_device") ||
    type.includes("missing_device") ||
    type.includes("device_not_registered")
  ) {
    return {
      id: issue.id,
      kind: "phone",
      title: "Connect this Attendance phone",
      guidance:
        "Scan the branch Attendance QR on this phone and sign in with your own staff account. The system will connect the phone and continue the scan automatically.",
      actionLabel: "Open phone instructions",
      actionHref: "/staff-portal/profile#attendance-phone",
      staffCanComplete: true,
      waitingForCrm: false,
    };
  }

  if (
    type.includes("revoked_device") ||
    type.includes("device_limit") ||
    type.includes("device_staff_mismatch")
  ) {
    return {
      id: issue.id,
      kind: "phone",
      title: "Attendance phone needs CRM approval",
      guidance:
        "This phone cannot be reactivated automatically. Open your phone setup and request a replacement or recovery link.",
      actionLabel: "Open phone setup",
      actionHref: "/staff-portal/profile#attendance-phone",
      staffCanComplete: false,
      waitingForCrm: true,
    };
  }

  if (type.includes("wrong_branch") || message.includes("branch")) {
    return {
      id: issue.id,
      kind: "branch",
      title: "Confirm your working branch",
      guidance:
        "Open your Attendance notification and tell CRM which branch you worked at today. CRM will approve the correct branch.",
      actionLabel: "Answer branch question",
      actionHref: "/staff-portal/notifications",
      staffCanComplete: true,
      waitingForCrm,
    };
  }

  if (
    type.includes("missing_schedule") ||
    type.includes("unscheduled") ||
    type.includes("off_day") ||
    message.includes("schedule")
  ) {
    return {
      id: issue.id,
      kind: "schedule",
      title: "Your schedule needs confirmation",
      guidance:
        "Check the schedule shown in your portal, then answer CRM whether you worked today or whether the displayed schedule is wrong.",
      actionLabel: "Review schedule and reply",
      actionHref: "/staff-portal/notifications",
      staffCanComplete: true,
      waitingForCrm,
    };
  }

  if (
    type.includes("active_service") ||
    message.includes("active service") ||
    message.includes("active assignment")
  ) {
    return {
      id: issue.id,
      kind: "service",
      title: "Complete the active service first",
      guidance: "Finish the active customer service or dispatch task before trying to clock out.",
      actionLabel: "Open active service",
      actionHref: "/staff-portal/service-progress",
      staffCanComplete: true,
      waitingForCrm: false,
    };
  }

  if (
    type.includes("duplicate_scan") ||
    message.includes("scanned again") ||
    message.includes("repeated scan")
  ) {
    return {
      id: issue.id,
      kind: "scan",
      title: "Confirm the extra scan",
      guidance:
        "Open your Attendance notification and tell CRM whether the scan was clock-in, clock-out, or a repeated scan.",
      actionLabel: "Confirm scan meaning",
      actionHref: "/staff-portal/notifications",
      staffCanComplete: true,
      waitingForCrm,
    };
  }

  if (
    type.includes("missed_checkout") ||
    type.includes("stale_open_checkin") ||
    message.includes("auto-closed") ||
    message.includes("closed even though")
  ) {
    return {
      id: issue.id,
      kind: "record",
      title: "Confirm your clock-out",
      guidance:
        "Review the time shown in your Attendance notification and tell CRM whether it is correct. CRM will make the final record correction.",
      actionLabel: "Confirm clock-out",
      actionHref: "/staff-portal/notifications",
      staffCanComplete: true,
      waitingForCrm,
    };
  }

  if (
    type.includes("clock") ||
    type.includes("ambiguous_scan") ||
    message.includes("clock-in needs review") ||
    message.includes("clock-out needs review")
  ) {
    return {
      id: issue.id,
      kind: "scan",
      title: "Confirm what your scan meant",
      guidance:
        "Answer the Attendance question with clock-in, clock-out, or repeated scan. CRM will approve the final record.",
      actionLabel: "Answer Attendance question",
      actionHref: "/staff-portal/notifications",
      staffCanComplete: true,
      waitingForCrm,
    };
  }

  return {
    id: issue.id,
    kind: "system",
    title: "Attendance needs confirmation",
    guidance:
      "Open your Attendance notifications and provide the requested details. CRM remains the final attendance manager.",
    actionLabel: "Open Attendance messages",
    actionHref: "/staff-portal/notifications",
    staffCanComplete: true,
    waitingForCrm,
  };
}
