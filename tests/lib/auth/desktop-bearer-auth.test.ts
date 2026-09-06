import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { createClient } from "@supabase/supabase-js";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

type MockSupabaseClient = {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
};

describe("Desktop Bearer Auth Direct Verification", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("A. returns 401 when Authorization header is completely missing", async () => {
    const req = new Request("http://localhost:3000/api/desktop/v1/bookings", {
      method: "POST",
    });

    const result = await verifyDesktopBearerAuth(req);

    expect(result).toEqual({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Authorization header is required.",
    });
  });

  it("B. returns 401 when Authorization header does not use Bearer scheme (e.g. Basic)", async () => {
    const req = new Request("http://localhost:3000/api/desktop/v1/bookings", {
      method: "POST",
      headers: {
        Authorization: "Basic dXNlcjpwYXNz",
      },
    });

    const result = await verifyDesktopBearerAuth(req);

    expect(result).toEqual({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Malformed Authorization header. Expected Bearer scheme.",
    });
  });

  it("C. returns 401 when Bearer scheme is present but token is empty whitespace", async () => {
    const req = new Request("http://localhost:3000/api/desktop/v1/bookings", {
      method: "POST",
      headers: {
        Authorization: "Bearer   ",
      },
    });

    const result = await verifyDesktopBearerAuth(req);

    expect(result).toEqual({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Bearer token is missing or empty.",
    });
  });

  it("D. returns 500 SERVER_CONFIG_ERROR when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const req = new Request("http://localhost:3000/api/desktop/v1/bookings", {
      method: "POST",
      headers: {
        Authorization: "Bearer some-token",
      },
    });

    const result = await verifyDesktopBearerAuth(req);

    expect(result).toEqual({
      ok: false,
      status: 500,
      code: "SERVER_CONFIG_ERROR",
      message: "Supabase configuration is missing.",
    });
  });

  it("E. returns 500 SERVER_CONFIG_ERROR when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const req = new Request("http://localhost:3000/api/desktop/v1/bookings", {
      method: "POST",
      headers: {
        Authorization: "Bearer some-token",
      },
    });

    const result = await verifyDesktopBearerAuth(req);

    expect(result).toEqual({
      ok: false,
      status: 500,
      code: "SERVER_CONFIG_ERROR",
      message: "Supabase configuration is missing.",
    });
  });

  it("F. returns 401 UNAUTHORIZED when supabase.auth.getUser rejects the token", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid JWT signature", status: 401 },
    });

    const mockClient: MockSupabaseClient = {
      auth: { getUser: mockGetUser },
      from: vi.fn(),
    };

    vi.mocked(createClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createClient>
    );

    const req = new Request("http://localhost:3000/api/desktop/v1/bookings", {
      method: "POST",
      headers: {
        Authorization: "Bearer invalid-or-expired-jwt",
      },
    });

    const result = await verifyDesktopBearerAuth(req);

    expect(createClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key",
      expect.objectContaining({
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: "Bearer invalid-or-expired-jwt" } },
      })
    );

    expect(mockGetUser).toHaveBeenCalledWith("invalid-or-expired-jwt");

    expect(result).toEqual({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Invalid or expired access token.",
    });
  });

  it("G. returns 403 STAFF_NOT_FOUND when user is valid but no active staff record exists", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const mockEqIsActive = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqAuthUserId = vi.fn().mockReturnValue({ eq: mockEqIsActive });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqAuthUserId });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockClient: MockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-without-staff", email: "nostaff@example.com" } },
          error: null,
        }),
      },
      from: mockFrom,
    };

    vi.mocked(createClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createClient>
    );

    const req = new Request("http://localhost:3000/api/desktop/v1/bookings", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token-no-staff",
      },
    });

    const result = await verifyDesktopBearerAuth(req);

    expect(mockFrom).toHaveBeenCalledWith("staff");
    expect(mockSelect).toHaveBeenCalledWith("id, branch_id, system_role");
    expect(mockEqAuthUserId).toHaveBeenCalledWith("auth_user_id", "user-without-staff");
    expect(mockEqIsActive).toHaveBeenCalledWith("is_active", true);

    expect(result).toEqual({
      ok: false,
      status: 403,
      code: "STAFF_NOT_FOUND",
      message: "No active staff profile found for this authenticated user.",
    });
  });

  it("H. returns 403 CRM_PERMISSION_DENIED when staff role cannot access CRM (e.g. therapist)", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "staff-therapist-1",
        branch_id: "branch-1",
        system_role: "therapist",
      },
      error: null,
    });
    const mockEqIsActive = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqAuthUserId = vi.fn().mockReturnValue({ eq: mockEqIsActive });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqAuthUserId });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockClient: MockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-therapist", email: "therapist@example.com" } },
          error: null,
        }),
      },
      from: mockFrom,
    };

    vi.mocked(createClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createClient>
    );

    const req = new Request("http://localhost:3000/api/desktop/v1/bookings", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token-therapist",
      },
    });

    const result = await verifyDesktopBearerAuth(req);

    expect(result).toEqual({
      ok: false,
      status: 403,
      code: "CRM_PERMISSION_DENIED",
      message: "You do not have permission to access the CRM booking workspace.",
    });
  });

  it("I. returns authorized operator and authenticated client for verified active staff with allowed CRM role", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "staff-mgr-1",
        branch_id: "branch-greenhills",
        system_role: "manager",
      },
      error: null,
    });
    const mockEqIsActive = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqAuthUserId = vi.fn().mockReturnValue({ eq: mockEqIsActive });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqAuthUserId });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockClient: MockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-mgr-1", email: "manager@example.com" } },
          error: null,
        }),
      },
      from: mockFrom,
    };

    vi.mocked(createClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createClient>
    );

    const req = new Request("http://localhost:3000/api/desktop/v1/bookings", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token-123",
      },
    });

    const result = await verifyDesktopBearerAuth(req);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.operator).toEqual({
      authUserId: "user-mgr-1",
      staff: {
        id: "staff-mgr-1",
        branch_id: "branch-greenhills",
        system_role: "manager",
      },
      staffRole: "manager",
      isDevBypass: false,
    });
    expect(result.user).toEqual({
      id: "user-mgr-1",
      email: "manager@example.com",
    });
    expect(result.client).toBe(mockClient);
  });

  it("J. normalizes legacy role alias (csr) to canonical crm role", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "staff-csr-1",
        branch_id: "branch-bgc",
        system_role: "csr",
      },
      error: null,
    });
    const mockEqIsActive = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqAuthUserId = vi.fn().mockReturnValue({ eq: mockEqIsActive });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqAuthUserId });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockClient: MockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-csr-1", email: "csr@example.com" } },
          error: null,
        }),
      },
      from: mockFrom,
    };

    vi.mocked(createClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createClient>
    );

    const req = new Request("http://localhost:3000/api/desktop/v1/bookings", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token-csr",
      },
    });

    const result = await verifyDesktopBearerAuth(req);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.operator).toEqual({
      authUserId: "user-csr-1",
      staff: {
        id: "staff-csr-1",
        branch_id: "branch-bgc",
        system_role: "csr",
      },
      staffRole: "crm",
      isDevBypass: false,
    });
    expect(result.user).toEqual({
      id: "user-csr-1",
      email: "csr@example.com",
    });
    expect(result.client).toBe(mockClient);
  });

  it("K. regression test: super-admin user ID without active staff record is NOT granted owner override", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const mockEqIsActive = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqAuthUserId = vi.fn().mockReturnValue({ eq: mockEqIsActive });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqAuthUserId });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockClient: MockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "super-user-id-999", email: "super@example.com" } },
          error: null,
        }),
      },
      from: mockFrom,
    };

    vi.mocked(createClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createClient>
    );

    const req = new Request("http://localhost:3000/api/desktop/v1/bookings", {
      method: "POST",
      headers: {
        Authorization: "Bearer super-admin-token",
      },
    });

    const result = await verifyDesktopBearerAuth(req);

    // Must FAIL closed because the super-admin has no active staff profile in the database
    expect(result).toEqual({
      ok: false,
      status: 403,
      code: "STAFF_NOT_FOUND",
      message: "No active staff profile found for this authenticated user.",
    });
  });

  it("L. ensures raw bearer token or service credentials are never leaked in returned result", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "staff-100",
        branch_id: "branch-1",
        system_role: "owner",
      },
      error: null,
    });
    const mockEqIsActive = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqAuthUserId = vi.fn().mockReturnValue({ eq: mockEqIsActive });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqAuthUserId });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockClient: MockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-owner-1", email: "owner@example.com" } },
          error: null,
        }),
      },
      from: mockFrom,
    };

    vi.mocked(createClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createClient>
    );

    const secretToken = "super-secret-access-token-xyz-123";
    const req = new Request("http://localhost:3000/api/desktop/v1/bookings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretToken}`,
      },
    });

    const result = await verifyDesktopBearerAuth(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result).not.toHaveProperty("token");
      expect(result).not.toHaveProperty("accessToken");
      expect(result).not.toHaveProperty("access_token");
      expect(Object.prototype.hasOwnProperty.call(result.operator, "token")).toBe(false);
    }
  });

  it("M. explicitly sets isDevBypass: false even when dev bypass environment flags are active", async () => {
    process.env.DEV_AUTH_BYPASS = "true";
    process.env.DEV_ALLOW_ALL_MODULES = "true";

    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "staff-crm-1",
        branch_id: "branch-test",
        system_role: "crm",
      },
      error: null,
    });
    const mockEqIsActive = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqAuthUserId = vi.fn().mockReturnValue({ eq: mockEqIsActive });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqAuthUserId });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const mockClient: MockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-crm-1", email: "crm@example.com" } },
          error: null,
        }),
      },
      from: mockFrom,
    };

    vi.mocked(createClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createClient>
    );

    const req = new Request("http://localhost:3000/api/desktop/v1/bookings", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
      },
    });

    const result = await verifyDesktopBearerAuth(req);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.operator.isDevBypass).toBe(false);
    }
  });
});
