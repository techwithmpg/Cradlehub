import { describe, expect, it } from "vitest";
import {
  buildAuthCallbackRedirectUrl,
  resolveRequestOrigin,
  sanitizeAuthRedirectPath,
} from "@/lib/auth/auth-redirects";

describe("auth redirect helpers", () => {
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
