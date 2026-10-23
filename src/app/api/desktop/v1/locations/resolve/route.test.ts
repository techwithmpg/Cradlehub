vi.mock("server-only", () => ({}));
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { DesktopBearerAuthResult } from "@/lib/auth/desktop-bearer-auth";

vi.mock("@/lib/auth/desktop-bearer-auth", () => ({
  verifyDesktopBearerAuth: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { POST } from "./route";

const mockedAuth = vi.mocked(verifyDesktopBearerAuth);
type AuthedSuccess = Extract<DesktopBearerAuthResult, { ok: true }>;

describe("POST /api/desktop/v1/locations/resolve", () => {
  const originalEnv = process.env.GOOGLE_MAPS_SERVER_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_MAPS_SERVER_API_KEY = "test-api-key";
  });

  afterAll(() => {
    process.env.GOOGLE_MAPS_SERVER_API_KEY = originalEnv;
  });

  it("returns 401 when bearer auth fails", async () => {
    mockedAuth.mockResolvedValueOnce({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Authorization header is required.",
    });

    const req = new NextRequest("http://localhost/api/desktop/v1/locations/resolve", {
      method: "POST",
      body: JSON.stringify({ placeId: "place-123" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when placeId is missing", async () => {
    mockedAuth.mockResolvedValueOnce({
      ok: true,
      operator: {
        authUserId: "u1",
        staff: { id: "s1", branch_id: "11111111-1111-4111-8111-111111111111", system_role: "crm" },
        staffRole: "crm",
        isDevBypass: false,
      },
      user: { id: "u1" },
      client: {} as unknown as AuthedSuccess["client"],
    });

    const req = new NextRequest("http://localhost/api/desktop/v1/locations/resolve", {
      method: "POST",
      body: JSON.stringify({ placeId: "" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("resolves place details and returns formatted address, coordinates, and components", async () => {
    mockedAuth.mockResolvedValueOnce({
      ok: true,
      operator: {
        authUserId: "u1",
        staff: { id: "s1", branch_id: "11111111-1111-4111-8111-111111111111", system_role: "crm" },
        staffRole: "crm",
        isDevBypass: false,
      },
      user: { id: "u1" },
      client: {} as unknown as AuthedSuccess["client"],
    });

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "place-123",
        displayName: { text: "Glorietta 4" },
        formattedAddress: "Ayala Center, Makati, Metro Manila, Philippines",
        location: { latitude: 14.551, longitude: 121.025 },
        addressComponents: [
          { longText: "Makati", shortText: "Makati", types: ["locality"] },
          { longText: "Metro Manila", shortText: "NCR", types: ["administrative_area_level_1"] },
        ],
        googleMapsURI: "https://maps.google.com/?cid=123",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const req = new NextRequest("http://localhost/api/desktop/v1/locations/resolve", {
      method: "POST",
      body: JSON.stringify({ placeId: "place-123", sessionToken: "token-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.location).toEqual({
      placeId: "place-123",
      formattedAddress: "Ayala Center, Makati, Metro Manila, Philippines",
      lat: 14.551,
      lng: 121.025,
      addressComponents: [
        { long_name: "Makati", short_name: "Makati", types: ["locality"] },
        { long_name: "Metro Manila", short_name: "NCR", types: ["administrative_area_level_1"] },
      ],
      mapUrl: "https://maps.google.com/?cid=123",
    });

    vi.unstubAllGlobals();
  });
});
