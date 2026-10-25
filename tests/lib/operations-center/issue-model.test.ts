import { describe, expect, it } from "vitest";
import {
  buildOperationsIssues,
  issueMatchesSearch,
  recentUnsuccessfulScans,
  scanMatchesSearch,
} from "@/lib/operations-center/issue-model";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";
import type { CrmSetupHealthData } from "@/lib/queries/crm-setup";

const setup = {
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

describe("Operations Center first slice", () => {
  it("does not fabricate findings when either source is unavailable", () => {
    expect(buildOperationsIssues(null, null)).toEqual([]);
    expect(buildOperationsIssues(null, setup)).toHaveLength(1);
    expect(buildOperationsIssues(attendance, null)).toHaveLength(1);
  });

  it("routes configuration repair to the existing service readiness editor", () => {
    const result = buildOperationsIssues(null, setup);
    expect(result[0]).toMatchObject({
      area: "configuration",
      severity: "critical",
      actionHref: "/crm/services?tab=issues",
    });
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
    expect(scanMatchesSearch(scans[0]!, "device_limit_reached")).toBe(true);
    expect(scanMatchesSearch(scans[0]!, "4f0af7d6")).toBe(true);
  });
});
