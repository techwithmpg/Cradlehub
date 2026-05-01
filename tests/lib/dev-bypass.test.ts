import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isDevAuthBypassEnabled,
  getDevBypassLayoutStaff,
  getDevBypassStaffRecord,
  devBypassAuthMessage,
} from "../../src/lib/dev-bypass";

describe("isDevAuthBypassEnabled", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true in non-production with DEV_AUTH_BYPASS=true", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_BYPASS", "true");
    expect(isDevAuthBypassEnabled()).toBe(true);
  });

  it("returns true in non-production with legacy DEV_ALLOW_ALL_MODULES=true", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_BYPASS", "false");
    vi.stubEnv("DEV_ALLOW_ALL_MODULES", "true");
    expect(isDevAuthBypassEnabled()).toBe(true);
  });

  it("returns false when env flag is not set", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_BYPASS", "false");
    vi.stubEnv("DEV_ALLOW_ALL_MODULES", "false");
    expect(isDevAuthBypassEnabled()).toBe(false);
  });

  it("returns false in production even if env flag is true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_AUTH_BYPASS", "true");
    vi.stubEnv("DEV_ALLOW_ALL_MODULES", "true");
    expect(isDevAuthBypassEnabled()).toBe(false);
  });

  it("returns false in production with env flag unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_AUTH_BYPASS", "false");
    expect(isDevAuthBypassEnabled()).toBe(false);
  });
});

describe("getDevBypassLayoutStaff", () => {
  it("returns a mock staff profile with owner role", () => {
    const mock = getDevBypassLayoutStaff();
    expect(mock.system_role).toBe("owner");
    expect(mock.full_name).toBe("Dev User");
    expect(mock.branch_id).toBe("00000000-0000-0000-0000-000000000000");
    expect(mock.branches.name).toBe("Dev Branch");
  });

  it("respects DEV_BYPASS_USER_NAME env", () => {
    vi.stubEnv("DEV_BYPASS_USER_NAME", "Test User");
    const mock = getDevBypassLayoutStaff();
    expect(mock.full_name).toBe("Test User");
    vi.unstubAllEnvs();
  });
});

describe("getDevBypassStaffRecord", () => {
  it("returns a mock staff record with staff role", () => {
    const mock = getDevBypassStaffRecord();
    expect(mock.system_role).toBe("staff");
    expect(mock.staff_type).toBe("therapist");
    expect(mock.tier).toBe("senior");
    expect(mock.id).toBe("00000000-0000-0000-0000-000000000000");
  });
});

describe("devBypassAuthMessage", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns dev hint when bypass is enabled", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_BYPASS", "true");
    const msg = devBypassAuthMessage();
    expect(msg).toContain("Dev bypass is active");
    expect(msg).toContain("no staff profile is linked");
  });

  it("returns fallback when bypass is disabled", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_BYPASS", "false");
    expect(devBypassAuthMessage("Access denied")).toBe("Access denied");
  });
});
