import { describe, expect, it } from "vitest";
import {
  buildOperationsIssues,
  buildStaffDuplicateIssues,
  issueMatchesSearch,
  recentUnsuccessfulScans,
  scanMatchesSearch,
  type OperationalStaffMember,
} from "@/lib/operations-center/issue-model";
import { isEligibleServiceProvider } from "@/constants/staff-roles";
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
    hasLoginAccount: true,
    isIdentityVerified: true,
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
    hasLoginAccount: false,
    isIdentityVerified: false,
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
    hasLoginAccount: true,
    isIdentityVerified: true,
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
    expect(combined[0]!.severity).toBe("critical");
    expect(combined[0]!.resolutionKind).toBe("provider_assignment");
  });

  it("distinguishes successes before failures from successes after failures using timestamps", () => {
    const timelineData = {
      exceptions: [],
      scanEvents: [
        // Staff A: success at 08:00, blocked failure at 09:00 (success BEFORE failure)
        {
          id: "scan-a-success-early",
          staff_id: "staff-a",
          outcome: "success",
          created_at: "2026-10-25T08:00:00.000Z",
        },
        {
          id: "scan-a-blocked-later",
          staff_id: "staff-a",
          outcome: "blocked",
          reason_code: "BRANCH_MISMATCH",
          message: "Scanned at wrong branch",
          created_at: "2026-10-25T09:00:00.000Z",
        },
        // Staff B: blocked failure at 08:30, success at 09:30 (success AFTER failure)
        {
          id: "scan-b-blocked-early",
          staff_id: "staff-b",
          outcome: "blocked",
          reason_code: "BRANCH_MISMATCH",
          message: "Scanned at wrong branch",
          created_at: "2026-10-25T08:30:00.000Z",
        },
        {
          id: "scan-b-success-later",
          staff_id: "staff-b",
          outcome: "success",
          created_at: "2026-10-25T09:30:00.000Z",
        },
      ],
    } as unknown as AttendanceWorkspaceData;

    const scans = recentUnsuccessfulScans(timelineData);
    expect(scans).toHaveLength(2);

    const scanA = scans.find((s) => s.id === "scan-a-blocked-later");
    const scanB = scans.find((s) => s.id === "scan-b-blocked-early");

    // Success BEFORE failure does NOT resolve the later failure:
    expect(scanA?.isUnresolvedFailure).toBe(true);

    // Success AFTER failure resolves the earlier failure:
    expect(scanB?.isUnresolvedFailure).toBe(false);
  });

  it("treats scans with unknown device/staff identity as unresolved failures", () => {
    const unknownData = {
      exceptions: [],
      scanEvents: [
        {
          id: "scan-unknown-device",
          staff_id: null,
          staff_name: null,
          outcome: "blocked",
          reason_code: "UNRECOGNIZED_DEVICE",
          message: "Device not recognized",
          created_at: "2026-10-25T09:00:00.000Z",
        },
        // Other staff members had successful scans
        {
          id: "scan-other-staff-success",
          staff_id: "staff-other",
          outcome: "success",
          created_at: "2026-10-25T09:05:00.000Z",
        },
      ],
    } as unknown as AttendanceWorkspaceData;

    const scans = recentUnsuccessfulScans(unknownData);
    expect(scans).toHaveLength(1);
    expect(scans[0]!.staffId).toBeNull();
    // Cannot be recovered by other staff's scans:
    expect(scans[0]!.isUnresolvedFailure).toBe(true);
  });

  it("does not claim an affected phone was repaired solely from another device's scan when an open device exception exists", () => {
    const deviceBlockerData = {
      exceptions: [
        {
          id: "ex-device-limit",
          staff_id: "staff-device-blocked",
          status: "open",
          severity: "warning",
          exception_type: "device_limit_reached",
          safe_error_code: "DEVICE_LIMIT_REACHED",
          metadata: {},
          detected_at: "2026-10-25T09:00:00.000Z",
        },
      ],
      scanEvents: [
        {
          id: "scan-phone-limit-reached",
          staff_id: "staff-device-blocked",
          staff_name: "Device Blocked Staff",
          outcome: "blocked",
          reason_code: "DEVICE_LIMIT_REACHED",
          message: "Active device limit reached",
          created_at: "2026-10-25T09:00:00.000Z",
        },
        // Staff member scans from a different already-registered device
        {
          id: "scan-from-other-device",
          staff_id: "staff-device-blocked",
          staff_name: "Device Blocked Staff",
          outcome: "success",
          created_at: "2026-10-25T09:10:00.000Z",
        },
      ],
    } as unknown as AttendanceWorkspaceData;

    const scans = recentUnsuccessfulScans(deviceBlockerData);
    expect(scans).toHaveLength(1);
    // Because the open device limit exception remains active, the phone failure is NOT falsely claimed repaired:
    expect(scans[0]!.isUnresolvedFailure).toBe(true);
  });


  it("marks DEVICE_LIMIT_REACHED scan recovered after phone replacement, closed exception, and subsequent successful scan while preserving history", () => {
    // Stage 1: Initial failure with open exception
    const openFailureData = {
      exceptions: [
        {
          id: "ex-limit",
          staff_id: "staff-1",
          status: "open",
          severity: "warning",
          exception_type: "device_limit_reached",
          safe_error_code: "DEVICE_LIMIT_REACHED",
          metadata: {},
          detected_at: "2026-10-25T09:00:00.000Z",
        },
      ],
      scanEvents: [
        {
          id: "scan-fail-1",
          staff_id: "staff-1",
          staff_name: "Staff 1",
          outcome: "blocked",
          reason_code: "DEVICE_LIMIT_REACHED",
          message: "Device limit reached",
          created_at: "2026-10-25T09:00:00.000Z",
        },
      ],
    } as unknown as AttendanceWorkspaceData;

    const initialScans = recentUnsuccessfulScans(openFailureData);
    expect(initialScans).toHaveLength(1);
    expect(initialScans[0]!.isUnresolvedFailure).toBe(true);

    // Stage 2: Device replaced, exception closed/resolved, and subsequent scan succeeds
    const resolvedData = {
      exceptions: [
        {
          id: "ex-limit",
          staff_id: "staff-1",
          status: "resolved",
          severity: "warning",
          exception_type: "device_limit_reached",
          safe_error_code: "DEVICE_LIMIT_REACHED",
          metadata: {},
          detected_at: "2026-10-25T09:00:00.000Z",
          resolved_at: "2026-10-25T09:10:00.000Z",
        },
      ],
      scanEvents: [
        {
          id: "scan-fail-1",
          staff_id: "staff-1",
          staff_name: "Staff 1",
          outcome: "blocked",
          reason_code: "DEVICE_LIMIT_REACHED",
          message: "Device limit reached",
          created_at: "2026-10-25T09:00:00.000Z",
        },
        {
          id: "scan-replacement-success",
          staff_id: "staff-1",
          staff_name: "Staff 1",
          outcome: "success",
          created_at: "2026-10-25T09:15:00.000Z",
        },
      ],
    } as unknown as AttendanceWorkspaceData;

    const clearedScans = recentUnsuccessfulScans(resolvedData);
    expect(clearedScans).toHaveLength(1);
    expect(clearedScans[0]!.id).toBe("scan-fail-1");
    expect(clearedScans[0]!.reasonCode).toBe("DEVICE_LIMIT_REACHED");
    expect(clearedScans[0]!.isUnresolvedFailure).toBe(false);
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

  it("enforces canonical provider eligibility rules across branch, active status, and provider roles", () => {
    const branchId = "branch-bacolod";

    // 1. Valid therapist on correct branch
    expect(
      isEligibleServiceProvider(
        {
          is_active: true,
          staff_type: "therapist",
          system_role: "staff",
          branch_id: branchId,
        },
        branchId
      )
    ).toBe(true);

    // 2. Nail tech on correct branch
    expect(
      isEligibleServiceProvider(
        {
          is_active: true,
          staff_type: "nail_tech",
          system_role: "staff",
          branch_id: branchId,
        },
        branchId
      )
    ).toBe(true);

    // 3. Inactive staff -> ineligible
    expect(
      isEligibleServiceProvider(
        {
          is_active: false,
          staff_type: "therapist",
          system_role: "staff",
          branch_id: branchId,
        },
        branchId
      )
    ).toBe(false);

    // 4. Archived staff -> ineligible
    expect(
      isEligibleServiceProvider(
        {
          is_active: true,
          staff_type: "therapist",
          system_role: "staff",
          branch_id: branchId,
          archived_at: "2026-09-01T00:00:00Z",
        },
        branchId
      )
    ).toBe(false);

    // 5. Merged staff -> ineligible
    expect(
      isEligibleServiceProvider(
        {
          is_active: true,
          staff_type: "therapist",
          system_role: "staff",
          branch_id: branchId,
          merged_into_staff_id: "staff-primary-id",
        },
        branchId
      )
    ).toBe(false);

    // 6. Wrong branch staff -> ineligible
    expect(
      isEligibleServiceProvider(
        {
          is_active: true,
          staff_type: "therapist",
          system_role: "staff",
          branch_id: "branch-other",
        },
        branchId
      )
    ).toBe(false);

    // 6b. Missing or empty branch assignments when target branch is requested -> must be rejected
    expect(
      isEligibleServiceProvider(
        {
          is_active: true,
          staff_type: "therapist",
          system_role: "staff",
          branch_id: null,
        },
        branchId
      )
    ).toBe(false);

    expect(
      isEligibleServiceProvider(
        {
          is_active: true,
          staff_type: "therapist",
          system_role: "staff",
          branch_id: undefined,
        },
        branchId
      )
    ).toBe(false);

    expect(
      isEligibleServiceProvider(
        {
          is_active: true,
          staff_type: "therapist",
          system_role: "staff",
          branch_id: "",
        },
        branchId
      )
    ).toBe(false);

    // 7. Hard-excluded roles (driver, utility, digital_marketer) -> ineligible even if staff_type is therapist
    expect(
      isEligibleServiceProvider(
        {
          is_active: true,
          staff_type: "therapist",
          system_role: "driver",
          branch_id: branchId,
        },
        branchId
      )
    ).toBe(false);

    expect(
      isEligibleServiceProvider(
        {
          is_active: true,
          staff_type: "therapist",
          system_role: "utility",
          branch_id: branchId,
        },
        branchId
      )
    ).toBe(false);

    expect(
      isEligibleServiceProvider(
        {
          is_active: true,
          staff_type: "therapist",
          system_role: "digital_marketer",
          branch_id: branchId,
        },
        branchId
      )
    ).toBe(false);

    // 8. Non-service staff type (e.g. csr, driver, managerial) -> ineligible
    expect(
      isEligibleServiceProvider(
        {
          is_active: true,
          staff_type: "csr",
          system_role: "crm",
          branch_id: branchId,
        },
        branchId
      )
    ).toBe(false);
  });

  it("minimizes sensitive identity data by omitting raw auth identifiers in operational staff models", () => {
    for (const staff of staffSample) {
      // Must not contain raw auth_user_id UUID
      expect((staff as Record<string, unknown>).auth_user_id).toBeUndefined();
      // Must express login status via boolean flag
      expect(typeof staff.hasLoginAccount).toBe("boolean");
      expect(typeof staff.isIdentityVerified).toBe("boolean");
    }
  });
});
