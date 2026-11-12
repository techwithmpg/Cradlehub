import { buildAttendanceReviewItems } from "@/lib/attendance/crm-review";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";
import type { CrmSetupHealthData } from "@/lib/queries/crm-setup";

export type OperationsIssueArea = "attendance" | "configuration" | "staff_identity";
export type OperationsIssueSeverity = "critical" | "warning" | "info";
export type OperationsResolutionState = "detected" | "under_review" | "pending_action";
export type OperationsResolutionKind =
  | "attendance_router"
  | "provider_assignment"
  | "staff_duplicate"
  | "device_recovery"
  | "staff_config_push"
  | "guidance";

export type OperationsIssue = {
  id: string;
  area: OperationsIssueArea;
  severity: OperationsIssueSeverity;
  resolutionState: OperationsResolutionState;
  title: string;
  description: string;
  guidance: string;
  actionLabel: string;
  actionHref: string;
  code: string | null;
  scanIdSuffix: string | null;
  detectedAt: string | null;
  staffId?: string | null;
  staffName?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  resolutionKind?: OperationsResolutionKind;
  staffPromptKind?: "missing_phone_device" | "incomplete_profile" | "missing_schedule" | "general_setup";
};

export type OperationsScan = {
  id: string;
  staffId: string | null;
  staffName: string;
  reasonCode: string;
  message: string;
  scanIdSuffix: string;
  occurredAt: string;
  isUnresolvedFailure: boolean;
};

export type OperationalStaffMember = {
  id: string;
  full_name: string;
  nickname?: string | null;
  phone?: string | null;
  system_role: string;
  staff_type: string;
  tier?: string | null;
  is_active: boolean;
  branch_id: string;
  hasLoginAccount: boolean;
  isIdentityVerified: boolean;
  identity_verified_at?: string | null;
  archived_at?: string | null;
  merged_into_staff_id?: string | null;
  created_at?: string | null;
};

function scanSuffix(id: string | null | undefined): string | null {
  return id ? id.replaceAll("-", "").slice(-8).toUpperCase() : null;
}

function configurationAction(issue: CrmSetupHealthData["issues"][number]): string {
  const byIssue: Record<string, string> = {
    "no-schedule": "/crm/schedule?tab=setup",
    "no-staff-for-service": "/crm/services?tab=issues",
    "no-drivers": "/crm/staff?tab=management",
    "no-resources": "/crm/spaces-rules",
    "default-rules": "/crm/spaces-rules",
    "unassigned-bookings": "/crm/today?filter=needs_action",
  };
  return byIssue[issue.id] ?? "/crm/setup";
}

export function buildStaffDuplicateIssues(
  staffList: OperationalStaffMember[] | null | undefined
): OperationsIssue[] {
  if (!staffList || staffList.length < 2) return [];

  const issues: OperationsIssue[] = [];
  const seenPairKeys = new Set<string>();
  const activeCandidates = staffList.filter(
    (s) => !s.archived_at && !s.merged_into_staff_id
  );

  for (let i = 0; i < activeCandidates.length; i++) {
    for (let j = i + 1; j < activeCandidates.length; j++) {
      const a = activeCandidates[i]!;
      const b = activeCandidates[j]!;

      const pairKey = [a.id, b.id].sort().join(":");
      if (seenPairKeys.has(pairKey)) continue;

      const normNameA = a.full_name.trim().toLowerCase().replace(/\s+/g, " ");
      const normNameB = b.full_name.trim().toLowerCase().replace(/\s+/g, " ");

      const digitsA = a.phone?.replace(/\D/g, "") ?? "";
      const digitsB = b.phone?.replace(/\D/g, "") ?? "";

      const matchName = normNameA.length > 2 && normNameA === normNameB;
      const matchPhone = digitsA.length >= 7 && digitsA === digitsB;

      if (matchName || matchPhone) {
        seenPairKeys.add(pairKey);
        const reason =
          matchName && matchPhone
            ? "the same full name and phone number"
            : matchName
              ? "the same full name"
              : "the same phone number";

        issues.push({
          id: "staff:duplicate:" + pairKey,
          area: "staff_identity",
          severity: "warning",
          resolutionState: "under_review",
          title: `Duplicate Staff Profile: ${a.full_name}`,
          description: `Two staff profiles share ${reason}. Having two profiles causes QR scan and schedule mix-ups.`,
          guidance:
            "Compare both profiles and keep only the active one linked to their phone.",
          actionLabel: "Compare Profiles",
          actionHref: "/crm/staff?tab=management&staffId=" + encodeURIComponent(a.id),
          code: "STAFF_DUPLICATE_SUSPECTED",
          scanIdSuffix: null,
          detectedAt: b.created_at ?? a.created_at ?? null,
          staffId: a.id,
          staffName: a.full_name,
          resolutionKind: "staff_duplicate",
        });
      }
    }
  }

  return issues;
}

/**
 * Flags active staff members who have incomplete account/device configuration
 * so Front Desk can either send a 1-tap setup push/QR straight to their portal or fix it in CRM.
 */
export function buildStaffConfigurationIssues(
  staffList: OperationalStaffMember[] | null | undefined,
  attendance: (Pick<AttendanceWorkspaceData, 'exceptions'> & Partial<AttendanceWorkspaceData>) | null
): OperationsIssue[] {
  if (!staffList || staffList.length === 0) return [];

  const issues: OperationsIssue[] = [];
  const registeredStaffIds = new Set(
    (attendance?.deviceRegistry?.entries ?? [])
      .filter((entry) => Boolean(entry.device))
      .map((entry) => entry.staffId)
  );

  const activeStaff = staffList.filter(
    (s) => s.is_active && !s.archived_at && !s.merged_into_staff_id
  );

  for (const s of activeStaff) {
    const roleLower = (s.system_role || "").toLowerCase();
    if (roleLower === "owner" || roleLower === "super_admin") continue;

    // 1. Staff member has no registered phone for QR attendance scanning
    if (attendance?.deviceRegistry && !registeredStaffIds.has(s.id)) {
      issues.push({
        id: `staff:no-phone:${s.id}`,
        area: "staff_identity",
        severity: "warning",
        resolutionState: "detected",
        title: `${s.full_name} has no phone linked for QR Attendance`,
        description: `${s.full_name} (${s.staff_type || s.system_role}) does not have an active phone connected yet, so their QR scans will require sign-in or fail.`,
        guidance:
          "Click 'Send Phone Setup Link' to push a 1-tap connection link and QR code straight to their Staff Portal.",
        actionLabel: "Send Phone Setup Link",
        actionHref: `/crm/attendance?view=setup&section=phones&staffId=${encodeURIComponent(s.id)}`,
        code: "STAFF_PHONE_NOT_LINKED",
        scanIdSuffix: null,
        detectedAt: s.created_at ?? null,
        staffId: s.id,
        staffName: s.full_name,
        resolutionKind: "staff_config_push",
        staffPromptKind: "missing_phone_device",
      });
    }

    // 2. Staff member is missing phone number or portal login
    if (!s.hasLoginAccount || !s.phone || s.phone.trim().length < 7) {
      const missingParts = [
        !s.hasLoginAccount ? "Portal Login" : null,
        !s.phone || s.phone.trim().length < 7 ? "Mobile Number" : null,
      ].filter(Boolean);

      issues.push({
        id: `staff:incomplete-account:${s.id}`,
        area: "staff_identity",
        severity: !s.hasLoginAccount ? "critical" : "warning",
        resolutionState: "detected",
        title: `${s.full_name} is missing: ${missingParts.join(" & ")}`,
        description: `Without a ${missingParts.join(" and ").toLowerCase()}, ${s.full_name} cannot receive shift notifications or scan smoothly.`,
        guidance: s.hasLoginAccount
          ? "Send a prompt to their Staff Portal to fill in their mobile number, or update their profile directly."
          : "Open their Staff Profile in CRM to activate their login account and send their invite link.",
        actionLabel: s.hasLoginAccount ? "Notify Staff to Complete" : "Set Up Account in CRM",
        actionHref: `/crm/staff?tab=management&staffId=${encodeURIComponent(s.id)}`,
        code: "STAFF_ACCOUNT_INCOMPLETE",
        scanIdSuffix: null,
        detectedAt: s.created_at ?? null,
        staffId: s.id,
        staffName: s.full_name,
        resolutionKind: s.hasLoginAccount ? "staff_config_push" : "guidance",
        staffPromptKind: "incomplete_profile",
      });
    }
  }

  return issues;
}

export function buildOperationsIssues(
  attendance: (Pick<AttendanceWorkspaceData, 'exceptions'> & Partial<AttendanceWorkspaceData>) | null,
  setup: CrmSetupHealthData | null,
  staffList?: OperationalStaffMember[] | null
): OperationsIssue[] {
  // Operations Center only shows Phone Limit / Blocked Device exceptions from attendance (never the 403 daily shift mismatches!)
  const attendancePhoneIssues: OperationsIssue[] = attendance
    ? buildAttendanceReviewItems(attendance.exceptions)
        .filter(
          (item) =>
            item.diagnostic.resolutionKind === "phone" ||
            item.diagnostic.code === "DEVICE_LIMIT_REACHED"
        )
        .map((item) => {
          const staffId = item.exception.staff_id;
          const staffName = item.exception.staff_name ?? "Staff member";
          return {
            id: "attendance:" + item.exception.id,
            area: "staff_identity" as const,
            severity: "critical" as const,
            resolutionState: "detected" as const,
            title: `${staffName} reached the phone limit or switched phones`,
            description: `${staffName} tried to scan from a new phone, but their account is still locked to an older phone.`,
            guidance:
              "Click 'Reset & Send Link to Portal' to clear their old phone and send a 1-tap connection link straight to their Staff Portal.",
            actionLabel: "Reset & Send Link to Portal",
            actionHref: staffId
              ? `/crm/attendance?view=setup&section=phones&staffId=${encodeURIComponent(staffId)}`
              : "/crm/attendance?view=review",
            code: item.diagnostic.code,
            scanIdSuffix: scanSuffix(
              item.exception.scan_event_id ?? item.exception.latest_scan_event_id
            ),
            detectedAt: item.exception.detected_at,
            staffId: staffId ?? null,
            staffName,
            resolutionKind: "staff_config_push" as const,
            staffPromptKind: "missing_phone_device" as const,
          };
        })
    : [];

  const specificServiceIssues: OperationsIssue[] = [];
  if (setup?.unstaffedServices && setup.unstaffedServices.length > 0) {
    for (const svc of setup.unstaffedServices) {
      specificServiceIssues.push({
        id: "configuration:service-provider:" + svc.serviceId,
        area: "configuration",
        severity: "critical",
        resolutionState: "detected",
        title: `Service "${svc.serviceName}" has no assigned therapists`,
        description:
          "Customers and Front Desk cannot book this service until at least one therapist or provider is assigned to perform it.",
        guidance:
          "Click 'Assign Providers' to select which staff members can perform this service.",
        actionLabel: "Assign Providers",
        actionHref: "/crm/services?tab=issues&serviceId=" + encodeURIComponent(svc.serviceId),
        code: "SERVICE_NO_PROVIDER",
        scanIdSuffix: null,
        detectedAt: null,
        serviceId: svc.serviceId,
        serviceName: svc.serviceName,
        resolutionKind: "provider_assignment",
      });
    }
  }

  const hasSpecificServiceIssues = specificServiceIssues.length > 0;

  const configIssues: OperationsIssue[] = setup
    ? setup.issues
        .filter((issue) => !(hasSpecificServiceIssues && issue.id === "no-staff-for-service"))
        .map((issue) => ({
          id: "configuration:" + issue.id,
          area: "configuration" as const,
          severity: issue.severity === "error" ? ("critical" as const) : issue.severity,
          resolutionState: "detected" as const,
          title: issue.title,
          description: issue.detail,
          guidance: issue.impact,
          actionLabel: issue.fixLabel,
          actionHref: configurationAction(issue),
          code: null,
          scanIdSuffix: null,
          detectedAt: null,
          resolutionKind: "guidance" as const,
        }))
    : [];

  const duplicateIssues = buildStaffDuplicateIssues(staffList);
  const staffConfigIssues = buildStaffConfigurationIssues(staffList, attendance);

  const rank = { critical: 0, warning: 1, info: 2 };
  return [
    ...specificServiceIssues,
    ...configIssues,
    ...attendancePhoneIssues,
    ...staffConfigIssues,
    ...duplicateIssues,
  ].sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export function recentUnsuccessfulScans(attendance: AttendanceWorkspaceData | null): OperationsScan[] {
  if (!attendance) return [];

  const successfulTimestampsByStaff = new Map<string, number[]>();
  for (const scan of attendance.scanEvents) {
    if (scan.outcome === "success" && scan.staff_id) {
      const ts = new Date(scan.created_at).getTime();
      const existing = successfulTimestampsByStaff.get(scan.staff_id) ?? [];
      existing.push(ts);
      successfulTimestampsByStaff.set(scan.staff_id, existing);
    }
  }

  const staffWithOpenDeviceExceptions = new Set(
    (attendance.exceptions ?? [])
      .filter(
        (ex) =>
          Boolean(ex.staff_id) &&
          ex.status === "open" &&
          (ex.exception_type.toLowerCase().includes("device") ||
            (ex.safe_error_code ?? "").toUpperCase().includes("DEVICE"))
      )
      .map((ex) => ex.staff_id as string)
  );

  return attendance.scanEvents
    .filter((event) => event.outcome !== "success")
    .map((event) => {
      const reasonUpper = (event.reason_code ?? "").toUpperCase();
      const isDuplicateNoop = reasonUpper.includes("DUPLICATE") || event.outcome === "noop";
      const isDeviceFailure = reasonUpper.includes("DEVICE") || reasonUpper.includes("PHONE");

      const hasKnownStaff = Boolean(event.staff_id);
      const eventTime = new Date(event.created_at).getTime();

      const staffSuccessTimes = hasKnownStaff
        ? successfulTimestampsByStaff.get(event.staff_id!) ?? []
        : [];
      const hasSubsequentSuccess = staffSuccessTimes.some((time) => time > eventTime);

      const hasActiveDeviceBlocker =
        hasKnownStaff &&
        isDeviceFailure &&
        staffWithOpenDeviceExceptions.has(event.staff_id!);

      const isRecovered =
        !isDuplicateNoop &&
        hasKnownStaff &&
        hasSubsequentSuccess &&
        !hasActiveDeviceBlocker;

      return {
        id: event.id,
        staffId: event.staff_id ?? null,
        staffName: event.staff_name ?? "Unidentified device",
        reasonCode: event.reason_code ?? event.outcome,
        message: event.message ?? "Scan did not complete",
        scanIdSuffix: scanSuffix(event.id) ?? "SCAN",
        occurredAt: event.created_at,
        isUnresolvedFailure: !isDuplicateNoop && !isRecovered,
      };
    });
}

export function issueMatchesSearch(issue: OperationsIssue, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  return [
    issue.title,
    issue.description,
    issue.guidance,
    issue.code ?? "",
    issue.scanIdSuffix ?? "",
    issue.staffName ?? "",
    issue.serviceName ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

export function scanMatchesSearch(scan: OperationsScan, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  return [scan.staffName, scan.reasonCode, scan.message, scan.scanIdSuffix]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

