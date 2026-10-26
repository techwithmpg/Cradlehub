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
  // Follow maintained route owners; some existing Setup Health links are legacy.
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

  // Filter out archived or already merged accounts
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
        const reason = matchName && matchPhone
          ? "identical name and phone number"
          : matchName
            ? "identical full name"
            : "matching phone number";

        issues.push({
          id: "staff:duplicate:" + pairKey,
          area: "staff_identity",
          severity: "warning",
          resolutionState: "under_review",
          title: `Potential duplicate staff record: ${a.full_name}`,
          description: `Profiles for ${a.full_name} share ${reason}. Review account activity and identity before making any change.`,
          guidance: "Compare identity, login status, registered devices, and history. Automatic account deletion or merge is prohibited to preserve audit and payroll integrity.",
          actionLabel: "Compare accounts",
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

export function buildOperationsIssues(
  attendance: Pick<AttendanceWorkspaceData, 'exceptions'> | null,
  setup: CrmSetupHealthData | null,
  staffList?: OperationalStaffMember[] | null
): OperationsIssue[] {
  const attendanceIssues: OperationsIssue[] = attendance
    ? buildAttendanceReviewItems(attendance.exceptions).map((item) => {
        const isPhone = item.diagnostic.resolutionKind === "phone" || item.diagnostic.code === "DEVICE_LIMIT_REACHED";
        const isBranch = item.diagnostic.resolutionKind === "branch";
        const staffId = item.exception.staff_id;
        const actionHref = isPhone && staffId
          ? "/crm/attendance?view=setup&section=phones&staffId=" + encodeURIComponent(staffId)
          : isBranch
            ? "/crm/attendance?view=review"
            : "/crm/attendance?view=review";

        let resolutionState: OperationsResolutionState = "detected";
        if (item.exception.status === "in_review") resolutionState = "under_review";
        if (item.exception.status === "pending_action") resolutionState = "pending_action";

        return {
          id: "attendance:" + item.exception.id,
          area: "attendance" as const,
          severity: item.priority === "critical" ? ("critical" as const) : ("warning" as const),
          resolutionState,
          title: item.title,
          description: item.diagnostic.crmSummary,
          guidance: item.diagnostic.crmInstruction,
          actionLabel: item.recommendedAction,
          actionHref,
          code: item.diagnostic.code,
          scanIdSuffix: scanSuffix(item.exception.scan_event_id ?? item.exception.latest_scan_event_id),
          detectedAt: item.exception.detected_at,
          staffId: item.exception.staff_id ?? null,
          staffName: item.exception.staff_name ?? null,
          resolutionKind: "attendance_router" as const,
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
        title: `${svc.serviceName} has no assigned provider`,
        description: "Active branch service has zero assigned therapists in staff_services. Customers cannot complete bookings for this service.",
        guidance: "Assign at least one active therapist, nail technician, or aesthetician to this service at this branch.",
        actionLabel: "Assign provider",
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

  const staffIssues = buildStaffDuplicateIssues(staffList);

  const rank = { critical: 0, warning: 1, info: 2 };
  return [...attendanceIssues, ...specificServiceIssues, ...configIssues, ...staffIssues].sort(
    (a, b) => rank[a.severity] - rank[b.severity]
  );
}

export function recentUnsuccessfulScans(attendance: AttendanceWorkspaceData | null): OperationsScan[] {
  if (!attendance) return [];

  // Group successful scans by staffId with their millisecond timestamps
  const successfulTimestampsByStaff = new Map<string, number[]>();
  for (const scan of attendance.scanEvents) {
    if (scan.outcome === "success" && scan.staff_id) {
      const ts = new Date(scan.created_at).getTime();
      const existing = successfulTimestampsByStaff.get(scan.staff_id) ?? [];
      existing.push(ts);
      successfulTimestampsByStaff.set(scan.staff_id, existing);
    }
  }

  // Staff members with active open device/phone exceptions
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

      // Staff identity check: Unknown device identity (no staff_id) can NEVER be recovered
      const hasKnownStaff = Boolean(event.staff_id);
      const eventTime = new Date(event.created_at).getTime();

      // Subsequent success check: Must have a success strictly AFTER this failure event
      const staffSuccessTimes = hasKnownStaff
        ? successfulTimestampsByStaff.get(event.staff_id!) ?? []
        : [];
      const hasSubsequentSuccess = staffSuccessTimes.some((time) => time > eventTime);

      // Do not claim an affected phone was repaired solely from another device's successful scan:
      // While an open device exception exists for this staff member, the failure remains an active blocker.
      // Once the device problem is authoritatively cleared (no open device exception remains)
      // and a subsequent successful scan occurs, the failure is preserved as historical and marked recovered.
      const hasActiveDeviceBlocker =
        hasKnownStaff &&
        isDeviceFailure &&
        staffWithOpenDeviceExceptions.has(event.staff_id!);

      const isRecovered =
        !isDuplicateNoop &&
        hasKnownStaff &&
        hasSubsequentSuccess &&
        !hasActiveDeviceBlocker;

      const isUnresolvedFailure =
        !isDuplicateNoop &&
        !isRecovered &&
        (event.outcome === "blocked" || event.outcome === "exception");

      return {
        id: event.id,
        staffId: event.staff_id ?? null,
        staffName: event.staff_name ?? "Unidentified staff",
        reasonCode: event.reason_code ?? "SCAN_REVIEW",
        message: event.message ?? "Scan did not complete successfully.",
        scanIdSuffix: scanSuffix(event.id) ?? "",
        occurredAt: event.created_at,
        isUnresolvedFailure,
      };
    });
}

export function issueMatchesSearch(issue: OperationsIssue, search: string): boolean {
  if (!search) return true;
  const term = search.toLowerCase();
  return [
    issue.title,
    issue.description,
    issue.guidance,
    issue.code,
    issue.scanIdSuffix,
    issue.staffName,
    issue.staffId,
    issue.serviceName,
    issue.serviceId,
  ].some((value) => value?.toLowerCase().includes(term));
}

export function scanMatchesSearch(scan: OperationsScan, search: string): boolean {
  if (!search) return true;
  const term = search.toLowerCase();
  return [
    scan.staffName,
    scan.staffId,
    scan.reasonCode,
    scan.message,
    scan.scanIdSuffix,
  ].some((value) => value?.toLowerCase().includes(term));
}
