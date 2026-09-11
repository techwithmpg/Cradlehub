vi.mock("server-only", () => ({}));
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/desktop-bearer-auth", () => ({
  verifyDesktopBearerAuth: vi.fn(),
}));

vi.mock("@/lib/queries/dispatch-queries", () => ({
  getDispatchData: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { getDispatchData } from "@/lib/queries/dispatch-queries";
import { GET } from "./route";

const mockedAuth = vi.mocked(verifyDesktopBearerAuth);
const mockedDispatch = vi.mocked(getDispatchData);

function createClient(branchExists = true) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: branchExists ? { id: "branch-main" } : null,
    error: branchExists ? null : { message: "branch unavailable" },
  });

  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle,
        }),
      }),
    }),
  };
}

function authenticatedResult(branchId: string | null = "branch-main") {
  return {
    ok: true as const,
    operator: {
      authUserId: "user-1",
      staff: {
        id: "staff-1",
        branch_id: branchId,
        system_role: "crm",
      },
      staffRole: "crm",
      isDevBypass: false,
    },
    user: {
      id: "user-1",
      email: "crm@example.test",
    },
    client: createClient(),
  };
}

describe("GET /api/desktop/v1/home-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns bearer-auth failures unchanged", async () => {
    mockedAuth.mockResolvedValue({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Invalid or expired access token.",
    });

    const response = await GET(
      new NextRequest("https://example.test/api/desktop/v1/home-service?date=2026-09-10")
    );

    expect(response.status).toBe(401);

    expect(await response.json()).toEqual({
      ok: false,
      code: "UNAUTHORIZED",
      message: "Invalid or expired access token.",
    });

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects staff without a branch", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult(null) as never);

    const response = await GET(
      new NextRequest("https://example.test/api/desktop/v1/home-service?date=2026-09-10")
    );

    expect(response.status).toBe(403);

    expect(await response.json()).toMatchObject({
      ok: false,
      code: "STAFF_NOT_FOUND",
    });

    expect(mockedDispatch).not.toHaveBeenCalled();
  });

  it("rejects invalid dates", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    const response = await GET(
      new NextRequest("https://example.test/api/desktop/v1/home-service?date=bad-date")
    );

    expect(response.status).toBe(400);

    expect(await response.json()).toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
    });

    expect(mockedDispatch).not.toHaveBeenCalled();
  });

  it("uses server-resolved branch and ignores renderer branch input", async () => {
    const auth = authenticatedResult();

    mockedAuth.mockResolvedValue(auth as never);

    mockedDispatch.mockResolvedValue({
      items: [],
      stats: {
        totalToday: 0,
        awaitingDispatch: 0,
        activeTrips: 0,
        completedToday: 0,
        cancelledToday: 0,
      },
      alerts: [],
      today: "2026-09-10",
    });

    const response = await GET(
      new NextRequest(
        "https://example.test/api/desktop/v1/home-service?date=2026-09-10&branchId=branch-other"
      )
    );

    expect(response.status).toBe(200);

    expect(mockedDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: "branch-main",
        date: "2026-09-10",
        supabase: auth.client,
        throwOnError: true,
      })
    );

    expect(await response.json()).toMatchObject({
      ok: true,
      data: { context: { branchId: "branch-main", date: "2026-09-10" }, items: [] },
    });
  });

  it("returns a generic server error when dispatch loading fails", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    mockedDispatch.mockRejectedValue(new Error("internal implementation detail"));

    const response = await GET(
      new NextRequest("https://example.test/api/desktop/v1/home-service?date=2026-09-10")
    );

    expect(response.status).toBe(500);

    expect(await response.json()).toEqual({
      ok: false,
      code: "SERVER_ERROR",
      message: "The request could not be completed. Please refresh and try again.",
    });

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
