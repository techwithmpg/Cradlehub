import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
}

describe("normal attendance geofence boundary", () => {
  it("checks location before idempotent replay and scan processing", () => {
    const engine = source("src/lib/attendance/scan-engine.ts");
    const boundary = engine.slice(engine.indexOf("export async function processQrScan("));
    expect(boundary.indexOf("verifyAttendanceGeofence({")).toBeGreaterThan(0);
    expect(boundary.indexOf("verifyAttendanceGeofence({")).toBeLessThan(
      boundary.indexOf("loadCommittedScanResult(")
    );
    expect(boundary.indexOf("verifyAttendanceGeofence({")).toBeLessThan(
      boundary.indexOf("processQrScanFresh(")
    );
    expect(boundary).toContain('pointForGeofence.point_type === "attendance"');
  });

  it("passes location through API, direct action, and first-scan continuation", () => {
    const route = source("src/app/api/attendance/public-scan/route.ts");
    const actions = source("src/app/scan/actions.ts");
    expect(route).toContain("location: input.location");
    expect(actions.match(/location: input\.location/g)).toHaveLength(2);
    expect(actions).toContain('appendRequestStep(rootOperationId, "attendance")');
  });

  it("keeps dedicated policy-backed portal clock-out separate", () => {
    const portal = source("src/app/(dashboard)/staff-portal/actions.ts");
    expect(portal).toContain('admin.rpc("commit_attendance_portal_clock_out"');
    expect(portal).toContain("p_device_fingerprint_hash: hashSecret(rawDeviceCredential)");
  });
});
