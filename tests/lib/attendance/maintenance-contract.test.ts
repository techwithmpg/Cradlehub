import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

function functionBody(file: string, signature: string, nextSignature?: string): string {
  const start = file.indexOf(signature);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = nextSignature ? file.indexOf(nextSignature, start + signature.length) : file.length;
  expect(end).toBeGreaterThan(start);
  return file.slice(start, end);
}

describe("Attendance maintenance source contract", () => {
  it("keeps the environment variable server-only and centralized", () => {
    const helper = source("src/lib/attendance/maintenance-mode.ts");
    expect(helper).toContain('import "server-only"');
    expect(helper).toContain('=== "true"');

    const guardedSources = [
      "src/lib/attendance/scan-engine.ts",
      "src/lib/attendance/queries.ts",
      "src/lib/actions/staff-checkins.ts",
      "src/app/scan/actions.ts",
      "src/app/(dashboard)/crm/attendance/actions.ts",
      "src/app/(dashboard)/staff-portal/actions.ts",
    ].map(source);
    expect(guardedSources.join("\n")).not.toContain("ATTENDANCE_MAINTENANCE_MODE");
  });

  it("short-circuits Attendance QR scans before replay, device, event, or incident work", () => {
    const scan = source("src/lib/attendance/scan-engine.ts");
    const entry = functionBody(
      scan,
      "export async function processQrScan(",
      "export async function activateDeviceWithToken("
    );
    expect(entry.indexOf("isAttendanceMaintenanceMode()")).toBeLessThan(
      entry.indexOf("loadCommittedScanResult")
    );
    expect(entry.indexOf("isAttendanceMaintenanceMode()")).toBeLessThan(
      entry.indexOf("persistCommittedScanResult")
    );

    const fresh = functionBody(
      scan,
      "async function processQrScanFresh(",
      "export async function processQrScan("
    );
    const guard = fresh.indexOf('point?.point_type === "attendance"');
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(fresh.indexOf("getAttendanceSettings"));
    expect(guard).toBeLessThan(fresh.indexOf("resolveDevice"));
    expect(guard).toBeLessThan(fresh.indexOf("recordScanEvent"));
    expect(guard).toBeLessThan(fresh.indexOf("recordException"));
  });

  it("guards corrections, saved-scan resolution, devices, closing jobs, and branch review writes", () => {
    const correction = source("src/lib/attendance/attendance-correction-service.ts");
    const deviceRegistration = source("src/lib/attendance/device-registration.ts");
    const deviceRecovery = source("src/lib/attendance/device-recovery.ts");
    const closing = source("src/lib/attendance/closing-interventions.ts");
    const branchCorrection = source("src/lib/staff/branch-correction.ts");
    const crmActions = source("src/app/(dashboard)/crm/attendance/actions.ts");

    expect(correction.match(/assertAttendanceWritable\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(
      deviceRegistration.match(/assertAttendanceWritable\(\)/g)?.length
    ).toBeGreaterThanOrEqual(5);
    expect(deviceRecovery.match(/assertAttendanceWritable\(\)/g)?.length).toBeGreaterThanOrEqual(6);
    expect(closing.indexOf("isAttendanceMaintenanceMode()")).toBeLessThan(
      closing.indexOf("process_due_attendance_closing_interventions")
    );
    expect(
      branchCorrection.match(/isAttendanceMaintenanceMode\(\)/g)?.length
    ).toBeGreaterThanOrEqual(6);
    expect(crmActions).toContain("getContextOrResult");
    expect(crmActions).toContain("!allowDuringMaintenance && isAttendanceMaintenanceMode()");
  });

  it("keeps history/navigation visible while CRM, owner, and profile mutation regions are read-only", () => {
    const crm = source("src/components/features/attendance/crm-attendance-workspace.tsx");
    const owner = source(
      "src/app/(dashboard)/owner/branches/[branchId]/branch-attendance-rules-card.tsx"
    );
    const phone = source("src/components/features/staff-portal/attendance-phone-card.tsx");
    const staffPage = source("src/app/(dashboard)/staff-portal/attendance/page.tsx");

    expect(crm).toContain("AttendanceMaintenanceBanner");
    expect(crm).toContain("<CrmAttendanceNavigation");
    expect(crm).toContain("inert={maintenance.active}");
    expect(owner).toContain('<TabsTrigger value="history">History</TabsTrigger>');
    expect(owner).toContain("inert={maintenance.active}");
    expect(phone).toContain(
      "Attendance phone changes are temporarily unavailable during maintenance."
    );
    expect(staffPage.indexOf("AttendanceMaintenanceBanner")).toBeLessThan(
      staffPage.indexOf("<StaffAttendanceHistory")
    );
  });

  it("removes only live Attendance preference from operational availability", () => {
    for (const path of [
      "src/lib/queries/crm-availability.ts",
      "src/lib/queries/crm-readiness.ts",
      "src/lib/engine/availability.ts",
      "src/lib/engine/exact-crm-booking-time.ts",
      "src/lib/assignments/recommendation-engine.ts",
      "src/lib/actions/attendance-queue.ts",
    ]) {
      expect(source(path)).toContain("isAttendanceMaintenanceMode");
    }
  });
});
