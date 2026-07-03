import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildActivationUrl, buildScanUrl, getAppBaseUrl, maskPublicCode } from "@/lib/attendance/qr-url";

describe("attendance QR URL helpers", () => {
  beforeEach(() => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes configured public URLs", () => {
    expect(getAppBaseUrl({ configuredUrl: "cradle.example.com/" })).toBe("https://cradle.example.com");
    expect(getAppBaseUrl({ configuredUrl: "https://cradle.example.com/app///" })).toBe("https://cradle.example.com/app");
  });

  it("prefers APP_URL over public and Vercel URL fallbacks", () => {
    vi.stubEnv("APP_URL", "https://server.example.com/");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://public.example.com/");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://site.example.com/");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "vercel.example.com");

    expect(getAppBaseUrl()).toBe("https://server.example.com");
  });

  it("falls back through public URL environment variables", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "public.example.com/");
    expect(getAppBaseUrl()).toBe("https://public.example.com");

    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://site.example.com/");
    expect(getAppBaseUrl()).toBe("https://site.example.com");

    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "vercel.example.com/");
    expect(getAppBaseUrl()).toBe("https://vercel.example.com");
  });

  it("falls back to the request origin when no configured URL is present", () => {
    expect(getAppBaseUrl({ origin: "https://frontdesk.example.com", configuredUrl: "" })).toBe("https://frontdesk.example.com");
  });

  it("skips localhost configuration in production and uses the public request origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

    expect(
      getAppBaseUrl({
        origin: "https://www.cradlewellnessliving.com",
        nodeEnv: "production",
      })
    ).toBe("https://www.cradlewellnessliving.com");
  });

  it("keeps searching configured URLs after a localhost production value", () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.cradlewellnessliving.com/");

    expect(getAppBaseUrl({ origin: null, nodeEnv: "production" })).toBe(
      "https://www.cradlewellnessliving.com"
    );
  });

  it("uses localhost only outside production", () => {
    expect(getAppBaseUrl({ configuredUrl: "", origin: null, nodeEnv: "development" })).toBe("http://localhost:3000");
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
