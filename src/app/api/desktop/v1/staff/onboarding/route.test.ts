vi.mock("server-only", () => ({}));
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

vi.mock("@/lib/auth/desktop-bearer-auth", () => ({
  verifyDesktopBearerAuth: vi.fn(),
}));

vi.mock("@/lib/staff/staff-onboarding-service", () => ({
  approveStaffOnboardingRequest: vi.fn(),
  rejectStaffOnboardingRequest: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import {
  approveStaffOnboardingRequest,
  rejectStaffOnboardingRequest,
} from "@/lib/staff/staff-onboarding-service";
import { POST as approveRoute } from "./[requestId]/approve/route";
import { POST as rejectRoute } from "./[requestId]/reject/route";

const mockedAuth = vi.mocked(verifyDesktopBearerAuth);
const mockedApprove = vi.mocked(approveStaffOnboardingRequest);
const mockedReject = vi.mocked(rejectStaffOnboardingRequest);

function authSuccess() {
  return {
    ok: true as const,
    operator: {
      authUserId: "user-1",
      staff: {
        id: "staff-actor",
        branch_id: "branch-main",
        system_role: "manager",
      },
      staffRole: "manager",
      isDevBypass: false,
    },
    user: {
      id: "user-1",
      email: "mgr@example.test",
    },
    client: {} as unknown as SupabaseClient<Database>,
  };
}

describe("Desktop Onboarding Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/desktop/v1/staff/onboarding/[requestId]/approve", () => {
    it("returns 401 when unauthenticated", async () => {
      mockedAuth.mockResolvedValueOnce({
        ok: false,
        status: 401,
        code: "UNAUTHORIZED",
        message: "Missing token",
      });

      const req = new NextRequest(
        "http://localhost/api/desktop/v1/staff/onboarding/550e8400-e29b-41d4-a716-446655440000/approve",
        {
          method: "POST",
        }
      );

      const res = await approveRoute(req, {
        params: Promise.resolve({ requestId: "550e8400-e29b-41d4-a716-446655440000" }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.code).toBe("UNAUTHORIZED");
    });

    it("returns 400 for invalid requestId UUID", async () => {
      mockedAuth.mockResolvedValueOnce(authSuccess());

      const req = new NextRequest(
        "http://localhost/api/desktop/v1/staff/onboarding/invalid-uuid/approve",
        {
          method: "POST",
        }
      );

      const res = await approveRoute(req, {
        params: Promise.resolve({ requestId: "invalid-uuid" }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.code).toBe("INVALID_INPUT");
    });

    it("returns 400 for invalid request body", async () => {
      mockedAuth.mockResolvedValueOnce(authSuccess());

      const req = new NextRequest(
        "http://localhost/api/desktop/v1/staff/onboarding/550e8400-e29b-41d4-a716-446655440000/approve",
        {
          method: "POST",
          body: JSON.stringify({ tier: "not-a-tier" }),
        }
      );

      const res = await approveRoute(req, {
        params: Promise.resolve({ requestId: "550e8400-e29b-41d4-a716-446655440000" }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.code).toBe("INVALID_INPUT");
    });

    it("returns mapped status code when service fails (e.g. 403 FORBIDDEN)", async () => {
      mockedAuth.mockResolvedValueOnce(authSuccess());
      mockedApprove.mockResolvedValueOnce({
        ok: false,
        code: "FORBIDDEN",
        error: "Cross-branch approval not allowed",
      });

      const req = new NextRequest(
        "http://localhost/api/desktop/v1/staff/onboarding/550e8400-e29b-41d4-a716-446655440000/approve",
        {
          method: "POST",
          body: JSON.stringify({
            branchId: "550e8400-e29b-41d4-a716-446655440001",
            systemRole: "staff",
            tier: "junior",
          }),
        }
      );

      const res = await approveRoute(req, {
        params: Promise.resolve({ requestId: "550e8400-e29b-41d4-a716-446655440000" }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.code).toBe("FORBIDDEN");
    });

    it("returns 200 on successful approval", async () => {
      mockedAuth.mockResolvedValueOnce(authSuccess());
      mockedApprove.mockResolvedValueOnce({
        ok: true,
        data: {
          staffId: "550e8400-e29b-41d4-a716-446655440002",
          branchId: "550e8400-e29b-41d4-a716-446655440001",
          systemRole: "staff",
        },
      });

      const req = new NextRequest(
        "http://localhost/api/desktop/v1/staff/onboarding/550e8400-e29b-41d4-a716-446655440000/approve",
        {
          method: "POST",
          body: JSON.stringify({
            branchId: "550e8400-e29b-41d4-a716-446655440001",
            systemRole: "staff",
            tier: "junior",
          }),
        }
      );

      const res = await approveRoute(req, {
        params: Promise.resolve({ requestId: "550e8400-e29b-41d4-a716-446655440000" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.staffId).toBe("550e8400-e29b-41d4-a716-446655440002");
    });
  });

  describe("POST /api/desktop/v1/staff/onboarding/[requestId]/reject", () => {
    it("returns 401 when unauthenticated", async () => {
      mockedAuth.mockResolvedValueOnce({
        ok: false,
        status: 401,
        code: "UNAUTHORIZED",
        message: "Missing token",
      });

      const req = new NextRequest(
        "http://localhost/api/desktop/v1/staff/onboarding/550e8400-e29b-41d4-a716-446655440000/reject",
        {
          method: "POST",
        }
      );

      const res = await rejectRoute(req, {
        params: Promise.resolve({ requestId: "550e8400-e29b-41d4-a716-446655440000" }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 200 on successful rejection", async () => {
      mockedAuth.mockResolvedValueOnce(authSuccess());
      mockedReject.mockResolvedValueOnce({
        ok: true,
        data: {
          requestId: "550e8400-e29b-41d4-a716-446655440000",
          staffId: "550e8400-e29b-41d4-a716-446655440002",
        },
      });

      const req = new NextRequest(
        "http://localhost/api/desktop/v1/staff/onboarding/550e8400-e29b-41d4-a716-446655440000/reject",
        {
          method: "POST",
          body: JSON.stringify({ rejectionReason: "Position filled" }),
        }
      );

      const res = await rejectRoute(req, {
        params: Promise.resolve({ requestId: "550e8400-e29b-41d4-a716-446655440000" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.requestId).toBe("550e8400-e29b-41d4-a716-446655440000");
    });
  });
});
