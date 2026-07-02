import { afterEach, describe, expect, it, vi } from "vitest";

import { buildActivationUrl, buildScanUrl, getAppBaseUrl, maskPublicCode } from "@/lib/attendance/qr-url";

describe("attendance QR URL helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes configured public URLs", () => {
    expect(getAppBaseUrl({ configuredUrl: "cradle.example.com/" })).toBe("https://cradle.example.com");
    expect(getAppBaseUrl({ configuredUrl: "https://cradle.example.com/app///" })).toBe("https://cradle.example.com/app");
  });

  it("falls back to the request origin when no configured URL is present", () => {
    expect(getAppBaseUrl({ origin: "https://frontdesk.example.com", configuredUrl: "" })).toBe("https://frontdesk.example.com");
  });

  it("rejects localhost public QR links in production", () => {
    expect(() =>
      getAppBaseUrl({ origin: "http://localhost:3000", configuredUrl: "", nodeEnv: "production" }),
    ).toThrow("Production QR links require a public app URL.");
  });

  it("builds encoded scan and activation URLs from the configured app URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://spa.example.com/");

    expect(buildScanUrl("staff/main branch")).toBe("https://spa.example.com/scan/staff%2Fmain%20branch");
    expect(buildActivationUrl("token/with space")).toBe("https://spa.example.com/scan/activate/token%2Fwith%20space");
  });

  it("masks public QR codes for display", () => {
    expect(maskPublicCode("att_msp_a1b2c3d4")).toBe("att_...c3d4");
    expect(maskPublicCode("short")).toBe("****");
  });
});
