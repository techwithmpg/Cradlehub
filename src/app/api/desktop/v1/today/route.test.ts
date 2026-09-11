vi.mock("server-only", () => ({}));
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/desktop-bearer-auth", () => ({
  verifyDesktopBearerAuth: vi.fn(),
}));

vi.mock("@/lib/queries/bookings", () => ({
  getTodaysSchedule: vi.fn(),
  getCrmPendingBookingQueue: vi.fn(),
  getManagerDashboardStats: vi.fn(),
}));

vi.mock("@/lib/queries/crm-readiness", () => ({
  getCrmReadinessCached: vi.fn(),
}));

vi.mock("@/lib/attendance/recent-scans", () => ({
  getRecentAttendanceScanFeed: vi.fn(),
  createAttendanceScanFeedFallback: vi.fn((params) => ({
    selectedDate: params.selectedDate,
    timezone: "Asia/Manila",
    branchId: params.branchId ?? null,
    branchName: params.branchName ?? null,
    items: [],
    lastHourCount: 0,
    lastHourOperations: [],
    nextCursor: null,
    error: params.error ?? null,
  })),
}));

vi.mock("@/lib/actions/driver-actions", () => ({
  getBranchBookingDriverIds: vi.fn(),
  getDriverNamesByIds: vi.fn(),
}));

vi.mock("@/lib/engine/slot-time", () => ({
  getBranchBusinessDate: vi.fn(() => "2026-09-11"),
  BRANCH_TIMEZONE: "Asia/Manila",
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import {
  getCrmPendingBookingQueue,
  getManagerDashboardStats,
  getTodaysSchedule,
} from "@/lib/queries/bookings";
import { getCrmReadinessCached } from "@/lib/queries/crm-readiness";
import { getRecentAttendanceScanFeed } from "@/lib/attendance/recent-scans";
import { getBranchBookingDriverIds, getDriverNamesByIds } from "@/lib/actions/driver-actions";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { GET } from "./route";

const mockedAuth = vi.mocked(verifyDesktopBearerAuth);
const mockedTodaySchedule = vi.mocked(getTodaysSchedule);
const mockedPendingQueue = vi.mocked(getCrmPendingBookingQueue);
const mockedDashboardStats = vi.mocked(getManagerDashboardStats);
const mockedReadiness = vi.mocked(getCrmReadinessCached);
const mockedAttendance = vi.mocked(getRecentAttendanceScanFeed);
const mockedDriverIds = vi.mocked(getBranchBookingDriverIds);
const mockedDriverNames = vi.mocked(getDriverNamesByIds);
const mockedBusinessDate = vi.mocked(getBranchBusinessDate);

function createMockSupabase(
  branchExists = true,
  notifications: unknown[] = [],
  unassignedCount = 0
) {
  return {
    from: vi.fn((table: string) => {
      if (table === "branches") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: branchExists ? { id: "branch-main", name: "Main Branch" } : null,
                error: branchExists ? null : { message: "Branch not found" },
              }),
            }),
          }),
        };
      }
      if (table === "bookings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockResolvedValue({
                    count: unassignedCount,
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "branch_resources") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: "res-1", name: "Room 101" }],
              error: null,
            }),
          }),
        };
      }
      if (table === "workspace_notifications") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: notifications,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  };
}

function authResult(
  branchId: string | null = "branch-main",
  role = "crm",
  branchExists = true,
  notifications: unknown[] = []
) {
  return {
    ok: true as const,
    operator: {
      authUserId: "user-1",
      staff: {
        id: "staff-1",
        branch_id: branchId,
        system_role: role,
      },
      staffRole: role,
      isDevBypass: false,
    },
    user: {
      id: "user-1",
      email: "crm@example.test",
    },
    client: createMockSupabase(branchExists, notifications),
  };
}

describe("GET /api/desktop/v1/today", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedBusinessDate.mockReturnValue("2026-09-11");
    mockedTodaySchedule.mockResolvedValue([]);
    mockedPendingQueue.mockResolvedValue([]);
    mockedDashboardStats.mockResolvedValue({
      total: 0,
      pending: 0,
      confirmed: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    });
    mockedReadiness.mockResolvedValue({
      status: "ok",
      issues: [],
    });
    mockedAttendance.mockResolvedValue({
      selectedDate: "2026-09-11",
      timezone: "Asia/Manila",
      branchId: "branch-main",
      branchName: "Main Branch",
      items: [],
      lastHourCount: 0,
      lastHourOperations: [],
      nextCursor: null,
      error: null,
    });
    mockedDriverIds.mockResolvedValue({});
    mockedDriverNames.mockResolvedValue({});
  });

  // 1. Missing bearer rejected
  it("rejects request when Authorization header is missing (401)", async () => {
    mockedAuth.mockResolvedValue({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Authorization header is required.",
    });

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      code: "UNAUTHORIZED",
      message: "Authorization header is required.",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  // 2. Invalid bearer rejected
  it("rejects invalid or expired bearer tokens (401)", async () => {
    mockedAuth.mockResolvedValue({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Invalid or expired access token.",
    });

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      ok: false,
      code: "UNAUTHORIZED",
    });
  });

  // 3. Inactive/non-CRM staff rejected
  it("rejects staff with no active profile or unauthorized role (403)", async () => {
    mockedAuth.mockResolvedValue({
      ok: false,
      status: 403,
      code: "CRM_PERMISSION_DENIED",
      message: "You do not have permission to access the CRM booking workspace.",
    });

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      ok: false,
      code: "CRM_PERMISSION_DENIED",
    });
  });

  // 4. Staff without branch rejected
  it("rejects staff without an associated branch (403)", async () => {
    mockedAuth.mockResolvedValue(authResult(null) as never);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      ok: false,
      code: "STAFF_NOT_FOUND",
    });
  });

  // 5 & 6. Server-resolved branch; renderer cannot override branch
  it("uses server-resolved branch and ignores renderer branchId parameter", async () => {
    const auth = authResult("branch-main");
    mockedAuth.mockResolvedValue(auth as never);

    const response = await GET(
      new NextRequest("https://example.test/api/desktop/v1/today?branchId=attacker-branch")
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.context.branchId).toBe("branch-main");
    expect(body.data.context.branchName).toBe("Main Branch");

    expect(mockedTodaySchedule).toHaveBeenCalledWith(
      "branch-main",
      "2026-09-11",
      expect.anything()
    );
  });

  // 7. Server-authoritative business date
  it("uses authoritative server-resolved business date", async () => {
    mockedBusinessDate.mockReturnValue("2026-10-15");
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.context.businessDate).toBe("2026-10-15");
    expect(mockedTodaySchedule).toHaveBeenCalledWith(
      "branch-main",
      "2026-10-15",
      expect.anything()
    );
  });

  // 8 & 9. Today schedule returned & future pending queue included correctly
  it("combines today schedule and future pending bookings correctly", async () => {
    const auth = authResult("branch-main");
    mockedAuth.mockResolvedValue(auth as never);

    mockedTodaySchedule.mockResolvedValue([
      {
        id: "booking-today-1",
        branch_id: "branch-main",
        booking_date: "2026-09-11",
        start_time: "10:00:00",
        end_time: "11:00:00",
        status: "confirmed",
        type: "in_spa",
        delivery_type: null,
        booking_progress_status: "not_started",
        customers: { full_name: "Juan Dela Cruz", phone: "09171112222" },
        services: { name: "Swedish Massage", duration_minutes: 60 },
        staff: { id: "staff-10", full_name: "Maria Santos" },
        resource_id: null,
        metadata: null,
      } as never,
    ]);

    mockedPendingQueue.mockResolvedValue([
      {
        id: "booking-future-1",
        branch_id: "branch-main",
        booking_date: "2026-09-12",
        start_time: "09:00:00",
        end_time: "10:00:00",
        status: "pending_crm_confirmation",
        type: "in_spa",
        delivery_type: null,
        booking_progress_status: "not_started",
        customers: { full_name: "Pedro Penduko", phone: "09183334444" },
        services: { name: "Foot Reflex", duration_minutes: 60 },
        staff: null,
        resource_id: null,
        metadata: null,
      } as never,
    ]);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.data.queue).toHaveLength(2);
    expect(body.data.queue[0].id).toBe("booking-today-1");
    expect(body.data.queue[0].customerName).toBe("Juan Dela Cruz");
    expect(body.data.queue[1].id).toBe("booking-future-1");
    expect(body.data.queue[1].customerName).toBe("Pedro Penduko");
  });

  // 10. Duplicate booking deduplicated
  it("deduplicates booking appearing in both today schedule and pending queue", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    const duplicateBooking = {
      id: "booking-dup",
      branch_id: "branch-main",
      booking_date: "2026-09-11",
      start_time: "14:00:00",
      end_time: "15:00:00",
      status: "pending",
      type: "in_spa",
      delivery_type: null,
      booking_progress_status: "not_started",
      customers: { full_name: "Duplicate User", phone: null },
      services: { name: "Service A", duration_minutes: 60 },
      staff: null,
      resource_id: null,
      metadata: null,
    } as never;

    mockedTodaySchedule.mockResolvedValue([duplicateBooking]);
    mockedPendingQueue.mockResolvedValue([duplicateBooking]);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.queue).toHaveLength(1);
    expect(body.data.queue[0].id).toBe("booking-dup");
  });

  // 11. Correct queue ordering (date ASC then start_time ASC)
  it("sorts queue strictly by booking_date then start_time ascending", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    mockedTodaySchedule.mockResolvedValue([
      {
        id: "b-late",
        branch_id: "branch-main",
        booking_date: "2026-09-11",
        start_time: "16:00:00",
        end_time: "17:00:00",
        status: "confirmed",
        type: "in_spa",
        delivery_type: null,
        metadata: null,
      } as never,
      {
        id: "b-early",
        branch_id: "branch-main",
        booking_date: "2026-09-11",
        start_time: "09:00:00",
        end_time: "10:00:00",
        status: "confirmed",
        type: "in_spa",
        delivery_type: null,
        metadata: null,
      } as never,
    ]);

    mockedPendingQueue.mockResolvedValue([
      {
        id: "b-tomorrow",
        branch_id: "branch-main",
        booking_date: "2026-09-12",
        start_time: "08:00:00",
        end_time: "09:00:00",
        status: "pending",
        type: "in_spa",
        delivery_type: null,
        metadata: null,
      } as never,
    ]);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();
    expect(body.data.queue.map((q: { id: string }) => q.id)).toEqual([
      "b-early",
      "b-late",
      "b-tomorrow",
    ]);
  });

  // 12. Empty queue valid
  it("returns 200 with clean empty queue when zero bookings exist", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);
    mockedTodaySchedule.mockResolvedValue([]);
    mockedPendingQueue.mockResolvedValue([]);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.queue).toEqual([]);
    expect(body.data.summary.total).toBe(0);
    expect(body.data.summary.waiting).toBe(0);
  });

  // 13. Readiness mapped truthfully
  it("maps readiness status and issues truthfully", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);
    mockedReadiness.mockResolvedValue({
      status: "warning",
      issues: [
        {
          id: "staff:unassigned-services",
          scope: "service",
          severity: "warning",
          title: "2 services have unassigned staff",
          problem: "Two services scheduled today have no therapist assigned.",
          impact: "Customer sessions may be delayed.",
          fix: "Assign qualified therapists.",
          actionLabel: "Open Schedule",
          actionHref: "/crm/schedule",
          count: 2,
          source: "getCrmReadiness",
        },
      ],
    });

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();
    expect(body.data.readiness.status).toBe("warning");
    expect(body.data.readiness.issues).toHaveLength(1);
    expect(body.data.readiness.issues[0].id).toBe("staff:unassigned-services");
  });

  // 14. Readiness failure semantics (never converts failure to fake 0 issues)
  it("maps readiness query failure to warning status with system issue instead of fake 0 issues", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);
    mockedReadiness.mockRejectedValue(new Error("Database timeout"));

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();
    expect(body.data.readiness.status).toBe("warning");
    expect(body.data.readiness.issues).toHaveLength(1);
    expect(body.data.readiness.issues[0].id).toBe("system:readiness-unavailable");
    expect(body.data.readiness.issues[0].title).toBe("Readiness checks could not be loaded");
  });

  // 15. Attendance mapped truthfully
  it("maps attendance scan feed truthfully", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);
    mockedAttendance.mockResolvedValue({
      selectedDate: "2026-09-11",
      timezone: "Asia/Manila",
      branchId: "branch-main",
      branchName: "Main Branch",
      items: [
        {
          eventId: "evt-1",
          staffId: "staff-10",
          staffName: "Maria Santos",
          staffNickname: "Maria",
          staffAvatarUrl: null,
          branchId: "branch-main",
          branchName: "Main Branch",
          eventType: "clock_in",
          outcome: "success",
          reasonCode: null,
          message: "Clocked in successfully",
          occurredAt: "2026-09-11T08:55:00Z",
          timezone: "Asia/Manila",
          shiftType: "opening",
          attendanceStatus: "present",
          workedMinutes: null,
          clockInAt: "2026-09-11T08:55:00Z",
          clockOutAt: null,
          sourceLabel: "QR Scan",
        },
      ],
      lastHourCount: 1,
      lastHourOperations: [],
      nextCursor: null,
      error: null,
    });

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();
    expect(body.data.attendance.lastHourCount).toBe(1);
    expect(body.data.attendance.items).toHaveLength(1);
    expect(body.data.attendance.items[0].staffName).toBe("Maria Santos");
    expect(body.data.attendance.error).toBeNull();
  });

  // 16. Attendance fallback/error semantics
  it("preserves attendance fallback error truthfully if feed fails", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);
    mockedAttendance.mockRejectedValue(new Error("Network failure"));

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();
    expect(body.data.attendance.error).toBe("Attendance activity could not be refreshed.");
    expect(body.data.attendance.items).toEqual([]);
  });

  // 17. Notifications operational-only
  it("maps only operational action-required notifications", async () => {
    const notifications = [
      {
        id: "notif-1",
        title: "Home Service Location Review",
        body: "Booking requires manual location confirmation.",
        type: "home_service_location_review",
        priority: "urgent",
        requires_action: true,
        created_at: "2026-09-11T09:00:00Z",
        branch_id: "branch-main",
      },
    ];

    mockedAuth.mockResolvedValue(authResult("branch-main", "crm", true, notifications) as never);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();
    expect(body.data.notifications).toHaveLength(1);
    expect(body.data.notifications[0].title).toBe("Home Service Location Review");
    expect(body.data.notifications[0].priority).toBe("urgent");
    expect(body.data.notifications[0].requiresAction).toBe(true);
  });

  // 18 & 19. Home Service context truthful; no fake location/ETA
  it("exposes truthful Home Service operational fields without fake location or ETA", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    mockedTodaySchedule.mockResolvedValue([
      {
        id: "hs-booking-1",
        branch_id: "branch-main",
        booking_date: "2026-09-11",
        start_time: "11:00:00",
        end_time: "12:00:00",
        status: "confirmed",
        type: "home_service",
        delivery_type: "home_service",
        booking_progress_status: "not_started",
        customers: { full_name: "Ana Reyes", phone: "09192223333" },
        services: { name: "Home Service Massage", duration_minutes: 60 },
        staff: null,
        resource_id: null,
        metadata: {
          home_service_address: {
            full_address: "123 Sunflower St, Makati City",
            zone: "Zone 1",
            city: "Makati",
          },
          dispatch: {
            dispatch_warning: "Address requires gate passcode",
            needs_location_review: true,
          },
        },
      } as never,
    ]);

    mockedDriverIds.mockResolvedValue({
      "hs-booking-1": "driver-5",
    });
    mockedDriverNames.mockResolvedValue({
      "driver-5": "Carlos Mendoza",
    });

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();
    const item = body.data.queue[0];

    expect(item.isHomeService).toBe(true);
    expect(item.driverId).toBe("driver-5");
    expect(item.driverName).toBe("Carlos Mendoza");
    expect(item.noDriverWarning).toBe(false);
    expect(item.dispatchWarning).toBe("Address requires gate passcode");
    expect(item.needsLocationReview).toBe(true);
    expect(item.homeServiceAddress).toBe("123 Sunflower St, Makati City");

    // Must NOT have fabricated continuous live tracking or fake ETA properties
    expect(item.live_eta).toBeUndefined();
    expect(item.currentLocation).toBeUndefined();
    expect(item.routeCoordinates).toBeUndefined();
  });

  // 20. No raw metadata leakage
  it("does not leak raw metadata blob to response", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    mockedTodaySchedule.mockResolvedValue([
      {
        id: "booking-meta-test",
        branch_id: "branch-main",
        booking_date: "2026-09-11",
        start_time: "13:00:00",
        end_time: "14:00:00",
        status: "confirmed",
        type: "in_spa",
        delivery_type: null,
        metadata: {
          secret_internal_key: "do-not-expose",
          private_note: "VIP customer",
        },
      } as never,
    ]);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();
    const item = body.data.queue[0];
    expect(item.metadata).toBeUndefined();
    expect(item.secret_internal_key).toBeUndefined();
  });

  // 21. Payment scope guard: no money/payment totals exposed
  it("strictly excludes payment totals, revenue, and money fields", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    mockedTodaySchedule.mockResolvedValue([
      {
        id: "booking-payment-test",
        branch_id: "branch-main",
        booking_date: "2026-09-11",
        start_time: "14:00:00",
        end_time: "15:00:00",
        status: "confirmed",
        payment_status: "paid",
        amount_paid: 1500,
        payment_reference: "GCASH-123456",
        type: "in_spa",
        delivery_type: null,
        metadata: {
          price_paid: 1500,
        },
      } as never,
    ]);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();
    const jsonStr = JSON.stringify(body);

    // Operational payment status allowed
    expect(body.data.queue[0].paymentStatus).toBe("paid");

    // Strictly forbidden financial fields
    expect(jsonStr).not.toContain("amount_paid");
    expect(jsonStr).not.toContain("price_paid");
    expect(jsonStr).not.toContain("payment_reference");
    expect(jsonStr).not.toContain("total_collected");
    expect(jsonStr).not.toContain("total_expected");
    expect(jsonStr).not.toContain("total_unpaid");
    expect(jsonStr).not.toContain("by_method");
  });

  // 22. Cache-Control no-store
  it("enforces Cache-Control: no-store header", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
