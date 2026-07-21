import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const actions = readFileSync(join(process.cwd(), "src/app/scan/actions.ts"), "utf8");
const processor = readFileSync(join(process.cwd(), "src/components/features/attendance/public-scan-processor.tsx"), "utf8");
const loginForm = readFileSync(join(process.cwd(), "src/components/features/attendance/public-scan-login-form.tsx"), "utf8");
const scanEngine = readFileSync(join(process.cwd(), "src/lib/attendance/scan-engine.ts"), "utf8");

describe("first attendance scan continuation contract", () => {
  it("uses the original operation id for registration and attendance child operations", () => {
    expect(actions).toContain('appendRequestStep(rootOperationId, "register")');
    expect(actions).toContain('appendRequestStep(rootOperationId, "attendance")');
    expect(processor).toContain("requestId,\n      });");
  });

  it("returns the final attendance result without a cookie-backed reload", () => {
    expect(actions).toContain("result: toPublicResult(attendanceResult)");
    expect(processor).toContain("setResult(actionResult.result)");
    expect(processor).not.toContain("reloadForCookieBackedScan");
  });

  it("keeps the connection copy and hides unknown-device output behind the login state", () => {
    expect(loginForm).toContain("Sign in to continue");
    expect(loginForm).toContain("Connect phone and continue");
    expect(loginForm).toContain("Connecting phone…");
    expect(processor).toContain("if (mode === \"scan\" && isMissingDeviceResult(nextResult))");
    expect(processor).toContain("setResult(null)");
    expect(processor).toContain('setStage("sign_in_required")');
  });

  it("authenticates before registration and preserves revoked-device blocking", () => {
    expect(actions.indexOf("if (authError)")).toBeLessThan(
      actions.indexOf("registerDeviceForAuthenticatedScan(")
    );
    expect(scanEngine).toContain('existingDevice.status !== "active"');
    expect(scanEngine).toContain('reasonCode: "revoked_device"');
    expect(actions).toContain("nextScanRequired: false");
  });

  it("registers an authenticated new phone before canonical wrong-branch capture", () => {
    expect(scanEngine).not.toContain("if (staff.branch_id !== point.branch_id)");
    expect(scanEngine).toContain('registration_source: "first_scan_activation"');
    expect(actions.indexOf("await setDeviceCookie(registration.rawDeviceCredential)")).toBeLessThan(
      actions.indexOf("const attendanceResult = await processQrScan(")
    );
    expect(scanEngine).toContain("deviceId: device.id");
    expect(scanEngine).toContain('reasonCode: "wrong_branch"');
  });
});
