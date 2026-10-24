vi.mock("server-only", () => ({}));
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { DesktopBearerAuthResult } from "@/lib/auth/desktop-bearer-auth";
import { resetLocationRateLimits } from "@/lib/locations/location-security";

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
const dummyClient = {} as unknown as AuthedSuccess["client"];

describe("POST /api/desktop/v1/locations/resolve", () => {
  const originalEnv = process.env.GOOGLE_MAPS_SERVER_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    resetLocationRateLimits();
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

  it("enforces branch authorization when branchId provided does not match operator branch", async () => {
    mockedAuth.mockResolvedValueOnce({
      ok: true,
      operator: {
        authUserId: "u1",
        staff: { id: "s1", branch_id: "11111111-1111-4111-8111-111111111111", system_role: "crm" },
        staffRole: "crm",
        isDevBypass: false,
      },
      user: { id: "u1" },
      client: dummyClient,
    });

    const req = new NextRequest("http://localhost/api/desktop/v1/locations/resolve", {
      method: "POST",
      body: JSON.stringify({
        placeId: "place-123",
        branchId: "22222222-2222-4222-8222-222222222222",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("CRM_BRANCH_FORBIDDEN");
  });

  it("resolves place details with valid coordinates and formatted address", async () => {
    mockedAuth.mockResolvedValueOnce({
      ok: true,
      operator: {
        authUserId: "u1",
        staff: { id: "s1", branch_id: "11111111-1111-4111-8111-111111111111", system_role: "crm" },
        staffRole: "crm",
        isDevBypass: false,
      },
      user: { id: "u1" },
      client: dummyClient,
    });

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "place-123",
        formattedAddress: "Ayala Avenue, Makati, Philippines",
        location: { latitude: 14.5547, longitude: 121.0244 },
        addressComponents: [
          { longText: "Makati", shortText: "Makati", types: ["locality"] },
        ],
        googleMapsURI: "https://maps.google.com/?cid=123",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const req = new NextRequest("http://localhost/api/desktop/v1/locations/resolve", {
      method: "POST",
      body: JSON.stringify({ placeId: "place-123" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.location.lat).toBe(14.5547);
    expect(body.location.lng).toBe(121.0244);
    expect(body.location.formattedAddress).toBe("Ayala Avenue, Makati, Philippines");

    vi.unstubAllGlobals();
  });

  it("handles upstream timeout gracefully", async () => {
    mockedAuth.mockResolvedValueOnce({
      ok: true,
      operator: {
        authUserId: "u1",
        staff: { id: "s1", branch_id: "11111111-1111-4111-8111-111111111111", system_role: "crm" },
        staffRole: "crm",
        isDevBypass: false,
      },
      user: { id: "u1" },
      client: dummyClient,
    });

    const timeoutError = new Error("The operation was aborted due to timeout");
    timeoutError.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(timeoutError));

    const req = new NextRequest("http://localhost/api/desktop/v1/locations/resolve", {
      method: "POST",
      body: JSON.stringify({ placeId: "place-timeout" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.code).toBe("LOCATION_RESOLVE_TIMEOUT");

    vi.unstubAllGlobals();
  });
});
