import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/desktop-bearer-auth", () => ({
  verifyDesktopBearerAuth: vi.fn(),
}));

vi.mock("@/lib/attendance/queries", () => ({
  getAttendanceWorkspaceData: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { getAttendanceWorkspaceData } from "@/lib/attendance/queries";
import { GET } from "./route";

const mockedAuth = vi.mocked(verifyDesktopBearerAuth);
const mockedWorkspace = vi.mocked(getAttendanceWorkspaceData);

function createClient(branchName = "Main Spa") {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: "branch-main",
      name: branchName,
    },
    error: null,
  });

  const eq = vi.fn().mockReturnValue({
    maybeSingle,
  });

  const select = vi.fn().mockReturnValue({
    eq,
  });

  return {
    from: vi.fn().mockReturnValue({
      select,
    }),
  };
}

function authenticatedResult(branchId: string | null = "branch-main", branchName = "Main Spa") {
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
    client: createClient(branchName),
  };
}

describe("GET /api/desktop/v1/attendance", () => {
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

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/attendance"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      code: "UNAUTHORIZED",
      message: "Invalid or expired access token.",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects authenticated staff without a branch", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult(null) as never);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/attendance"));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      ok: false,
      code: "STAFF_NOT_FOUND",
    });
    expect(mockedWorkspace).not.toHaveBeenCalled();
  });

  it("uses the server-resolved staff branch and ignores renderer branch input", async () => {
    const auth = authenticatedResult();

    mockedAuth.mockResolvedValue(auth as never);

    mockedWorkspace.mockResolvedValue({
      branchId: "branch-main",
      branchName: "Main Spa",
      businessDate: "2026-09-09",
      timezone: "Asia/Manila",
      serverNowMs: 1,
    } as never);

    const response = await GET(
      new NextRequest("https://example.test/api/desktop/v1/attendance?branchId=branch-other")
    );

    expect(response.status).toBe(200);

    expect(mockedWorkspace).toHaveBeenCalledWith({
      branchId: "branch-main",
      branchName: "Main Spa",
      origin: "https://example.test",
      canSwitchBranch: false,
      historyDays: 0,
      openExceptionsOnly: true,
    });

    expect(await response.json()).toMatchObject({
      ok: true,
      branchId: "branch-main",
    });
  });

  it("fails closed when the authenticated branch cannot be resolved", async () => {
    const auth = authenticatedResult();

    auth.client.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: {
              message: "not available",
            },
          }),
        }),
      }),
    });

    mockedAuth.mockResolvedValue(auth as never);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/attendance"));

    expect(response.status).toBe(403);

    expect(await response.json()).toMatchObject({
      ok: false,
      code: "BRANCH_NOT_FOUND",
    });

    expect(mockedWorkspace).not.toHaveBeenCalled();
  });

  it("returns a generic server error when the workspace loader fails", async () => {
    mockedAuth.mockResolvedValue(authenticatedResult() as never);

    mockedWorkspace.mockRejectedValue(new Error("internal attendance implementation detail"));

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/attendance"));

    expect(response.status).toBe(500);

    expect(await response.json()).toEqual({
      ok: false,
      code: "UNKNOWN_ERROR",
      message: "Attendance is temporarily unavailable. Please try again.",
    });
  });
});
