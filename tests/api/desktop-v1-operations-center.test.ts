import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
import { NextRequest } from "next/server";
import { GET as getOperationsCenterHandler } from "@/app/api/desktop/v1/operations-center/route";
import { POST as postOperationsMutationsHandler } from "@/app/api/desktop/v1/operations-center/mutations/route";
import * as bearerAuth from "@/lib/auth/desktop-bearer-auth";
import * as attendanceQueries from "@/lib/attendance/queries";
import * as crmSetupQueries from "@/lib/queries/crm-setup";
import * as serviceCatalog from "@/lib/services/service-catalog";
import type { InhouseBookingOperator } from "@/lib/bookings/inhouse-booking-engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

vi.mock("@/lib/auth/desktop-bearer-auth", () => ({
  verifyDesktopBearerAuth: vi.fn(),
}));

vi.mock("@/lib/attendance/queries", () => ({
  getAttendanceWorkspaceData: vi.fn(),
  resolveAttendanceException: vi.fn(),
}));

vi.mock("@/lib/queries/crm-setup", () => ({
  getCrmSetupHealth: vi.fn(),
}));

vi.mock("@/lib/services/service-catalog", () => ({
  getBranchProviderReadiness: vi.fn(),
}));

function createMockSupabase(overrides: Record<string, unknown> = {}): SupabaseClient<Database> {
  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "branches") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "branch-1", name: "Main Branch" },
          error: null,
        }),
      };
    }
    if (table === "staff") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "staff-1",
              full_name: "Maria Santos",
              nickname: "Maria",
              phone: "09171234567",
              system_role: "staff",
              staff_type: "therapist",
              tier: "senior",
              is_active: true,
              branch_id: "branch-1",
              auth_user_id: "auth-123",
              identity_verified_at: "2026-10-01T00:00:00Z",
              archived_at: null,
              merged_into_staff_id: null,
              created_at: "2026-09-01T00:00:00Z",
            },
          ],
          error: null,
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "staff-1",
            full_name: "Maria Santos",
            system_role: "staff",
            staff_type: "therapist",
            is_active: true,
            branch_id: "branch-1",
            archived_at: null,
            merged_into_staff_id: null,
          },
          error: null,
        }),
      };
    }
    if (table === "services") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "srv-1", name: "Swedish Massage", is_active: true },
          error: null,
        }),
      };
    }
    if (table === "staff_services") {
      return {
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  return { from: mockFrom, ...overrides } as unknown as SupabaseClient<Database>;
}

describe("Desktop v1 Operations Center Endpoints", () => {
  const operator: InhouseBookingOperator = {
    authUserId: "auth-user-1",
    staff: {
      id: "operator-1",
      branch_id: "branch-1",
      system_role: "manager",
    },
    staffRole: "manager",
    isDevBypass: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(attendanceQueries.getAttendanceWorkspaceData).mockResolvedValue({
      exceptions: [],
      scanEvents: [],
      deviceRegistry: { entries: [] },
    } as unknown as Awaited<ReturnType<typeof attendanceQueries.getAttendanceWorkspaceData>>);

    vi.mocked(crmSetupQueries.getCrmSetupHealth).mockResolvedValue({
      issues: [],
      score: 100,
    } as unknown as Awaited<ReturnType<typeof crmSetupQueries.getCrmSetupHealth>>);

    vi.mocked(serviceCatalog.getBranchProviderReadiness).mockResolvedValue([
      { serviceId: "srv-1", providerCount: 2, isReady: true },
    ]);
  });

  it("returns 401 when bearer token is invalid or missing", async () => {
    vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValue({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Authorization header is required.",
    });

    const req = new NextRequest("http://localhost/api/desktop/v1/operations-center");
    const res = await getOperationsCenterHandler(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns authoritative operations center diagnostic payload for valid operator", async () => {
    vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValue({
      ok: true,
      operator,
      user: { id: "auth-user-1" },
      client: createMockSupabase(),
    });

    const req = new NextRequest("http://localhost/api/desktop/v1/operations-center");
    const res = await getOperationsCenterHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.branchId).toBe("branch-1");
    expect(body.data.branchName).toBe("Main Branch");
    expect(body.data.readyLabel).toBe("Current Checks Clear");
    expect(body.data.counts.critical).toBe(0);
    expect(body.data.operatorRole).toBe("manager");
    expect(body.data.canPerformMutations).toBe(true);
    expect(Array.isArray(body.data.issues)).toBe(true);
    expect(Array.isArray(body.data.scans)).toBe(true);
  });

  it("rejects unauthorized actions such as account merge or deletion", async () => {
    vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValue({
      ok: true,
      operator,
      user: { id: "auth-user-1" },
      client: createMockSupabase(),
    });

    const req = new NextRequest("http://localhost/api/desktop/v1/operations-center/mutations", {
      method: "POST",
      body: JSON.stringify({ action: "merge_staff", targetId: "staff-2", sourceId: "staff-1" }),
    });

    const res = await postOperationsMutationsHandler(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("MUTATION_NOT_PERMITTED");
  });

  it("authoritatively assigns qualified provider to service", async () => {
    vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValue({
      ok: true,
      operator,
      user: { id: "auth-user-1" },
      client: createMockSupabase(),
    });

    const req = new NextRequest("http://localhost/api/desktop/v1/operations-center/mutations", {
      method: "POST",
      body: JSON.stringify({
        action: "assign_service_provider",
        serviceId: "srv-1",
        staffId: "staff-1",
      }),
    });

    const res = await postOperationsMutationsHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.providerCount).toBe(2);
    expect(body.data.serviceId).toBe("srv-1");
  });
});
