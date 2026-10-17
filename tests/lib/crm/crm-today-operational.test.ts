import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getFrontDeskContext: vi.fn(),
  getBranchBusinessDate: vi.fn(() => "2026-10-17"),
  getTodaysSchedule: vi.fn(),
  getCrmPendingBookingQueue: vi.fn(),
  getCrmUpcomingBookings: vi.fn(),
  getCrmOrderServiceLines: vi.fn(),
  getCrmTodaySnapshot: vi.fn(),
  getActionRequiredNotificationsAction: vi.fn(),
  getCrmReadinessCached: vi.fn(),
  createAdminClient: vi.fn(),
  getBranchBookingDriverIds: vi.fn(),
  getDriverNamesByIds: vi.fn(),
  getLatestLocationsForActiveHomeServiceTrips: vi.fn(),
  getActiveTrackingTokensForBookings: vi.fn(),
  parseLiveEta: vi.fn((val) => val ?? null),
  upcomingBookingEndDate: vi.fn(() => "2026-10-24"),
  getOpenStaffScheduleException: vi.fn(() => null),
  getStaffAdminName: vi.fn((s: { full_name: string }) => s.full_name),
  buildReadinessResult: vi.fn((issues) => ({ issues, status: "ok" })),
}));

vi.mock("@/lib/queries/crm-context", () => ({
  getFrontDeskContext: mocks.getFrontDeskContext,
}));
vi.mock("@/lib/engine/slot-time", () => ({
  getBranchBusinessDate: mocks.getBranchBusinessDate,
}));
vi.mock("@/lib/queries/bookings", () => ({
  getTodaysSchedule: mocks.getTodaysSchedule,
  getCrmPendingBookingQueue: mocks.getCrmPendingBookingQueue,
  getCrmUpcomingBookings: mocks.getCrmUpcomingBookings,
  getCrmOrderServiceLines: mocks.getCrmOrderServiceLines,
}));
vi.mock("@/lib/queries/crm-today", () => ({
  getCrmTodaySnapshot: mocks.getCrmTodaySnapshot,
}));
vi.mock("@/lib/notifications/queries", () => ({
  getActionRequiredNotificationsAction: mocks.getActionRequiredNotificationsAction,
}));
vi.mock("@/lib/queries/crm-readiness", () => ({
  getCrmReadinessCached: mocks.getCrmReadinessCached,
}));
vi.mock("@/lib/actions/driver-actions", () => ({
  getBranchBookingDriverIds: mocks.getBranchBookingDriverIds,
  getDriverNamesByIds: mocks.getDriverNamesByIds,
}));
vi.mock("@/lib/actions/location-actions", () => ({
  getLatestLocationsForActiveHomeServiceTrips: mocks.getLatestLocationsForActiveHomeServiceTrips,
}));
vi.mock("@/lib/actions/tracking-link-actions", () => ({
  getActiveTrackingTokensForBookings: mocks.getActiveTrackingTokensForBookings,
}));
vi.mock("@/lib/bookings/ops-warnings", () => ({
  parseLiveEta: mocks.parseLiveEta,
}));
vi.mock("@/lib/bookings/upcoming-bookings", () => ({
  upcomingBookingEndDate: mocks.upcomingBookingEndDate,
}));
vi.mock("@/lib/bookings/staff-schedule-exception", () => ({
  getOpenStaffScheduleException: mocks.getOpenStaffScheduleException,
}));
vi.mock("@/lib/staff/display-name", () => ({
  getStaffAdminName: mocks.getStaffAdminName,
}));
vi.mock("@/types/readiness", () => ({
  buildReadinessResult: mocks.buildReadinessResult,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import {
  getCrmTodayOperationalData,
  type CrmTodayOperationalData,
} from "@/lib/queries/crm-today-operational";
import { refreshCrmTodayOperationalDataAction } from "@/app/(dashboard)/crm/today/actions";

describe("CRM Today canonical operational builder & server action", () => {
  it("derives branch strictly from server Front Desk context and ignores client-provided branch override", async () => {
    mocks.getFrontDeskContext.mockResolvedValue({
      userId: "user-123",
      role: "crm",
      branchId: "authoritative-branch-456",
      branchName: "Authoritative Branch",
    });
    mocks.getTodaysSchedule.mockResolvedValue([]);
    mocks.getCrmPendingBookingQueue.mockResolvedValue([]);
    mocks.getCrmUpcomingBookings.mockResolvedValue([]);
    mocks.getCrmTodaySnapshot.mockResolvedValue({ date: "2026-10-17", branchId: "authoritative-branch-456" });
    mocks.getActionRequiredNotificationsAction.mockResolvedValue([]);
    mocks.getCrmReadinessCached.mockResolvedValue(null);
    mocks.getBranchBookingDriverIds.mockResolvedValue({});
    mocks.getLatestLocationsForActiveHomeServiceTrips.mockResolvedValue({});
    mocks.getActiveTrackingTokensForBookings.mockResolvedValue({});
    mocks.getDriverNamesByIds.mockResolvedValue({});

    // Attempt to pass malicious browser branch override
    const result = await (
      refreshCrmTodayOperationalDataAction as unknown as (
        override: unknown
      ) => Promise<CrmTodayOperationalData>
    )({ branchId: "malicious-branch-999" });

    expect(mocks.getFrontDeskContext).toHaveBeenCalled();
    expect(mocks.getTodaysSchedule).toHaveBeenCalledWith("authoritative-branch-456", "2026-10-17");
    expect(mocks.getCrmTodaySnapshot).toHaveBeenCalledWith({
      branchId: "authoritative-branch-456",
      date: "2026-10-17",
    });
    expect(result).toBeDefined();
    expect(result.queueData).toEqual([]);
  });

  it("faithfully preserves booking fields, therapist provenance, driver/tracking, and order financial status", async () => {
    const rawBooking = {
      id: "b-1",
      order_id: "order-1",
      attendee_id: "att-1",
      booking_attendees: { id: "att-1", sequence: 1, display_name: "Guest 1", customer_id: "c-1" },
      booking_orders: { id: "order-1", order_number: "ORD-001", organizer_customer_id: "c-1", metadata: null },
      branch_id: "branch-a",
      booking_date: "2026-10-17",
      start_time: "14:00",
      end_time: "15:00",
      status: "confirmed",
      type: "home_service",
      delivery_type: "home_service",
      resource_id: "res-1",
      travel_buffer_mins: 30,
      payment_status: "paid",
      payment_method: "gcash",
      amount_paid: 1500,
      payment_reference: "REF-12345",
      booking_progress_status: "waiting",
      checked_in_at: null,
      session_started_at: null,
      session_due_at: null,
      session_completed_at: null,
      created_at: "2026-10-17T07:00:00Z",
      requested_staff_id: "staff-99",
      therapist_selection_source: "customer_selected",
      customers: { full_name: "Maria Santos", phone: "09181234567" },
      services: { name: "Signature Massage", duration_minutes: 60 },
      staff: { id: "staff-99", full_name: "Therapist Elena" },
      branch_resources: { name: "Van 1" },
      metadata: {
        price_paid: 1500,
        home_service_address: {
          full_address: "123 Coral St, Pasig",
          zone: "Zone 1",
          city: "Pasig",
          map_url: "https://maps.google.com/?q=123",
          lat: 14.58,
          lng: 121.06,
        },
        dispatch: {
          dispatch_warning: "Heavy traffic along Ortigas",
          needs_location_review: false,
          live_eta: "13:45",
        },
      },
    };

    mocks.getTodaysSchedule.mockResolvedValue([rawBooking]);
    mocks.getCrmPendingBookingQueue.mockResolvedValue([]);
    mocks.getCrmUpcomingBookings.mockResolvedValue([]);
    mocks.getCrmTodaySnapshot.mockResolvedValue({ date: "2026-10-17", branchId: "branch-a" });
    mocks.getActionRequiredNotificationsAction.mockResolvedValue([{ id: "notif-1", title: "Action Required" }]);
    mocks.getCrmReadinessCached.mockResolvedValue({ issues: [{ id: "iss-1", message: "Low towels" }], status: "warning" });
    mocks.getBranchBookingDriverIds.mockResolvedValue({ "b-1": "driver-1" });
    mocks.getDriverNamesByIds.mockResolvedValue({ "driver-1": "Kuya John" });
    mocks.getLatestLocationsForActiveHomeServiceTrips.mockResolvedValue({
      "b-1": { recorded_at: "2026-10-17T13:30:00Z" },
    });
    mocks.getActiveTrackingTokensForBookings.mockResolvedValue({
      "b-1": { token: "trk-token-abc", url: "https://track/abc", message: "Driver on the way" },
    });

    // Mock admin client queries for orders and resources
    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "v_booking_order_financial_summaries") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  order_id: "order-1",
                  total_payable: 1500,
                  net_allocated: 1500,
                  payment_state: "paid",
                },
              ],
              error: null,
            }),
          };
        }
        if (table === "booking_orders") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: "order-1", metadata: { total_amount: 1500 } }],
              error: null,
            }),
          };
        }
        if (table === "branch_resources") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: "res-1", name: "Van 1 Alpha" }],
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: [], error: null }) };
      }),
    };
    mocks.createAdminClient.mockReturnValue(mockAdmin);

    const data = await getCrmTodayOperationalData({ branchId: "branch-a", date: "2026-10-17" });

    expect(data.queueData).toHaveLength(1);
    const item = data.queueData[0]!;

    // Core booking & therapist provenance
    expect(item.id).toBe("b-1");
    expect(item.requested_staff_id).toBe("staff-99");
    expect(item.therapist_selection_source).toBe("customer_selected");
    expect(item.staff_name).toBe("Therapist Elena");
    expect(item.customer_name).toBe("Maria Santos");
    expect(item.customer_phone).toBe("09181234567");

    // Financial & order fields
    expect(item.order_payment_status).toBe("paid");
    expect(item.order_amount_paid).toBe(1500);
    expect(item.order_total_amount).toBe(1500);
    expect(item.price_paid).toBe(1500);

    // Driver & tracking links
    expect(item.driver_id).toBe("driver-1");
    expect(item.driver_name).toBe("Kuya John");
    expect(item.tracking_token).toBe("trk-token-abc");
    expect(item.tracking_url).toBe("https://track/abc");
    expect(item.last_location_at).toBe("2026-10-17T13:30:00Z");

    // Home service address & dispatch warnings
    expect(item.hs_address).toBe("123 Coral St, Pasig");
    expect(item.hs_zone).toBe("Zone 1");
    expect(item.dispatch_warning).toBe("Heavy traffic along Ortigas");
    expect(item.dest_lat).toBe(14.58);
    expect(item.dest_lng).toBe(121.06);

    // Resource name
    expect(item.resource_name).toBe("Van 1 Alpha");

    // Notifications & readiness
    expect(data.actionNotifications).toHaveLength(1);
    expect(data.actionNotifications[0]!.title).toBe("Action Required");
    expect(data.readinessIssues).toHaveLength(1);
    expect(data.readinessStatus).toBe("warning");
  });
});
