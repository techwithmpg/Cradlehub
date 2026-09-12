vi.mock("server-only", () => ({}));
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

vi.mock("@/lib/auth/desktop-bearer-auth", () => ({
  verifyDesktopBearerAuth: vi.fn(),
}));

vi.mock("@/lib/staff/staff-mutation-service", () => ({
  updateStaffProfileService: vi.fn(),
  assignStaffRoleService: vi.fn(),
  deactivateStaffService: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import {
  updateStaffProfileService,
  assignStaffRoleService,
  deactivateStaffService,
} from "@/lib/staff/staff-mutation-service";
import { PATCH as profileRoute } from "./[staffId]/route";
import { POST as roleRoute } from "./[staffId]/role/route";
import { POST as deactivateRoute } from "./[staffId]/deactivate/route";

const mockedAuth = vi.mocked(verifyDesktopBearerAuth);
const mockedUpdate = vi.mocked(updateStaffProfileService);
const mockedAssign = vi.mocked(assignStaffRoleService);
const mockedDeactivate = vi.mocked(deactivateStaffService);

function authSuccess() {
  return {
    ok: true as const,
    operator: {
      authUserId: "user-1",
      staff: {
        id: "staff-actor",
        branch_id: "branch-main",
        system_role: "owner",
      },
      staffRole: "owner",
      isDevBypass: false,
    },
    user: {
      id: "user-1",
      email: "owner@example.test",
    },
    client: {} as unknown as SupabaseClient<Database>,
  };
}

describe("Desktop Staff Mutation Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PATCH /api/desktop/v1/staff/[staffId]", () => {
    it("returns 401 when unauthenticated", async () => {
      mockedAuth.mockResolvedValueOnce({
        ok: false,
        status: 401,
        code: "UNAUTHORIZED",
        message: "Missing token",
      });

      const req = new NextRequest(
        "http://localhost/api/desktop/v1/staff/550e8400-e29b-41d4-a716-446655440000",
        {
          method: "PATCH",
        }
      );

      const res = await profileRoute(req, {
        params: Promise.resolve({ staffId: "550e8400-e29b-41d4-a716-446655440000" }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 400 for invalid staffId UUID", async () => {
      mockedAuth.mockResolvedValueOnce(authSuccess());

      const req = new NextRequest("http://localhost/api/desktop/v1/staff/bad-uuid", {
        method: "PATCH",
      });

      const res = await profileRoute(req, {
        params: Promise.resolve({ staffId: "bad-uuid" }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe("INVALID_INPUT");
    });

    it("returns 200 on successful profile update", async () => {
      mockedAuth.mockResolvedValueOnce(authSuccess());
      mockedUpdate.mockResolvedValueOnce({
        ok: true,
        data: {
          staff: {
            id: "550e8400-e29b-41d4-a716-446655440000",
            full_name: "Updated Name",
          },
        },
      });

      const req = new NextRequest(
        "http://localhost/api/desktop/v1/staff/550e8400-e29b-41d4-a716-446655440000",
        {
          method: "PATCH",
          body: JSON.stringify({ fullName: "Updated Name" }),
        }
      );

      const res = await profileRoute(req, {
        params: Promise.resolve({ staffId: "550e8400-e29b-41d4-a716-446655440000" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.staff.full_name).toBe("Updated Name");
    });
  });

  describe("POST /api/desktop/v1/staff/[staffId]/role", () => {
    it("returns 400 on invalid system role", async () => {
      mockedAuth.mockResolvedValueOnce(authSuccess());

      const req = new NextRequest(
        "http://localhost/api/desktop/v1/staff/550e8400-e29b-41d4-a716-446655440000/role",
        {
          method: "POST",
          body: JSON.stringify({ systemRole: "super_admin" }),
        }
      );

      const res = await roleRoute(req, {
        params: Promise.resolve({ staffId: "550e8400-e29b-41d4-a716-446655440000" }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe("INVALID_INPUT");
    });

    it("returns 200 on successful role assignment", async () => {
      mockedAuth.mockResolvedValueOnce(authSuccess());
      mockedAssign.mockResolvedValueOnce({
        ok: true,
        data: {
          staff: {
            id: "550e8400-e29b-41d4-a716-446655440000",
            system_role: "manager",
          },
        },
      });

      const req = new NextRequest(
        "http://localhost/api/desktop/v1/staff/550e8400-e29b-41d4-a716-446655440000/role",
        {
          method: "POST",
          body: JSON.stringify({ systemRole: "manager" }),
        }
      );

      const res = await roleRoute(req, {
        params: Promise.resolve({ staffId: "550e8400-e29b-41d4-a716-446655440000" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.staff.system_role).toBe("manager");
    });
  });

  describe("POST /api/desktop/v1/staff/[staffId]/deactivate", () => {
    it("returns 403 when service returns FORBIDDEN (e.g. self deactivation)", async () => {
      mockedAuth.mockResolvedValueOnce(authSuccess());
      mockedDeactivate.mockResolvedValueOnce({
        ok: false,
        code: "FORBIDDEN",
        error: "You cannot deactivate your own account.",
      });

      const req = new NextRequest(
        "http://localhost/api/desktop/v1/staff/550e8400-e29b-41d4-a716-446655440000/deactivate",
        {
          method: "POST",
          body: JSON.stringify({ reason: "Testing" }),
        }
      );

      const res = await deactivateRoute(req, {
        params: Promise.resolve({ staffId: "550e8400-e29b-41d4-a716-446655440000" }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.code).toBe("FORBIDDEN");
    });

    it("returns 200 on successful deactivation", async () => {
      mockedAuth.mockResolvedValueOnce(authSuccess());
      mockedDeactivate.mockResolvedValueOnce({
        ok: true,
        data: {
          staff: {
            id: "550e8400-e29b-41d4-a716-446655440000",
            is_active: false,
          },
        },
      });

      const req = new NextRequest(
        "http://localhost/api/desktop/v1/staff/550e8400-e29b-41d4-a716-446655440000/deactivate",
        {
          method: "POST",
        }
      );

      const res = await deactivateRoute(req, {
        params: Promise.resolve({ staffId: "550e8400-e29b-41d4-a716-446655440000" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.staff.is_active).toBe(false);
    });
  });
});
