import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthCallbackRedirectUrl,
  buildPasswordResetRedirectUrl,
  getPublicAppUrl,
  resolveRequestOrigin,
  sanitizeAuthRedirectPath,
} from "@/lib/auth/auth-redirects";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth redirect helpers", () => {
  it("builds public app URLs from NEXT_PUBLIC_APP_URL without duplicate slashes", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://cradlewellnessliving.com///");

    expect(getPublicAppUrl()).toBe("https://cradlewellnessliving.com");
    expect(buildPasswordResetRedirectUrl()).toBe(
      "https://cradlewellnessliving.com/reset-password"
    );
  });

  it("uses localhost only as the development public app URL fallback", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "development");

    expect(buildPasswordResetRedirectUrl()).toBe("http://localhost:3000/reset-password");
  });

  it("fails when the production public app URL is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "production");

    expect(() => getPublicAppUrl()).toThrow("NEXT_PUBLIC_APP_URL is not configured.");
  });

  it("rejects localhost app URLs in production", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("NODE_ENV", "production");

    expect(() => getPublicAppUrl()).toThrow(
      "NEXT_PUBLIC_APP_URL must not be localhost in production."
    );
  });

  it("allows expected internal workspace paths", () => {
    expect(sanitizeAuthRedirectPath("/reset-password")).toBe("/reset-password");
    expect(sanitizeAuthRedirectPath("/crm/bookings?view=today")).toBe(
      "/crm/bookings?view=today"
    );
  });

  it("rejects external and callback redirects", () => {
    expect(sanitizeAuthRedirectPath("https://evil.example/reset")).toBe("/select-workspace");
    expect(sanitizeAuthRedirectPath("//evil.example/reset")).toBe("/select-workspace");
    expect(sanitizeAuthRedirectPath("%2F%2Fevil.example/reset")).toBe("/select-workspace");
    expect(sanitizeAuthRedirectPath("/auth/callback?next=/owner")).toBe("/select-workspace");
    expect(sanitizeAuthRedirectPath("/unknown")).toBe("/select-workspace");
  });

  it("builds recovery callback URLs with sanitized next paths", () => {
    expect(buildAuthCallbackRedirectUrl("https://app.cradlehub.test", "/reset-password")).toBe(
      "https://app.cradlehub.test/auth/callback?next=%2Freset-password"
    );

    expect(buildAuthCallbackRedirectUrl("https://app.cradlehub.test", "https://evil.test")).toBe(
      "https://app.cradlehub.test/auth/callback?next=%2Freset-password"
    );
  });

  it("resolves origin from trusted request headers", () => {
    const headers = new Headers({
      host: "cradlehub.test",
      "x-forwarded-proto": "https",
    });

    expect(resolveRequestOrigin(headers)).toBe("https://cradlehub.test");
  });
});
