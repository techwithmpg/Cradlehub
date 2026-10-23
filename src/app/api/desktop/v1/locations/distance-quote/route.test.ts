vi.mock("server-only", () => ({}));
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { DesktopBearerAuthResult } from "@/lib/auth/desktop-bearer-auth";
import type { HomeServiceTransportSnapshot } from "@/lib/home-service/distance-service";

vi.mock("@/lib/auth/desktop-bearer-auth", () => ({
  verifyDesktopBearerAuth: vi.fn(),
}));

vi.mock("@/lib/home-service/distance-service", () => ({
  calculateHomeServiceDistanceQuote: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { calculateHomeServiceDistanceQuote } from "@/lib/home-service/distance-service";
import { POST } from "./route";

const mockedAuth = vi.mocked(verifyDesktopBearerAuth);
const mockedQuote = vi.mocked(calculateHomeServiceDistanceQuote);
type AuthedSuccess = Extract<DesktopBearerAuthResult, { ok: true }>;

describe("POST /api/desktop/v1/locations/distance-quote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when bearer auth fails", async () => {
    mockedAuth.mockResolvedValueOnce({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Authorization header is required.",
    });

    const req = new NextRequest("http://localhost/api/desktop/v1/locations/distance-quote", {
      method: "POST",
      body: JSON.stringify({
        branchId: "11111111-1111-4111-8111-111111111111",
        destination: { lat: 14.55, lng: 121.02 },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when non-owner requests a different branch", async () => {
    mockedAuth.mockResolvedValueOnce({
      ok: true,
      operator: {
        authUserId: "u1",
        staff: { id: "s1", branch_id: "22222222-2222-4222-8222-222222222222", system_role: "crm" },
        staffRole: "crm",
        isDevBypass: false,
      },
      user: { id: "u1" },
      client: {} as unknown as AuthedSuccess["client"],
    });

    const req = new NextRequest("http://localhost/api/desktop/v1/locations/distance-quote", {
      method: "POST",
      body: JSON.stringify({
        branchId: "11111111-1111-4111-8111-111111111111",
        destination: { lat: 14.55, lng: 121.02 },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("CRM_BRANCH_FORBIDDEN");
  });

  it("calls calculateHomeServiceDistanceQuote and returns quote", async () => {
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

    mockedQuote.mockResolvedValueOnce({
      ok: true,
      quote: {
        branchId: "11111111-1111-4111-8111-111111111111",
        branchName: "Main Spa",
        distanceKm: 3.5,
        drivingDistanceKm: 3.5,
        distanceSource: "google_driving",
        baseFee: 100,
        includedKm: 1,
        perKmFee: 40,
        billableDistanceKm: 2.5,
        rawFee: 200,
        travelFee: 200,
        freeKm: 1,
        extraKm: 2.5,
        feePerExtraKm: 40,
        transportSnapshot: {} as unknown as HomeServiceTransportSnapshot,
      },
    });

    const req = new NextRequest("http://localhost/api/desktop/v1/locations/distance-quote", {
      method: "POST",
      body: JSON.stringify({
        branchId: "11111111-1111-4111-8111-111111111111",
        destination: { lat: 14.55, lng: 121.02 },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.quote.distanceKm).toBe(3.5);
    expect(body.quote.travelFee).toBe(200);
  });
});
