import { describe, expect, it } from "vitest";
import { isPublicReadTransportFailure } from "@/lib/public/public-read-error";

describe("public homepage transport failure classification", () => {
  it("recognizes the native fetch failure and the Supabase query wrapper", () => {
    expect(isPublicReadTransportFailure(new TypeError("fetch failed"))).toBe(true);
    expect(isPublicReadTransportFailure(new Error("TypeError: fetch failed"))).toBe(true);
  });

  it("keeps schema, permission, configuration, and unrelated failures distinct", () => {
    expect(
      isPublicReadTransportFailure(
        new Error("Could not find public_site_sections in the schema cache")
      )
    ).toBe(false);
    expect(
      isPublicReadTransportFailure(new Error("permission denied for table public_site_sections"))
    ).toBe(false);
    expect(isPublicReadTransportFailure(new Error("supabaseUrl is required"))).toBe(false);
    expect(
      isPublicReadTransportFailure(new Error("Failed to fetch published brand settings"))
    ).toBe(false);
    expect(isPublicReadTransportFailure(null)).toBe(false);
  });
});
