import { createHash } from "crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { inferDeviceClientHints } from "@/lib/attendance/device-display";
import { resolveDeviceRegistryStatus } from "@/lib/attendance/device-registry-status";
import { createRecoveryToken, hashRecoveryToken } from "@/lib/attendance/tokens";

describe("attendance device recovery helpers", () => {
  it("creates random raw recovery tokens and stores only a sha256 hash", () => {
    const token = createRecoveryToken();
    const otherToken = createRecoveryToken();
    const expectedHash = createHash("sha256").update(token).digest("hex");

    expect(token).not.toBe(otherToken);
    expect(hashRecoveryToken(token)).toBe(expectedHash);
    expect(hashRecoveryToken(token)).not.toContain(token);
  });

  it("extracts safe browser and platform hints from a mobile user agent", () => {
    const hints = inferDeviceClientHints(
      "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.72 Mobile Safari/537.36"
    );

    expect(hints.browserName).toBe("Chrome");
    expect(hints.browserVersion).toBe("126.0.6478.72");
    expect(hints.platformName).toBe("Android");
    expect(hints.label).toBe("Android - Chrome");
  });

  it("prioritizes registry statuses predictably", () => {
    expect(resolveDeviceRegistryStatus({
      staffIsActive: false,
      hasPendingRecovery: true,
      hasDevice: true,
      deviceStatus: "active",
      totalSuccessfulScans: 5,
    })).toBe("inactive_staff");

    expect(resolveDeviceRegistryStatus({
      staffIsActive: true,
      hasPendingRecovery: true,
      hasDevice: false,
      deviceStatus: null,
      totalSuccessfulScans: 0,
    })).toBe("recovery_pending");

    expect(resolveDeviceRegistryStatus({
      staffIsActive: true,
      hasPendingRecovery: false,
      hasDevice: true,
      deviceStatus: "active",
      totalSuccessfulScans: 0,
    })).toBe("never_used");

    expect(resolveDeviceRegistryStatus({
      staffIsActive: true,
      hasPendingRecovery: false,
      hasDevice: true,
      deviceStatus: "active",
      totalSuccessfulScans: 3,
    })).toBe("active");
  });
});
