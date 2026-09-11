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

function createMockSupabase(
  branchExists = true,
  notifications: unknown[] = [],
  unassignedCount = 0,
  unassignedError: { message: string } | null = null,
  notificationsError: { message: string } | null = null
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
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => ({
              eq: vi.fn().mockImplementation(() => ({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({
                        data: notificationsError ? null : notifications,
                        error: notificationsError,
                      }),
                    }),
                  }),
                }),
              })),
            })),
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
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
  };
}

function authResult(
  branchId = "branch-main",
  role = "crm",
  branchExists = true,
  notifications: unknown[] = [],
  unassignedCount = 0,
  unassignedError: { message: string } | null = null,
  notificationsError: { message: string } | null = null
) {
  const supabase = createMockSupabase(
    branchExists,
    notifications,
    unassignedCount,
    unassignedError,
    notificationsError
  );
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
  });

  // 9. Future pending queue included
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

  // 10. Deduplication
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

  // 11. Queue ordering
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

  // 12. Empty queue valid
  it("returns valid empty queue when no bookings exist", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.data.queue).toEqual([]);
    expect(body.data.summary.total).toBe(0);
  });

  // 13 & Finding A: Readiness does NOT depend on cookie auth; uses client-aware projection
  it("computes readiness projection using bearer client context without cookie auth", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main", "crm", true, [], 2) as never);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();

    expect(body.data.readiness.available).toBe(true);
    expect(body.data.readiness.status).toBe("warning");
    expect(body.data.readiness.issues).toHaveLength(1);
    expect(body.data.readiness.issues[0].id).toBe("daily:unassigned-bookings");
    expect(body.data.readiness.issues[0].scope).toBe("daily");
    expect(body.data.readiness.issues[0].count).toBe(2);
  });

  // 14 & Finding B: Payment readiness explicitly excluded
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

    // Also verify computeDesktopTodayReadiness with custom issues
    const readiness = computeDesktopTodayReadiness({
      unassignedCount: 0,
      customIssues: rawIssues,
    });
    expect(readiness.issues.some((i) => i.scope === "payment")).toBe(false);
    expect(readiness.issues.some((i) => i.id.startsWith("payment:"))).toBe(false);
    expect(readiness.issues).toHaveLength(1);
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
    expect(body.data.attendance.available).toBe(true);
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
    expect(body.data.attendance.available).toBe(false);
    expect(body.data.attendance.error).toBe("Network failure");
    expect(body.data.attendance.items).toEqual([]);
  });

  // 17 & Finding C: Notifications operational-only with server-side scoping
  it("maps only operational action-required CRM notifications and filters out failure gracefully", async () => {
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
        target_workspace: "crm",
      },
    ];

    mockedAuth.mockResolvedValue(authResult("branch-main", "crm", true, notifications) as never);

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();
    expect(body.data.notifications.available).toBe(true);
    expect(body.data.notifications.items).toHaveLength(1);
    expect(body.data.notifications.items[0].title).toBe("Home Service Location Review");
    expect(body.data.notifications.items[0].priority).toBe("urgent");
    expect(body.data.notifications.items[0].requiresAction).toBe(true);
  });

  // Finding C: Notification query error is represented truthfully as available: false
  it("represents notification query failure truthfully as available: false", async () => {
    mockedAuth.mockResolvedValue(
      authResult("branch-main", "crm", true, [], 0, null, { message: "DB timeout" }) as never
    );

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();
    expect(body.data.notifications.available).toBe(false);
    expect(body.data.notifications.items).toEqual([]);
    expect(body.data.notifications.error).toBe("Notifications could not be refreshed.");
  });

  // Finding D: Unassigned count failure fails GET truthfully (does NOT become unassigned=0)
  it("fails GET truthfully with 500 when unassigned-count query fails", async () => {
    mockedAuth.mockResolvedValue(
      authResult("branch-main", "crm", true, [], 0, {
        message: "Database connection lost",
      }) as never
    );

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("SERVER_ERROR");
  });

  // 18, 19 & Finding E: Home Service context from authoritative dispatch
  it("exposes truthful Home Service operational fields from authoritative dispatch without fake location/ETA", async () => {
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
      } as never,
    ]);

    mockedDispatch.mockResolvedValue({
      items: [
        {
          id: "hs-booking-1",
          number: "B-100",
          bookingDate: "2026-09-11",
          startTime: "11:00:00",
          endTime: "12:00:00",
          customerName: "Ana Reyes",
          serviceName: "Home Service Massage",
          area: "Makati",
          formattedAddress: "123 Sunflower St, Makati City",
          lat: 14.5547,
          lng: 121.0244,
          branchName: "Main Branch",
          branchLat: 14.55,
          branchLng: 121.02,
          needsLocationReview: true,
          driverId: "driver-5",
          driverName: "Carlos Mendoza",
          therapistId: "staff-2",
          therapistName: "Therapist Jane",
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
      alerts: [
        {
          id: "alert-1",
          bookingId: "hs-booking-1",
          title: "Passcode Required",
          description: "Address requires gate passcode",
          severity: "warning",
          timeAgo: "5m ago",
          dispatchNumber: "B-100",
        },
      ],
      today: "2026-09-11",
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

  // Finding E: Auxiliary dispatch failure does NOT fabricate noDriverWarning=true
  it("does NOT fabricate noDriverWarning=true when dispatch query fails", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);

    mockedTodaySchedule.mockResolvedValue([
      {
        id: "hs-booking-2",
        branch_id: "branch-main",
        booking_date: "2026-09-11",
        start_time: "15:00:00",
        end_time: "16:00:00",
        status: "confirmed",
        type: "home_service",
        delivery_type: "home_service",
        booking_progress_status: "not_started",
        customers: { full_name: "Ben Ramos", phone: null },
        services: { name: "Home Service", duration_minutes: 60 },
        staff: null,
        resource_id: null,
      } as never,
    ]);

    mockedDispatch.mockRejectedValue(new Error("Dispatch service offline"));

    const response = await GET(new NextRequest("https://example.test/api/desktop/v1/today"));
    const body = await response.json();
    const item = body.data.queue[0];

    expect(item.isHomeService).toBe(true);
    expect(item.noDriverWarning).toBe(false); // MUST be false, not fabricated
    expect(item.dispatchWarning).toBe("Dispatch context unavailable");
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
