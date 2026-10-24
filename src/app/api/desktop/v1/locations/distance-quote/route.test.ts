vi.mock("server-only", () => ({}));
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { DesktopBearerAuthResult } from "@/lib/auth/desktop-bearer-auth";
import type { HomeServiceDistanceQuote } from "@/lib/home-service/distance-service";
import { resetLocationRateLimits } from "@/lib/locations/location-security";

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
const mockedDistanceService = vi.mocked(calculateHomeServiceDistanceQuote);
type AuthedSuccess = Extract<DesktopBearerAuthResult, { ok: true }>;

const dummyClient = {} as unknown as AuthedSuccess["client"];

const mockQuote: HomeServiceDistanceQuote = {
  branchId: "11111111-1111-4111-8111-111111111111",
  branchName: "Makati Branch",
  distanceKm: 5.2,
  drivingDistanceKm: 5.2,
  distanceSource: "google_driving",
  baseFee: 100,
  includedKm: 3,
  perKmFee: 25,
  billableDistanceKm: 2.2,
  rawFee: 155,
  travelFee: 150,
  freeKm: 3,
  extraKm: 2.2,
  feePerExtraKm: 25,
  transportSnapshot: {
    pricing_version: 1,
    distance_source: "google_routes",
    driving_distance_km: 5.2,
    base_fee: 100,
    included_km: 3,
    per_km_fee: 25,
    billable_distance_km: 2.2,
    raw_fee: 155,
    calculated_fee: 150,
  },
};

describe("POST /api/desktop/v1/locations/distance-quote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLocationRateLimits();
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

  it("returns 403 when staff tries to calculate quote for unassigned branch", async () => {
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

    const req = new NextRequest("http://localhost/api/desktop/v1/locations/distance-quote", {
      method: "POST",
      body: JSON.stringify({
        branchId: "22222222-2222-4222-8222-222222222222",
        destination: { lat: 14.55, lng: 121.02 },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("CRM_BRANCH_FORBIDDEN");
  });

  it("calculates transportation quote and returns authoritative details", async () => {
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

    mockedDistanceService.mockResolvedValueOnce({
      ok: true,
      quote: mockQuote,
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
    expect(body.quote.distanceKm).toBe(5.2);
    expect(body.quote.travelFee).toBe(150);
  });
});
