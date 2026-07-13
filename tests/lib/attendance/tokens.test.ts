import { describe, expect, it, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { hashSecret } from "@/lib/attendance/tokens";

describe("attendance device secret hashing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed in production when the device secret is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATTENDANCE_DEVICE_SECRET", "");

    expect(() => hashSecret("device-credential")).toThrow(
      "ATTENDANCE_DEVICE_SECRET is required in production."
    );
  });

  it("uses the configured server-only secret as part of the device hash", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATTENDANCE_DEVICE_SECRET", "first-secret");
    const firstHash = hashSecret("device-credential");

    vi.stubEnv("ATTENDANCE_DEVICE_SECRET", "second-secret");
    const secondHash = hashSecret("device-credential");

    expect(firstHash).not.toBe(secondHash);
    expect(firstHash).not.toContain("device-credential");
    expect(secondHash).not.toContain("device-credential");
  });
});
