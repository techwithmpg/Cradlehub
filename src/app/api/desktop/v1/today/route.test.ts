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

vi.mock("@/lib/queries/dispatch-queries", () => ({
  getDispatchData: vi.fn(),
}));

vi.mock("@/lib/attendance/recent-scans", () => ({
  getRecentAttendanceScanFeed: vi.fn(),
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
import { getDispatchData } from "@/lib/queries/dispatch-queries";
import { getRecentAttendanceScanFeed } from "@/lib/attendance/recent-scans";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import {
  filterDesktopReadinessIssues,
  computeDesktopTodayReadiness,
} from "@/lib/today/desktop-today-contract";
import { GET } from "./route";

const mockedAuth = vi.mocked(verifyDesktopBearerAuth);
const mockedTodaySchedule = vi.mocked(getTodaysSchedule);
const mockedPendingQueue = vi.mocked(getCrmPendingBookingQueue);
const mockedDashboardStats = vi.mocked(getManagerDashboardStats);
const mockedDispatch = vi.mocked(getDispatchData);
const mockedAttendance = vi.mocked(getRecentAttendanceScanFeed);
const mockedBusinessDate = vi.mocked(getBranchBusinessDate);

// Predicate recorder for notifications query tests
type PredicateCall = {
  eq: [string, unknown][];
  in: [string, unknown][];
  not: [string, unknown, unknown][];
  order: [string, unknown][];
  limit: [number][];
};

let recordedNotificationPredicates: PredicateCall;

function createMockSupabase(params?: {
  branchExists?: boolean;
  notifications?: unknown[];
  unassignedCount?: number;
  unassignedError?: { message: string } | null;
  notificationsError?: { message: string } | null;
  resourceError?: { message: string } | null;
}) {
  const {
    branchExists = true,
    notifications = [],
    unassignedCount = 0,
    unassignedError = null,
    notificationsError = null,
    resourceError = null,
  } = params ?? {};

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
                    count: unassignedError ? null : unassignedCount,
                    error: unassignedError,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "workspace_notifications") {
        let currentItems = Array.isArray(notifications) ? [...notifications] : [];
        const queryBuilder = {
          eq: vi.fn().mockImplementation((col: string, val: unknown) => {
            recordedNotificationPredicates.eq.push([col, val]);
            currentItems = currentItems.filter(
              (item: unknown) =>
                typeof item === "object" &&
                item !== null &&
                (item as Record<string, unknown>)[col] === val
            );
            return queryBuilder;
          }),
          in: vi.fn().mockImplementation((col: string, val: unknown) => {
            recordedNotificationPredicates.in.push([col, val]);
            const allowed = Array.isArray(val) ? val : [];
            currentItems = currentItems.filter(
              (item: unknown) =>
                typeof item === "object" &&
                item !== null &&
                allowed.includes((item as Record<string, unknown>)[col])
            );
            return queryBuilder;
          }),
          not: vi.fn().mockImplementation((col: string, op: unknown, val: unknown) => {
            recordedNotificationPredicates.not.push([col, op, val]);
            if (op === "in" && typeof val === "string") {
              const trimmed = val.replace(/^\(|\)$/g, "");
              const excluded = trimmed.split(",").map((s) => s.trim());
              currentItems = currentItems.filter(
                (item: unknown) =>
                  typeof item === "object" &&
                  item !== null &&
                  !excluded.includes(String((item as Record<string, unknown>)[col]))
              );
            } else if (op === "in" && Array.isArray(val)) {
              currentItems = currentItems.filter(
                (item: unknown) =>
                  typeof item === "object" &&
                  item !== null &&
                  !val.includes((item as Record<string, unknown>)[col])
              );
            }
            return queryBuilder;
          }),
          order: vi.fn().mockImplementation((col: string, opts: unknown) => {
            recordedNotificationPredicates.order.push([col, opts]);
            return queryBuilder;
          }),
          limit: vi.fn().mockImplementation((count: number) => {
            recordedNotificationPredicates.limit.push([count]);
            return Promise.resolve({
              data: notificationsError ? null : currentItems.slice(0, count),
              error: notificationsError,
            });
          }),
        };

        return {
          select: vi.fn().mockReturnValue(queryBuilder),
        };
      }
      if (table === "branch_resources") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: resourceError ? null : [{ id: "res-1", name: "Room 101" }],
              error: resourceError,
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
  };
}

function authResult(
  branchId = "branch-main",
  role = "crm",
  mockParams?: Parameters<typeof createMockSupabase>[0]
) {
  const supabase = createMockSupabase(mockParams);
  return {
    ok: true as const,
    operator: {
      staffId: "staff-1",
      systemRole: role,
      staffRole: role,
      branchId,
      fullName: "Staff Operator",
      staff: {
        id: "staff-1",
        branch_id: branchId,
        system_role: role,
      },
    },
    user: { id: "user-1", email: "staff@example.com" },
    client: supabase as never,
  };
}

describe("GET /api/desktop/v1/today", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordedNotificationPredicates = {
      eq: [],
      in: [],
      not: [],
      order: [],
      limit: [],
    };

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
      today: "2026-09-11",
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

    mockedBusinessDate.mockReturnValue("2026-09-11");
  });

  // 1. Missing bearer rejected
  it("rejects request without Authorization header (401)", async () => {
    mockedAuth.mockResolvedValue({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Authorization header is required.",
    });

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  // 2. Invalid bearer rejected
  it("rejects invalid or expired bearer token (401)", async () => {
    mockedAuth.mockResolvedValue({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Invalid or expired access token.",
    });

    const req = new NextRequest("https://example.test/api/desktop/v1/today", {
      headers: { Authorization: "Bearer invalid-token" },
    });
    const response = await GET(req);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
  });

  // 3. Inactive/non-CRM staff rejected
  it("rejects non-CRM staff without workspace permissions (403)", async () => {
    mockedAuth.mockResolvedValue({
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "Your role (driver) does not have access to the CRM workspace.",
    });

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("FORBIDDEN");
  });

  // 4. Staff without branch rejected
  it("rejects staff profile without assigned branch (403)", async () => {
    mockedAuth.mockResolvedValue({
      ok: false,
      status: 403,
      code: "BRANCH_REQUIRED",
      message: "Your profile is not assigned to a branch.",
    });

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("BRANCH_REQUIRED");
  });

  // 5 & 6. Server-resolved branch; renderer cannot override
  it("uses server-authenticated branch and ignores renderer query params", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-server-123") as never);

    const req = new NextRequest(
      "https://example.test/api/desktop/v1/today?branchId=branch-spoofed&branch_id=branch-spoofed"
    );
    const response = await GET(req);
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.data.context.branchId).toBe("branch-server-123");
    expect(mockedTodaySchedule).toHaveBeenCalledWith(
      "branch-server-123",
      "2026-09-11",
      expect.anything()
    );
  });

  // 7. Authoritative business date
  it("uses server-authoritative business date from getBranchBusinessDate()", async () => {
    mockedBusinessDate.mockReturnValue("2026-10-25");
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();

    expect(body.data.context.businessDate).toBe("2026-10-25");
    expect(mockedTodaySchedule).toHaveBeenCalledWith(
      "branch-main",
      "2026-10-25",
      expect.anything()
    );
  });

  // 8. Today's schedule returned
  it("returns today's schedule items in queue", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    mockedTodaySchedule.mockResolvedValue([
      {
        id: "booking-1",
        branch_id: "branch-main",
        booking_date: "2026-09-11",
        start_time: "09:00:00",
        end_time: "10:00:00",
        status: "confirmed",
        type: "in_spa",
        delivery_type: null,
        booking_progress_status: "not_started",
        customers: { full_name: "John Doe", phone: "09171234567" },
        services: { name: "Signature Massage", duration_minutes: 60 },
        staff: { id: "staff-2", full_name: "Jane Smith", nickname: "Jane" },
        resource_id: "res-1",
      } as never,
    ]);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.data.queue).toHaveLength(1);
    expect(body.data.queue[0].id).toBe("booking-1");
    expect(body.data.queue[0].customerName).toBe("John Doe");
    expect(body.data.queue[0].serviceName).toBe("Signature Massage");
    expect(body.data.queue[0].staffName).toBe("Jane Smith (Jane)");
    expect(body.data.queue[0].resourceName).toBe("Room 101");
    expect(body.data.queue[0].dispatchContextAvailable).toBeNull();
  });

  // 9. Resource query failure fails GET truthfully (Section 3)
  it("fails GET truthfully with 500 when branch_resources query fails", async () => {
    mockedAuth.mockResolvedValue(
      authResult("branch-main", "crm", {
        resourceError: { message: "Database failure on resources" },
      }) as never
    );

    mockedTodaySchedule.mockResolvedValue([
      {
        id: "booking-res-fail",
        branch_id: "branch-main",
        booking_date: "2026-09-11",
        start_time: "09:00:00",
        end_time: "10:00:00",
        status: "confirmed",
        type: "in_spa",
        resource_id: "res-1",
      } as never,
    ]);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("SERVER_ERROR");
  });

  // 10. Future pending queue included
  it("includes pending queue bookings", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    mockedPendingQueue.mockResolvedValue([
      {
        id: "booking-pending-1",
        branch_id: "branch-main",
        booking_date: "2026-09-12",
        start_time: "10:00:00",
        end_time: "11:00:00",
        status: "pending",
        type: "in_spa",
        delivery_type: null,
        booking_progress_status: "not_started",
        customers: { full_name: "Alice Brown", phone: null },
        services: { name: "Facial", duration_minutes: 60 },
        staff: null,
        resource_id: null,
      } as never,
    ]);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();

    expect(body.data.queue).toHaveLength(1);
    expect(body.data.queue[0].id).toBe("booking-pending-1");
    expect(body.data.queue[0].status).toBe("pending");
    expect(body.data.queue[0].bookingDate).toBe("2026-09-12");
  });

  // 11. Deduplication
  it("deduplicates booking if present in both schedule and pending queue", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    const dupBooking = {
      id: "booking-dup",
      branch_id: "branch-main",
      booking_date: "2026-09-11",
      start_time: "14:00:00",
      end_time: "15:00:00",
      status: "pending",
      type: "in_spa",
      delivery_type: null,
      booking_progress_status: "not_started",
      customers: { full_name: "Same User", phone: null },
      services: { name: "Foot Spa", duration_minutes: 60 },
      staff: null,
      resource_id: null,
    };

    mockedTodaySchedule.mockResolvedValue([dupBooking as never]);
    mockedPendingQueue.mockResolvedValue([dupBooking as never]);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();

    expect(body.data.queue).toHaveLength(1);
    expect(body.data.queue[0].id).toBe("booking-dup");
  });

  // 12. Queue ordering
  it("sorts queue strictly by booking_date then start_time ASC", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    mockedTodaySchedule.mockResolvedValue([
      {
        id: "b-2",
        branch_id: "branch-main",
        booking_date: "2026-09-11",
        start_time: "14:00:00",
        end_time: "15:00:00",
        status: "confirmed",
        type: "in_spa",
        customers: null,
        services: null,
        staff: null,
      } as never,
      {
        id: "b-1",
        branch_id: "branch-main",
        booking_date: "2026-09-11",
        start_time: "09:00:00",
        end_time: "10:00:00",
        status: "confirmed",
        type: "in_spa",
        customers: null,
        services: null,
        staff: null,
      } as never,
    ]);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();

    expect(body.data.queue[0].id).toBe("b-1");
    expect(body.data.queue[1].id).toBe("b-2");
  });

  // 13. Empty queue valid
  it("returns valid empty queue when no bookings exist", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.data.queue).toEqual([]);
    expect(body.data.summary.total).toBe(0);
  });

  // 14. Readiness on dispatch success (Section 4)
  it("computes readiness projection on dispatch success with available: true", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main", "crm", { unassignedCount: 2 }) as never);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();

    expect(body.data.readiness.available).toBe(true);
    expect(body.data.readiness.status).toBe("warning");
    expect(body.data.readiness.issues).toHaveLength(1);
    expect(body.data.readiness.issues[0].id).toBe("daily:unassigned-bookings");
    expect(body.data.readiness.issues[0].scope).toBe("daily");
    expect(body.data.readiness.issues[0].count).toBe(2);
  });

  // 15. Readiness on dispatch failure returns available: false (Section 4)
  it("marks readiness.available = false and adds warning issue when dispatch query fails", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);
    mockedDispatch.mockRejectedValue(new Error("Dispatch offline"));

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();

    expect(body.data.readiness.available).toBe(false);
    expect(body.data.readiness.status).toBe("warning");
    expect(body.data.readiness.error).toBe("Dispatch offline");
    expect(
      body.data.readiness.issues.some(
        (i: { id: string }) => i.id === "system:dispatch-readiness-unavailable"
      )
    ).toBe(true);
  });

  // 16. Payment readiness explicitly excluded
  it("strictly excludes payment readiness issues such as payment:unpaid-bookings", () => {
    const rawIssues = [
      {
        id: "payment:unpaid-bookings",
        scope: "payment",
        severity: "warning",
        title: "5 unpaid bookings require payment review",
        problem: "Completed bookings have outstanding balance.",
        impact: "Cash flow reconciliation delayed.",
        fix: "Collect payment in payments portal.",
        actionLabel: "Open Payments",
        actionHref: "/crm/payments",
        count: 5,
      },
      {
        id: "daily:unassigned-bookings",
        scope: "daily",
        severity: "warning",
        title: "2 bookings need staff assignment",
        problem: "Confirmed bookings without staff.",
        impact: "May experience delay.",
        fix: "Assign staff in schedule.",
        actionLabel: "View Schedule",
        actionHref: "/crm/schedule",
        count: 2,
      },
    ];

    const filtered = filterDesktopReadinessIssues(rawIssues);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("daily:unassigned-bookings");
    expect(filtered[0]?.scope).toBe("daily");

    const readiness = computeDesktopTodayReadiness({
      unassignedCount: 0,
      dispatchAvailable: true,
      customIssues: rawIssues,
    });
    expect(readiness.issues.some((i) => i.scope === "payment")).toBe(false);
    expect(readiness.issues.some((i) => i.id.startsWith("payment:"))).toBe(false);
    expect(readiness.issues).toHaveLength(1);
  });

  // 17. Future Home Service missing dispatch item (Section 5 & 6)
  it("sets dispatchContextAvailable = false and noDriverWarning = false for future Home Service booking", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    mockedPendingQueue.mockResolvedValue([
      {
        id: "hs-future-1",
        branch_id: "branch-main",
        booking_date: "2026-09-12",
        start_time: "10:00:00",
        end_time: "11:00:00",
        status: "pending",
        type: "home_service",
        delivery_type: "home_service",
        booking_progress_status: "not_started",
        customers: { full_name: "Future Client", phone: null },
        services: { name: "Home Service", duration_minutes: 60 },
        staff: null,
        resource_id: null,
      } as never,
    ]);

    // Dispatch items are for today (2026-09-11) and do not contain hs-future-1
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
      today: "2026-09-11",
    });

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();
    const item = body.data.queue[0];

    expect(item.id).toBe("hs-future-1");
    expect(item.isHomeService).toBe(true);
    expect(item.dispatchContextAvailable).toBe(false);
    expect(item.driverId).toBeNull();
    expect(item.driverName).toBeNull();
    expect(item.noDriverWarning).toBe(false); // MUST NOT be true for future missing record
    expect(item.dispatchWarning).toBe("Dispatch context not loaded for future date");
  });

  // 18. Today Home Service missing dispatch record (Section 7)
  it("sets dispatchContextAvailable = false and noDriverWarning = false for today Home Service booking when dispatch record missing", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    mockedTodaySchedule.mockResolvedValue([
      {
        id: "hs-today-unindexed",
        branch_id: "branch-main",
        booking_date: "2026-09-11",
        start_time: "12:00:00",
        end_time: "13:00:00",
        status: "confirmed",
        type: "home_service",
        delivery_type: "home_service",
        customers: null,
        services: null,
        staff: null,
        resource_id: null,
      } as never,
    ]);

    // Dispatch query succeeded but does not have this item
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
      today: "2026-09-11",
    });

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();
    const item = body.data.queue[0];

    expect(item.isHomeService).toBe(true);
    expect(item.dispatchContextAvailable).toBe(false);
    expect(item.noDriverWarning).toBe(false); // MUST NOT fabricate true
    expect(item.dispatchWarning).toBe("Dispatch record not found");
  });

  // 19. Authoritative Home Service null driver (Section 8)
  it("sets dispatchContextAvailable = true and noDriverWarning = true ONLY when authoritative dispatch item has null driver", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    mockedTodaySchedule.mockResolvedValue([
      {
        id: "hs-today-auth",
        branch_id: "branch-main",
        booking_date: "2026-09-11",
        start_time: "14:00:00",
        end_time: "15:00:00",
        status: "confirmed",
        type: "home_service",
        delivery_type: "home_service",
        customers: null,
        services: null,
        staff: null,
        resource_id: null,
      } as never,
    ]);

    mockedDispatch.mockResolvedValue({
      items: [
        {
          id: "hs-today-auth",
          number: "D-101",
          bookingDate: "2026-09-11",
          startTime: "14:00:00",
          endTime: "15:00:00",
          customerName: "Ana Ramos",
          serviceName: "Full Massage",
          area: "Makati",
          formattedAddress: "456 Palm St",
          lat: 14.5,
          lng: 121.0,
          branchName: "Main Branch",
          branchLat: 14.5,
          branchLng: 121.0,
          needsLocationReview: false,
          driverId: null, // AUTHORITATIVE NULL
          driverName: null,
          therapistId: "staff-3",
          therapistName: "Therapist Rose",
          dispatchStatus: "awaiting_driver",
          bookingStatus: "confirmed",
          bookingProgressStatus: "not_started",
          paymentStatus: "paid",
          etaMinutes: null,
          travelStartedAt: null,
          arrivedAt: null,
          sessionStartedAt: null,
          completedAt: null,
          rating: null,
          currentLocation: null,
        },
      ],
      stats: {
        totalToday: 1,
        awaitingDispatch: 1,
        activeTrips: 0,
        completedToday: 0,
        cancelledToday: 0,
      },
      alerts: [],
      today: "2026-09-11",
    });

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();
    const item = body.data.queue[0];

    expect(item.isHomeService).toBe(true);
    expect(item.dispatchContextAvailable).toBe(true);
    expect(item.driverId).toBeNull();
    expect(item.noDriverWarning).toBe(true); // Authoritative null driver verified
    expect(item.homeServiceAddress).toBe("456 Palm St");
  });

  // 20. Authoritative Home Service assigned driver
  it("sets dispatchContextAvailable = true and noDriverWarning = false when driver is assigned", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    mockedTodaySchedule.mockResolvedValue([
      {
        id: "hs-today-assigned",
        branch_id: "branch-main",
        booking_date: "2026-09-11",
        start_time: "16:00:00",
        end_time: "17:00:00",
        status: "confirmed",
        type: "home_service",
        delivery_type: "home_service",
        customers: null,
        services: null,
        staff: null,
        resource_id: null,
      } as never,
    ]);

    mockedDispatch.mockResolvedValue({
      items: [
        {
          id: "hs-today-assigned",
          number: "D-102",
          bookingDate: "2026-09-11",
          startTime: "16:00:00",
          endTime: "17:00:00",
          customerName: "Ben Cruz",
          serviceName: "Massage",
          area: "Makati",
          formattedAddress: "789 Pine St",
          lat: 14.5,
          lng: 121.0,
          branchName: "Main Branch",
          branchLat: 14.5,
          branchLng: 121.0,
          needsLocationReview: true,
          driverId: "driver-8",
          driverName: "Danilo Rivera",
          therapistId: "staff-4",
          therapistName: "Therapist Lisa",
          dispatchStatus: "scheduled",
          bookingStatus: "confirmed",
          bookingProgressStatus: "not_started",
          paymentStatus: "paid",
          etaMinutes: null,
          travelStartedAt: null,
          arrivedAt: null,
          sessionStartedAt: null,
          completedAt: null,
          rating: null,
          currentLocation: null,
        },
      ],
      stats: {
        totalToday: 1,
        awaitingDispatch: 0,
        activeTrips: 0,
        completedToday: 0,
        cancelledToday: 0,
      },
      alerts: [],
      today: "2026-09-11",
    });

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();
    const item = body.data.queue[0];

    expect(item.dispatchContextAvailable).toBe(true);
    expect(item.driverId).toBe("driver-8");
    expect(item.driverName).toBe("Danilo Rivera");
    expect(item.noDriverWarning).toBe(false);
    expect(item.needsLocationReview).toBe(true);
  });

  // 21. Notification query asserts database predicates before LIMIT (Section 9 & 10)
  it("proves notifications query enforces branch, crm workspace, requires_action, unread/read, and dormant type exclusion before limit", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    await GET(new NextRequest("https://example.test/api/desktop/v1/today"));

    // Verify all predicates were invoked on the query builder
    expect(recordedNotificationPredicates.eq).toContainEqual(["branch_id", "branch-main"]);
    expect(recordedNotificationPredicates.eq).toContainEqual(["target_workspace", "crm"]);
    expect(recordedNotificationPredicates.eq).toContainEqual(["requires_action", true]);
    expect(recordedNotificationPredicates.in).toContainEqual(["status", ["unread", "read"]]);
    expect(recordedNotificationPredicates.not).toContainEqual([
      "type",
      "in",
      "(payment_pending,payment_overdue,reconciliation_submitted,marketing_content_updated)",
    ]);
    expect(recordedNotificationPredicates.limit).toContainEqual([20]);
  });

  // 22. Notification query error degrades truthfully
  it("represents notification query failure truthfully as available: false", async () => {
    mockedAuth.mockResolvedValue(
      authResult("branch-main", "crm", { notificationsError: { message: "DB timeout" } }) as never
    );

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();
    expect(body.data.notifications.available).toBe(false);
    expect(body.data.notifications.items).toEqual([]);
    expect(body.data.notifications.error).toBe("Notifications could not be refreshed.");
  });

  // 23. Unassigned count query error causes GET to fail (Section 2 & 9)
  it("fails GET truthfully with 500 when unassigned-count query fails", async () => {
    mockedAuth.mockResolvedValue(
      authResult("branch-main", "crm", {
        unassignedError: { message: "Database connection lost" },
      }) as never
    );

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("SERVER_ERROR");
  });

  // 24. Today stage count semantics: future pending does not inflate Today stage counts (Section 11)
  it("calculates workflow stage counts only for today's operations (bookingDate === businessDate)", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    mockedTodaySchedule.mockResolvedValue([
      {
        id: "today-1",
        branch_id: "branch-main",
        booking_date: "2026-09-11",
        start_time: "09:00:00",
        end_time: "10:00:00",
        status: "confirmed",
        type: "in_spa",
      } as never,
    ]);

    mockedPendingQueue.mockResolvedValue([
      {
        id: "tomorrow-pending",
        branch_id: "branch-main",
        booking_date: "2026-09-12",
        start_time: "10:00:00",
        end_time: "11:00:00",
        status: "pending",
        type: "in_spa",
      } as never,
    ]);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();

    // Queue has both items
    expect(body.data.queue).toHaveLength(2);

    // But summary stage counts reflect ONLY today's operations (waiting count = 1, not 2)
    expect(body.data.summary.waiting).toBe(1);
    expect(body.data.summary.inService).toBe(0);
    expect(body.data.summary.readyToPay).toBe(0);
    expect(body.data.summary.completedService).toBe(0);
  });

  // 25. Closed booking semantics: cancelled/no_show has stage: null (Section 12)
  it("preserves closed bookings in queue with stage: null", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    mockedTodaySchedule.mockResolvedValue([
      {
        id: "cancelled-today",
        branch_id: "branch-main",
        booking_date: "2026-09-11",
        start_time: "10:00:00",
        end_time: "11:00:00",
        status: "cancelled",
        type: "in_spa",
      } as never,
    ]);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();

    expect(body.data.queue).toHaveLength(1);
    expect(body.data.queue[0].status).toBe("cancelled");
    expect(body.data.queue[0].stage).toBeNull();
  });

  // 26. No raw metadata leakage
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

  // 27. Payment scope guard: no money/payment totals exposed
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

    expect(body.data.queue[0].paymentStatus).toBe("paid");

    expect(jsonStr).not.toContain("amount_paid");
    expect(jsonStr).not.toContain("price_paid");
    expect(jsonStr).not.toContain("payment_reference");
    expect(jsonStr).not.toContain("total_collected");
    expect(jsonStr).not.toContain("total_expected");
    expect(jsonStr).not.toContain("total_unpaid");
    expect(jsonStr).not.toContain("by_method");
  });

  // 28. Cache-Control no-store
  it("enforces Cache-Control: no-store header", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  // 28. Notification response-isolation test with mixed dataset (Section 8)
  it("proves notification response isolates allowed operational CRM notifications from a mixed dataset", async () => {
    const mixedNotifications = [
      // A. branch-main, target_workspace=crm, type=booking_created, requires_action=true, status=unread -> ALLOWED
      {
        id: "notif-allowed-1",
        branch_id: "branch-main",
        target_workspace: "crm",
        type: "booking_created",
        requires_action: true,
        status: "unread",
        title: "New Booking Created",
        body: "Booking created for customer",
        priority: "normal",
        created_at: "2026-09-11T08:00:00Z",
      },
      // B. branch-other, target_workspace=crm, type=booking_created, requires_action=true -> EXCLUDED by branch_id
      {
        id: "notif-other-branch",
        branch_id: "branch-other",
        target_workspace: "crm",
        type: "booking_created",
        requires_action: true,
        status: "unread",
        title: "Other Branch Notification",
        body: "Different branch",
        priority: "normal",
        created_at: "2026-09-11T08:00:00Z",
      },
      // C. branch-main, target_workspace=driver -> EXCLUDED by target_workspace
      {
        id: "notif-driver",
        branch_id: "branch-main",
        target_workspace: "driver",
        type: "dispatch_assigned",
        requires_action: true,
        status: "unread",
        title: "Driver Notification",
        body: "Driver action required",
        priority: "normal",
        created_at: "2026-09-11T08:00:00Z",
      },
      // D. branch-main, target_workspace=staff -> EXCLUDED by target_workspace
      {
        id: "notif-staff",
        branch_id: "branch-main",
        target_workspace: "staff",
        type: "schedule_updated",
        requires_action: true,
        status: "unread",
        title: "Staff Notification",
        body: "Staff action required",
        priority: "normal",
        created_at: "2026-09-11T08:00:00Z",
      },
      // E. branch-main, target_workspace=owner -> EXCLUDED by target_workspace
      {
        id: "notif-owner",
        branch_id: "branch-main",
        target_workspace: "owner",
        type: "system_alert",
        requires_action: true,
        status: "unread",
        title: "Owner Notification",
        body: "Owner action required",
        priority: "normal",
        created_at: "2026-09-11T08:00:00Z",
      },
      // F. branch-main, target_workspace=crm, type=payment_pending -> EXCLUDED by dormant type filter
      {
        id: "notif-payment-pending",
        branch_id: "branch-main",
        target_workspace: "crm",
        type: "payment_pending",
        requires_action: true,
        status: "unread",
        title: "Payment Pending",
        body: "Payment pending action",
        priority: "normal",
        created_at: "2026-09-11T08:00:00Z",
      },
      // G. branch-main, target_workspace=crm, type=payment_overdue -> EXCLUDED by dormant type filter
      {
        id: "notif-payment-overdue",
        branch_id: "branch-main",
        target_workspace: "crm",
        type: "payment_overdue",
        requires_action: true,
        status: "unread",
        title: "Payment Overdue",
        body: "Payment overdue action",
        priority: "normal",
        created_at: "2026-09-11T08:00:00Z",
      },
      // H. branch-main, target_workspace=crm, type=reconciliation_submitted -> EXCLUDED by dormant type filter
      {
        id: "notif-reconciliation",
        branch_id: "branch-main",
        target_workspace: "crm",
        type: "reconciliation_submitted",
        requires_action: true,
        status: "unread",
        title: "Reconciliation Submitted",
        body: "Reconciliation action",
        priority: "normal",
        created_at: "2026-09-11T08:00:00Z",
      },
      // I. branch-main, target_workspace=crm, type=marketing_content_updated -> EXCLUDED by dormant type filter
      {
        id: "notif-marketing",
        branch_id: "branch-main",
        target_workspace: "crm",
        type: "marketing_content_updated",
        requires_action: true,
        status: "unread",
        title: "Marketing Updated",
        body: "Marketing action",
        priority: "normal",
        created_at: "2026-09-11T08:00:00Z",
      },
    ];

    mockedAuth.mockResolvedValue(
      authResult("branch-main", "crm", { notifications: mixedNotifications }) as never
    );

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();

    expect(body.data.notifications.available).toBe(true);
    expect(body.data.notifications.items).toHaveLength(1);
    expect(body.data.notifications.items[0].id).toBe("notif-allowed-1");
    expect(body.data.notifications.items[0].type).toBe("booking_created");
    expect(body.data.notifications.items[0].title).toBe("New Booking Created");

    // Explicitly verify none of the excluded IDs exist in the returned list
    const returnedIds = body.data.notifications.items.map((n: { id: string }) => n.id);
    expect(returnedIds).not.toContain("notif-other-branch");
    expect(returnedIds).not.toContain("notif-driver");
    expect(returnedIds).not.toContain("notif-staff");
    expect(returnedIds).not.toContain("notif-owner");
    expect(returnedIds).not.toContain("notif-payment-pending");
    expect(returnedIds).not.toContain("notif-payment-overdue");
    expect(returnedIds).not.toContain("notif-reconciliation");
    expect(returnedIds).not.toContain("notif-marketing");
  });
});
