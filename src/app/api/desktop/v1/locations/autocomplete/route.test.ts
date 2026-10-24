vi.mock("server-only", () => ({}));
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { DesktopBearerAuthResult } from "@/lib/auth/desktop-bearer-auth";
import { resetLocationRateLimits, setDistributedRateLimiter } from "@/lib/locations/location-security";

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
    setDistributedRateLimiter(null);
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

  it("enforces staff branch authorization when branchId does not match assigned branch", async () => {
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
      body: JSON.stringify({
        query: "Ayala Ave",
        branchId: "22222222-2222-4222-8222-222222222222",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("CRM_BRANCH_FORBIDDEN");
  });

  it("allows owner to query any branch", async () => {
    mockedAuth.mockResolvedValueOnce({
      ok: true,
      operator: {
        authUserId: "u-owner",
        staff: { id: "s-owner", branch_id: "11111111-1111-4111-8111-111111111111", system_role: "owner" },
        staffRole: "owner",
        isDevBypass: false,
      },
      user: { id: "u-owner" },
      client: createMockClient(),
    });

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ suggestions: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const req = new NextRequest("http://localhost/api/desktop/v1/locations/autocomplete", {
      method: "POST",
      body: JSON.stringify({
        query: "Ayala Ave",
        branchId: "22222222-2222-4222-8222-222222222222",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    vi.unstubAllGlobals();
  });

  it("sanitizes query to remove control characters", async () => {
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

    let sentPayload: unknown = null;
    const mockFetch = vi.fn().mockImplementationOnce((_url, init) => {
      sentPayload = JSON.parse(init.body as string);
      return Promise.resolve({
        ok: true,
        json: async () => ({ suggestions: [] }),
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    const req = new NextRequest("http://localhost/api/desktop/v1/locations/autocomplete", {
      method: "POST",
      body: JSON.stringify({ query: "Ayala Avenue" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((sentPayload as { input: string }).input).toBe("Ayala Avenue");

    vi.unstubAllGlobals();
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockedAuth.mockResolvedValue({
      ok: true,
      operator: {
        authUserId: "u-spammer",
        staff: { id: "s1", branch_id: "11111111-1111-4111-8111-111111111111", system_role: "crm" },
        staffRole: "crm",
        isDevBypass: false,
      },
      user: { id: "u-spammer" },
      client: createMockClient(),
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    // Make 60 requests (within limit)
    for (let i = 0; i < 60; i++) {
      const req = new NextRequest("http://localhost/api/desktop/v1/locations/autocomplete", {
        method: "POST",
        body: JSON.stringify({ query: "Test Query" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    }

    // 61st request should be rate limited
    const overReq = new NextRequest("http://localhost/api/desktop/v1/locations/autocomplete", {
      method: "POST",
      body: JSON.stringify({ query: "Test Query Over Limit" }),
    });
    const overRes = await POST(overReq);
    expect(overRes.status).toBe(429);
    const body = await overRes.json();
    expect(body.code).toBe("RATE_LIMIT_EXCEEDED");

    vi.unstubAllGlobals();
  });

  it("enforces distinct quotas for distinct operators", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    // Operator A uses all 60 requests
    mockedAuth.mockResolvedValue({
      ok: true,
      operator: {
        authUserId: "operator-A",
        staff: { id: "s-a", branch_id: "11111111-1111-4111-8111-111111111111", system_role: "crm" },
        staffRole: "crm",
        isDevBypass: false,
      },
      user: { id: "operator-A" },
      client: createMockClient(),
    });

    for (let i = 0; i < 60; i++) {
      const req = new NextRequest("http://localhost/api/desktop/v1/locations/autocomplete", {
        method: "POST",
        body: JSON.stringify({ query: "Query A" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    }

    // 61st request for Operator A is blocked
    const reqA61 = new NextRequest("http://localhost/api/desktop/v1/locations/autocomplete", {
      method: "POST",
      body: JSON.stringify({ query: "Query A2" }),
    });
    const resA61 = await POST(reqA61);
    expect(resA61.status).toBe(429);

    // Operator B should still be allowed to query
    mockedAuth.mockResolvedValue({
      ok: true,
      operator: {
        authUserId: "operator-B",
        staff: { id: "s-b", branch_id: "11111111-1111-4111-8111-111111111111", system_role: "crm" },
        staffRole: "crm",
        isDevBypass: false,
      },
      user: { id: "operator-B" },
      client: createMockClient(),
    });

    const reqB = new NextRequest("http://localhost/api/desktop/v1/locations/autocomplete", {
      method: "POST",
      body: JSON.stringify({ query: "Query B" }),
    });
    const resB = await POST(reqB);
    expect(resB.status).toBe(200);
    const bodyB = await resB.json();
    expect(bodyB.ok).toBe(true);

    vi.unstubAllGlobals();
  });

  it("handles concurrent requests safely without quota races", async () => {
    mockedAuth.mockResolvedValue({
      ok: true,
      operator: {
        authUserId: "operator-concurrent",
        staff: { id: "s-c", branch_id: "11111111-1111-4111-8111-111111111111", system_role: "crm" },
        staffRole: "crm",
        isDevBypass: false,
      },
      user: { id: "operator-concurrent" },
      client: createMockClient(),
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    // Launch 65 concurrent requests
    const promises = Array.from({ length: 65 }, (_, i) => {
      const req = new NextRequest("http://localhost/api/desktop/v1/locations/autocomplete", {
        method: "POST",
        body: JSON.stringify({ query: `Concurrent Query ${i}` }),
      });
      return POST(req);
    });

    const responses = await Promise.all(promises);
    const successCount = responses.filter((r) => r.status === 200).length;
    const rateLimitedCount = responses.filter((r) => r.status === 429).length;

    expect(successCount).toBe(60);
    expect(rateLimitedCount).toBe(5);

    vi.unstubAllGlobals();
  });

  it("fails safe with 503 RATE_LIMITER_UNAVAILABLE when distributed limiter backend errors", async () => {
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

    // Mock an external distributed rate limiter failing
    setDistributedRateLimiter({
      check: async () => {
        throw new Error("Redis connection refused");
      },
    });

    const req = new NextRequest("http://localhost/api/desktop/v1/locations/autocomplete", {
      method: "POST",
      body: JSON.stringify({ query: "Ayala Ave" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("RATE_LIMITER_UNAVAILABLE");
    expect(body.message).toContain("Redis connection refused");
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

    vi.unstubAllGlobals();
  });
});
