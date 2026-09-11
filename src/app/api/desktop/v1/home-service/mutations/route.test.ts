vi.mock("server-only", () => ({}));
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/desktop-bearer-auth", () => ({
  verifyDesktopBearerAuth: vi.fn(),
}));

vi.mock("@/lib/home-service/dispatch-operations", () => ({
  assignHomeServiceDriver: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { assignHomeServiceDriver } from "@/lib/home-service/dispatch-operations";
import { POST } from "./route";

const mockedAuth = vi.mocked(verifyDesktopBearerAuth);
const mockedAssignDriver = vi.mocked(assignHomeServiceDriver);

function authResult(branchId: string | null = "branch-main") {
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
    client: {
      from: vi.fn(),
    },
  };
}

function request(body: unknown) {
  return new NextRequest("https://example.test/api/desktop/v1/home-service/mutations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/desktop/v1/home-service/mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns bearer auth failure unchanged", async () => {
    mockedAuth.mockResolvedValue({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Invalid or expired access token.",
    });

    const response = await POST(
      request({
        action: "assign_driver",
        payload: {},
      })
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mockedAssignDriver).not.toHaveBeenCalled();
  });

  it("fails closed when authenticated staff has no branch", async () => {
    mockedAuth.mockResolvedValue(authResult(null) as never);

    const response = await POST(
      request({
        action: "assign_driver",
        payload: {},
      })
    );

    expect(response.status).toBe(403);
    expect(mockedAssignDriver).not.toHaveBeenCalled();
  });

  it("rejects unknown mutation actions", async () => {
    mockedAuth.mockResolvedValue(authResult() as never);

    const response = await POST(
      request({
        action: "delete_everything",
        payload: {},
      })
    );

    expect(response.status).toBe(400);
    expect(mockedAssignDriver).not.toHaveBeenCalled();
  });

  it("uses server-resolved branch authority and ignores renderer branchId", async () => {
    const auth = authResult();

    mockedAuth.mockResolvedValue(auth as never);
    mockedAssignDriver.mockResolvedValue({ ok: true });

    const response = await POST(
      request({
        action: "assign_driver",
        branchId: "branch-attacker",
        bookingId: "11111111-1111-4111-8111-111111111111",
        driverId: "22222222-2222-4222-8222-222222222222",
      })
    );

    expect(response.status).toBe(200);

    expect(mockedAssignDriver).toHaveBeenCalledWith(
      auth.client,
      {
        staffId: "staff-1",
        branchId: "branch-main",
        role: "crm",
        allowOwnerCrossBranch: false,
      },
      expect.objectContaining({
        bookingId: "11111111-1111-4111-8111-111111111111",
        driverId: "22222222-2222-4222-8222-222222222222",
      })
    );

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("maps domain failures without exposing internal errors", async () => {
    mockedAuth.mockResolvedValue(authResult() as never);

    mockedAssignDriver.mockResolvedValue({
      ok: false,
      code: "BRANCH_FORBIDDEN",
      message: "Booking is not in your branch.",
    });

    const response = await POST(
      request({
        action: "assign_driver",
        bookingId: "11111111-1111-4111-8111-111111111111",
        driverId: null,
      })
    );

    expect(response.status).toBe(403);

    expect(await response.json()).toEqual({
      ok: false,
      code: "BRANCH_FORBIDDEN",
      message: "Booking is not in your branch.",
    });

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
