import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/desktop-bearer-auth", () => ({
  verifyDesktopBearerAuth: vi.fn(),
}));

vi.mock("@/lib/attendance/queries", () => ({
  getAttendanceHistoryData: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { getAttendanceHistoryData } from "@/lib/attendance/queries";
import { GET } from "./route";

const mockedAuth = vi.mocked(verifyDesktopBearerAuth);
const mockedHistory = vi.mocked(getAttendanceHistoryData);

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
    client: {},
  };
}

describe("GET /api/desktop/v1/attendance/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns bearer-auth failures unchanged", async () => {
    mockedAuth.mockResolvedValue({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Authorization header is required.",
    });

    const response = await GET(
      new NextRequest(
        "https://example.test/api/desktop/v1/attendance/history?fromDate=2026-09-01&toDate=2026-09-09"
      )
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      ok: false,
      code: "UNAUTHORIZED",
    });
  });

  it("requires valid calendar dates", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    const response = await GET(
      new NextRequest(
        "https://example.test/api/desktop/v1/attendance/history?fromDate=2026-02-30&toDate=2026-09-09"
      )
    );

    expect(response.status).toBe(400);

    expect(await response.json()).toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
    });

    expect(mockedHistory).not.toHaveBeenCalled();
  });

  it("rejects reversed ranges", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    const response = await GET(
      new NextRequest(
        "https://example.test/api/desktop/v1/attendance/history?fromDate=2026-09-09&toDate=2026-09-01"
      )
    );

    expect(response.status).toBe(400);
    expect(mockedHistory).not.toHaveBeenCalled();
  });

  it("rejects ranges greater than 366 days", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    const response = await GET(
      new NextRequest(
        "https://example.test/api/desktop/v1/attendance/history?fromDate=2025-01-01&toDate=2026-09-09"
      )
    );

    expect(response.status).toBe(400);
    expect(mockedHistory).not.toHaveBeenCalled();
  });

  it("loads history only for the authenticated staff branch", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    mockedHistory.mockResolvedValue({
      fromDate: "2026-09-01",
      toDate: "2026-09-09",
      records: [],
      corrections: [],
    });

    const response = await GET(
      new NextRequest(
        "https://example.test/api/desktop/v1/attendance/history?fromDate=2026-09-01&toDate=2026-09-09&branchId=branch-other"
      )
    );

    expect(response.status).toBe(200);

    expect(mockedHistory).toHaveBeenCalledWith({
      branchId: "branch-main",
      fromDate: "2026-09-01",
      toDate: "2026-09-09",
    });

    expect(await response.json()).toEqual({
      ok: true,
      branchId: "branch-main",
      fromDate: "2026-09-01",
      toDate: "2026-09-09",
      data: {
        fromDate: "2026-09-01",
        toDate: "2026-09-09",
        records: [],
        corrections: [],
      },
    });
  });

  it("returns a generic server error when authoritative history fails", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    mockedHistory.mockRejectedValue(new Error("private database implementation detail"));

    const response = await GET(
      new NextRequest(
        "https://example.test/api/desktop/v1/attendance/history?fromDate=2026-09-01&toDate=2026-09-09"
      )
    );

    expect(response.status).toBe(500);

    expect(await response.json()).toEqual({
      ok: false,
      code: "UNKNOWN_ERROR",
      message: "Attendance history is temporarily unavailable. Please try again.",
    });
  });
});
