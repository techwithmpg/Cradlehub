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

function createMockClient(): AuthedSuccess["client"] {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { latitude: 14.5547, longitude: 121.0244 },
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as AuthedSuccess["client"];
}

describe("POST /api/desktop/v1/locations/autocomplete", () => {
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

    const req = new NextRequest("http://localhost/api/desktop/v1/locations/autocomplete", {
      method: "POST",
      body: JSON.stringify({ query: "Ayala" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 when query is shorter than 2 characters", async () => {
    mockedAuth.mockResolvedValueOnce({
      ok: true,
      operator: {
        authUserId: "u1",
        staff: { id: "s1", branch_id: "11111111-1111-4111-8111-111111111111", system_role: "crm" },
        staffRole: "crm",
        isDevBypass: false,
      },
      user: { id: "u1" },
      client: createMockClient(),
    });

    const req = new NextRequest("http://localhost/api/desktop/v1/locations/autocomplete", {
      method: "POST",
      body: JSON.stringify({ query: "A" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 503 when Google Maps server API key is not configured", async () => {
    delete process.env.GOOGLE_MAPS_SERVER_API_KEY;

    mockedAuth.mockResolvedValueOnce({
      ok: true,
      operator: {
        authUserId: "u1",
        staff: { id: "s1", branch_id: "11111111-1111-4111-8111-111111111111", system_role: "crm" },
        staffRole: "crm",
        isDevBypass: false,
      },
      user: { id: "u1" },
      client: createMockClient(),
    });

    const req = new NextRequest("http://localhost/api/desktop/v1/locations/autocomplete", {
      method: "POST",
      body: JSON.stringify({ query: "Ayala Ave" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("LOCATION_SERVICE_NOT_CONFIGURED");
  });

  it("calls Google Places API and returns normalized predictions", async () => {
    mockedAuth.mockResolvedValueOnce({
      ok: true,
      operator: {
        authUserId: "u1",
        staff: { id: "s1", branch_id: "11111111-1111-4111-8111-111111111111", system_role: "crm" },
        staffRole: "crm",
        isDevBypass: false,
      },
      user: { id: "u1" },
      client: createMockClient(),
    });

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              placeId: "place-123",
              text: { text: "Ayala Avenue, Makati, Metro Manila, Philippines" },
              structuredFormat: {
                mainText: { text: "Ayala Avenue" },
                secondaryText: { text: "Makati, Metro Manila, Philippines" },
              },
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const req = new NextRequest("http://localhost/api/desktop/v1/locations/autocomplete", {
      method: "POST",
      body: JSON.stringify({
        query: "Ayala",
        branchId: "11111111-1111-4111-8111-111111111111",
        sessionToken: "session-abc",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.predictions).toEqual([
      {
        placeId: "place-123",
        description: "Ayala Avenue, Makati, Metro Manila, Philippines",
        mainText: "Ayala Avenue",
        secondaryText: "Makati, Metro Manila, Philippines",
      },
    ]);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places:autocomplete",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": "test-api-key",
        },
      })
    );

    vi.unstubAllGlobals();
  });
});
