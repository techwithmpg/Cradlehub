import { describe, expect, it } from "vitest";
import {
  buildOperationsIssues,
  buildStaffDuplicateIssues,
  issueMatchesSearch,
  recentUnsuccessfulScans,
  scanMatchesSearch,
  type OperationalStaffMember,
} from "@/lib/operations-center/issue-model";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";
import type { CrmSetupHealthData } from "@/lib/queries/crm-setup";

const setupWithGenericIssue = {
  issues: [
    {
      id: "no-staff-for-service",
      severity: "error",
      title: "One active service has no therapist",
      detail: "Provider assignment is missing.",
      impact: "Service cannot be booked.",
      fixLabel: "Assign therapists",
      fixHref: "/crm/services",
    },
  ],
} as unknown as CrmSetupHealthData;

const setupWithSpecificServices = {
  issues: [
    {
      id: "no-staff-for-service",
      severity: "error",
      title: "One active service has no therapist",
      detail: "Provider assignment is missing.",
      impact: "Service cannot be booked.",
      fixLabel: "Assign therapists",
      fixHref: "/crm/services",
    },
  ],
  unstaffedServices: [
    {
      serviceId: "svc-prenatal-massage",
      serviceName: "Prenatal Signature Massage",
      category: "massage",
    },
  ],
} as unknown as CrmSetupHealthData;

const attendance = {
  exceptions: [
    {
      id: "incident-1",
      branch_id: "branch-1",
      staff_id: "staff-1",
      staff_name: "Sample Staff",
      checkin_id: null,
      scan_event_id: "47baff31-3ac2-4a40-9d7e-12344f0af7d6",
      exception_type: "device_limit_reached",
      safe_error_code: "DEVICE_LIMIT_REACHED",
      severity: "warning",
      status: "open",
      message: "Device limit reached",
      metadata: {},
      detected_at: "2026-10-25T09:00:00.000Z",
      resolved_at: null,
    },
  ],
  scanEvents: [
    {
      id: "47baff31-3ac2-4a40-9d7e-12344f0af7d6",
      staff_id: "staff-1",
      staff_name: "Sample Staff",
      scan_type: "attendance",
      action: "clock_in",
      outcome: "blocked",
      reason_code: "device_limit_reached",
      message: "Device limit reached",
      created_at: "2026-10-25T09:00:00.000Z",
      point_label: "Branch QR",
      booking_id: null,
    },
    {
      id: "scan-success",
      staff_name: "Sample Staff",
      scan_type: "attendance",
      action: "clock_in",
      outcome: "success",
      reason_code: null,
      message: null,
      created_at: "2026-10-25T08:00:00.000Z",
      point_label: "Branch QR",
      booking_id: null,
    },
  ],
} as unknown as AttendanceWorkspaceData;

const staffSample: OperationalStaffMember[] = [
  {
    id: "staff-1",
    full_name: "Maria Santos",
    phone: "09171234567",
    system_role: "therapist",
    staff_type: "therapist",
    is_active: true,
    branch_id: "branch-1",
    auth_user_id: "auth-1",
    identity_verified_at: "2026-10-01T00:00:00Z",
  },
  {
    id: "staff-2",
    full_name: "Maria Santos",
    phone: "09171234567",
    system_role: "therapist",
    staff_type: "therapist",
    is_active: false,
    branch_id: "branch-1",
    auth_user_id: null,
    identity_verified_at: null,
  },
  {
    id: "staff-3",
    full_name: "Juan Dela Cruz",
    phone: "09189876543",
    system_role: "therapist",
    staff_type: "therapist",
    is_active: true,
    branch_id: "branch-1",
    auth_user_id: "auth-3",
    identity_verified_at: "2026-10-01T00:00:00Z",
  },
];

describe("Operations Center issue model and diagnostics", () => {
  it("does not fabricate findings when either source is unavailable", () => {
    expect(buildOperationsIssues(null, null)).toEqual([]);
    expect(buildOperationsIssues(null, setupWithGenericIssue)).toHaveLength(1);
    expect(buildOperationsIssues(attendance, null)).toHaveLength(1);
  });

  it("routes generic configuration repair to the existing service readiness editor when unstaffed list is empty", () => {
    const result = buildOperationsIssues(null, setupWithGenericIssue);
    expect(result[0]).toMatchObject({
      area: "configuration",
      severity: "critical",
      actionHref: "/crm/services?tab=issues",
    });
  });

  it("emits record-specific provider issues when authoritative unstaffed services are available", () => {
    const result = buildOperationsIssues(null, setupWithSpecificServices);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "configuration:service-provider:svc-prenatal-massage",
      area: "configuration",
      severity: "critical",
      title: "Prenatal Signature Massage has no assigned provider",
      resolutionKind: "provider_assignment",
      serviceId: "svc-prenatal-massage",
      serviceName: "Prenatal Signature Massage",
    });
    expect(issueMatchesSearch(result[0]!, "prenatal")).toBe(true);
  });

  it("keeps a device-limit incident read-only and points to the selected staff phone controls", () => {
    const result = buildOperationsIssues(attendance, null);
    expect(result[0]).toMatchObject({
      area: "attendance",
      actionHref: "/crm/attendance?view=setup&section=phones&staffId=staff-1",
      scanIdSuffix: "4F0AF7D6",
    });
    expect(issueMatchesSearch(result[0]!, "4f0af7d6")).toBe(true);
  });

  it("searches blocked scan IDs and does not classify successful scans as unsuccessful", () => {
    const scans = recentUnsuccessfulScans(attendance);
    expect(scans).toHaveLength(1);
    expect(scans[0]!.staffId).toBe("staff-1");
    expect(scanMatchesSearch(scans[0]!, "device_limit_reached")).toBe(true);
    expect(scanMatchesSearch(scans[0]!, "4f0af7d6")).toBe(true);
  });

  it("detects potential duplicate staff accounts non-destructively", () => {
    const duplicates = buildStaffDuplicateIssues(staffSample);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]).toMatchObject({
      area: "staff_identity",
      severity: "warning",
      resolutionKind: "staff_duplicate",
      code: "STAFF_DUPLICATE_SUSPECTED",
    });
    expect(duplicates[0]!.title).toContain("Maria Santos");
  });

  it("combines attendance, configuration, and staff identity issues in priority order", () => {
    const combined = buildOperationsIssues(attendance, setupWithSpecificServices, staffSample);
    expect(combined.length).toBe(3);
    // Critical (service provider) should rank before warning (device limit & staff duplicate)
    expect(combined[0]!.severity).toBe("critical");
    expect(combined[0]!.resolutionKind).toBe("provider_assignment");
  });
  it("distinguishes unresolved scan blockers from transient or recovered attempts", () => {
    const attendanceWithRecovery = {
      exceptions: [],
      scanEvents: [
        {
          id: "scan-blocked-unresolved",
          staff_id: "staff-unresolved",
          staff_name: "Unresolved Staff",
          outcome: "blocked",
          reason_code: "DEVICE_LIMIT_REACHED",
          message: "Device limit reached",
          created_at: "2026-10-25T09:00:00.000Z",
        },
        {
          id: "scan-blocked-recovered",
          staff_id: "staff-recovered",
          staff_name: "Recovered Staff",
          outcome: "blocked",
          reason_code: "DEVICE_LIMIT_REACHED",
          message: "Device limit reached",
          created_at: "2026-10-25T09:05:00.000Z",
        },
        {
          id: "scan-recovered-success",
          staff_id: "staff-recovered",
          staff_name: "Recovered Staff",
          outcome: "success",
          reason_code: null,
          message: null,
          created_at: "2026-10-25T09:10:00.000Z",
        },
      ],
    } as unknown as AttendanceWorkspaceData;

    const scans = recentUnsuccessfulScans(attendanceWithRecovery);
    expect(scans).toHaveLength(2);

    const unresolved = scans.find((s) => s.staffId === "staff-unresolved");
    const recovered = scans.find((s) => s.staffId === "staff-recovered");

    expect(unresolved?.isUnresolvedFailure).toBe(true);
    expect(recovered?.isUnresolvedFailure).toBe(false);
  });

  it("maps persisted states to aligned resolution states without fabricating verified history", () => {
    const attendanceWithStates = {
      exceptions: [
        {
          id: "ex-1",
          status: "open",
          severity: "critical",
          exception_type: "device_limit_reached",
          safe_error_code: "DEVICE_LIMIT_REACHED",
          metadata: {},
          detected_at: "2026-10-25T09:00:00.000Z",
        },
      ],
      scanEvents: [],
    } as unknown as AttendanceWorkspaceData;

    const issues = buildOperationsIssues(attendanceWithStates, setupWithSpecificServices, staffSample);
    expect(issues).toHaveLength(3);

    const attendanceIssue = issues.find((i) => i.area === "attendance");
    const configIssue = issues.find((i) => i.area === "configuration");
    const staffIssue = issues.find((i) => i.area === "staff_identity");

    expect(attendanceIssue?.resolutionState).toBe("detected");
    expect(configIssue?.resolutionState).toBe("detected");
    expect(staffIssue?.resolutionState).toBe("under_review");
    expect(issues.some((i) => (i.resolutionState as string) === "verified")).toBe(false);
  });
});
