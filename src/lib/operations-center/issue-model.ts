import { buildAttendanceReviewItems } from "@/lib/attendance/crm-review";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";
import type { CrmSetupHealthData } from "@/lib/queries/crm-setup";

export type OperationsIssue = {
  id: string;
  area: "attendance" | "configuration";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  guidance: string;
  actionLabel: string;
  actionHref: string;
  code: string | null;
  scanIdSuffix: string | null;
  detectedAt: string | null;
};

export type OperationsScan = {
  id: string;
  staffName: string;
  reasonCode: string;
  message: string;
  scanIdSuffix: string;
  occurredAt: string;
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
    "no-resources": "/crm/setup?tab=spaces",
    "default-rules": "/crm/setup?tab=booking_rules",
    "unassigned-bookings": "/crm/today?filter=needs_action",
  };
  return byIssue[issue.id] ?? "/crm/setup?tab=health";
}

export function buildOperationsIssues(
  attendance: AttendanceWorkspaceData | null,
  setup: CrmSetupHealthData | null
): OperationsIssue[] {
  const attendanceIssues: OperationsIssue[] = attendance
    ? buildAttendanceReviewItems(attendance.exceptions).map((item) => {
        const isPhone = item.diagnostic.resolutionKind === "phone";
        const isBranch = item.diagnostic.resolutionKind === "branch";
        const staffId = item.exception.staff_id;
        const actionHref = isPhone && staffId
          ? "/crm/attendance?view=setup&section=phones&staffId=" + encodeURIComponent(staffId)
          : isBranch
            ? "/crm/attendance?view=review"
            : "/crm/attendance?view=review";
        return {
          id: "attendance:" + item.exception.id,
          area: "attendance" as const,
          severity: item.priority === "critical" ? "critical" as const : "warning" as const,
          title: item.title,
          description: item.diagnostic.crmSummary,
          guidance: item.diagnostic.crmInstruction,
          actionLabel: item.recommendedAction,
          actionHref,
          code: item.diagnostic.code,
          scanIdSuffix: scanSuffix(item.exception.scan_event_id ?? item.exception.latest_scan_event_id),
          detectedAt: item.exception.detected_at,
        };
      })
    : [];

  const configIssues: OperationsIssue[] = setup
    ? setup.issues.map((issue) => ({
        id: "configuration:" + issue.id,
        area: "configuration" as const,
        severity: issue.severity === "error" ? "critical" as const : issue.severity,
        title: issue.title,
        description: issue.detail,
        guidance: issue.impact,
        actionLabel: issue.fixLabel,
        actionHref: configurationAction(issue),
        code: null,
        scanIdSuffix: null,
        detectedAt: null,
      }))
    : [];

  const rank = { critical: 0, warning: 1, info: 2 };
  return [...attendanceIssues, ...configIssues].sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export function recentUnsuccessfulScans(attendance: AttendanceWorkspaceData | null): OperationsScan[] {
  if (!attendance) return [];
  // The source currently loads only the latest 100 scan events for the selected business day.
  return attendance.scanEvents
    .filter((event) => event.outcome !== "success")
    .map((event) => ({
      id: event.id,
      staffName: event.staff_name ?? "Unidentified staff",
      reasonCode: event.reason_code ?? "SCAN_REVIEW",
      message: event.message ?? "Scan did not complete successfully.",
      scanIdSuffix: scanSuffix(event.id) ?? "",
      occurredAt: event.created_at,
    }));
}

export function issueMatchesSearch(issue: OperationsIssue, search: string): boolean {
  if (!search) return true;
  return [
    issue.title,
    issue.description,
    issue.guidance,
    issue.code,
    issue.scanIdSuffix,
  ].some((value) => value?.toLowerCase().includes(search));
}

export function scanMatchesSearch(scan: OperationsScan, search: string): boolean {
  if (!search) return true;
  return [
    scan.staffName,
    scan.reasonCode,
    scan.message,
    scan.scanIdSuffix,
  ].some((value) => value.toLowerCase().includes(search));
}
