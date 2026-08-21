import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const actions = readFileSync("src/app/scan/actions.ts", "utf8");
const route = readFileSync("src/app/api/attendance/public-scan/route.ts", "utf8");
const engine = readFileSync("src/lib/attendance/scan-engine.ts", "utf8");

function between(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  return source.slice(startIndex, endIndex < 0 ? undefined : endIndex);
}

describe("Attendance scan identity contract", () => {
  it("uses the same resolver in the public route and password continuation", () => {
    expect(route).toContain("supabase.auth.getUser()");
    expect(route).toContain("resolveAttendanceScanIdentity({");
    expect(actions).toContain("resolveAttendanceScanIdentity({");
  });

  it("keeps registered-device ownership ahead of a conflicting Auth session", () => {
    const resolver = between(
      engine,
      "export async function resolveAttendanceScanIdentity",
      "export async function disconnectAttendanceDevice"
    );
    expect(resolver.indexOf("if (device)")).toBeLessThan(
      resolver.indexOf("if (!authenticatedStaff || !input.authenticatedUserId)")
    );
    expect(resolver).toContain('state: "account_device_mismatch"');
    expect(resolver).toContain("authenticatedStaff.id !== device.staff_id");
  });

  it("switches Auth without clearing or revoking the connected phone", () => {
    const switchAction = between(
      actions,
      "export async function switchScanAccountAction",
      "export async function disconnectAttendancePhoneAction"
    );
    expect(switchAction).toContain("supabase.auth.signOut()");
    expect(switchAction).not.toContain("clearDeviceCookies");
    expect(switchAction).not.toContain("disconnectAttendanceDevice");
  });

  it("disconnects the database device and cookie without signing out Auth", () => {
    const disconnectAction = between(
      actions,
      "export async function disconnectAttendancePhoneAction",
      "export async function processPublicQrScanAction"
    );
    expect(disconnectAction).toContain("supabase.auth.getUser()");
    expect(disconnectAction.indexOf("supabase.auth.getUser()")).toBeLessThan(
      disconnectAction.indexOf("disconnectAttendanceDevice")
    );
    expect(disconnectAction).toContain("disconnectAttendanceDevice");
    expect(disconnectAction).toContain("clearDeviceCookies");
    expect(disconnectAction).not.toContain("auth.signOut");
  });

  it("checks the scanning kill switch before new scan and registration mutations", () => {
    const processScan = between(
      engine,
      "export async function processQrScan(",
      "export async function activateDeviceWithToken"
    );
    expect(processScan.indexOf("loadCommittedScanResult")).toBeLessThan(
      processScan.indexOf("isAttendanceScanningEnabled")
    );
    expect(processScan.indexOf("isAttendanceScanningEnabled")).toBeLessThan(
      processScan.indexOf("processQrScanFresh")
    );

    const registration = between(
      engine,
      "export async function registerDeviceForAuthenticatedScan",
      "export async function resolveAttendanceScanIdentity"
    );
    expect(registration.indexOf("isAttendanceScanningEnabled")).toBeLessThan(
      registration.indexOf("createAdminClient")
    );
  });
});
