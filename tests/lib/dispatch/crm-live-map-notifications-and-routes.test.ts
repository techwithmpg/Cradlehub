import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getAttendanceActionContext: vi.fn(),
  getDispatchData: vi.fn(),
  computeDrivingRouteWithPolyline: vi.fn(),
  isGoogleMapsEnabled: vi.fn(),
  createNotificationOnce: vi.fn(),
  resolveNotificationsForEntity: vi.fn(),
}));

vi.mock("@/lib/attendance/queries", () => ({
  getAttendanceActionContext: mocks.getAttendanceActionContext,
}));

vi.mock("@/lib/queries/dispatch-queries", () => ({
  getDispatchData: mocks.getDispatchData,
}));

vi.mock("@/lib/maps/google-maps", () => ({
  computeDrivingRouteWithPolyline: mocks.computeDrivingRouteWithPolyline,
  isGoogleMapsEnabled: mocks.isGoogleMapsEnabled,
}));

vi.mock("@/lib/notifications/create", () => ({
  createNotificationOnce: mocks.createNotificationOnce,
  resolveNotificationsForEntity: mocks.resolveNotificationsForEntity,
}));

import { getCrmDriverRouteAction } from "@/lib/actions/dispatch-live-map-actions";
import { publishCrmDriverArrivalNotification } from "@/lib/notifications/driver-arrival-notifications";
import { getNotificationDisplay } from "@/components/features/notifications/notification-display";
import { ArrivalDeduplicationStore, type ArrivalValidationContext } from "@/lib/dispatch/arrival-events";
import {
  decodeEncodedPolyline,
  shouldRecomputeDriverRoute,
  type RouteCacheEntry,
} from "@/lib/dispatch/route-eta";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";
import type { WorkspaceNotification } from "@/lib/notifications/types";

const BRANCH_ID = "11111111-1111-4111-8111-111111111111";
const DRIVER_ID = "22222222-2222-4222-8222-222222222222";
const BOOKING_ID = "33333333-3333-4333-8333-333333333333";

function dispatchItem(overrides: Partial<RealDispatchItem> = {}): RealDispatchItem {
  return {
    id: BOOKING_ID,
    branchId: BRANCH_ID,
    number: "#001",
    bookingDate: "2026-11-17",
    startTime: "14:00:00",
    endTime: "15:00:00",
    durationMinutes: 60,
    customerName: "Customer A",
    serviceName: "Home Massage",
    area: "Makati",
    formattedAddress: "Makati City",
    lat: 14.5547,
    lng: 121.0244,
    branchName: "Main Spa",
    branchLat: 14.5995,
    branchLng: 120.9842,
    needsLocationReview: false,
    driverId: DRIVER_ID,
    driverName: "Carlos Driver",
    therapistId: "therapist-1",
    therapistName: "Maria",
    dispatchStatus: "in_route",
    bookingStatus: "confirmed",
    bookingProgressStatus: "travel_started",
    paymentStatus: "paid",
    etaMinutes: 12,
    travelStartedAt: "2026-11-17T05:50:00Z",
    arrivedAt: null,
    sessionStartedAt: null,
    completedAt: null,
    rating: null,
    currentLocation: {
      lat: 14.58,
      lng: 121.0,
      recorded_at: "2026-11-17T05:59:00Z",
    },
    ...overrides,
  };
}

describe("O2 CRM Routes, ETA Caching, Arrival Notification Security & Deduplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isGoogleMapsEnabled.mockReturnValue(true);
    mocks.createNotificationOnce.mockResolvedValue(undefined);
  });

  it("Scenario 4: decodes polyline, computes multi-stop Google Route & throttles unnecessary recomputation", async () => {
    // Known Google Encoded Polyline sample "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
    const points = decodeEncodedPolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(points).toHaveLength(3);
    expect(points[0]!.lat).toBeCloseTo(38.5, 4);
    expect(points[0]!.lng).toBeCloseTo(-120.2, 4);

    mocks.getAttendanceActionContext.mockResolvedValue({
      role: "crm",
      branchId: BRANCH_ID,
      staffId: "crm-1",
    });
    mocks.getDispatchData.mockResolvedValue({
      today: "2026-11-17",
      items: [
        dispatchItem({ id: "b-1", lat: 14.56, lng: 121.01 }),
        dispatchItem({ id: "b-2", startTime: "15:00:00", lat: 14.55, lng: 121.02 }),
      ],
      alerts: [],
      stats: { totalToday: 2, awaitingDispatch: 0, activeTrips: 2, completedToday: 0, cancelledToday: 0 },
    });
    mocks.computeDrivingRouteWithPolyline.mockResolvedValue({
      durationMinutes: 18,
      distanceMeters: 5200,
      encodedPolyline: "_p~iF~ps|U_ulLnnqC",
    });

    const res = await getCrmDriverRouteAction({
      date: "2026-11-17",
      driverId: DRIVER_ID,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.basis).toBe("routes_api");
      expect(res.durationMinutes).toBe(18);
      expect(res.distanceMeters).toBe(5200);
      expect(res.stopCount).toBe(2);
    }
    expect(mocks.computeDrivingRouteWithPolyline).toHaveBeenCalledWith(
      expect.objectContaining({
        originLat: 14.58,
        originLng: 121.0,
        intermediates: [{ lat: 14.56, lng: 121.01 }],
        destinationLat: 14.55,
        destinationLng: 121.02,
      })
    );

    const nowMs = Date.now();
    const prevCache: RouteCacheEntry = {
      routeKey: res.ok ? res.routeKey : "",
      origin: { lat: 14.58, lng: 121.0 },
      computedAtMs: nowMs - 10_000,
      durationMinutes: 18,
      distanceMeters: 5200,
      encodedPolyline: "_p~iF~ps|U_ulLnnqC",
      estimatedArrivalIso: null,
      basis: "routes_api",
    };

    // Tiny GPS jitter (<250m and <30s) must NOT trigger recomputation
    expect(
      shouldRecomputeDriverRoute(
        prevCache,
        { routeKey: prevCache.routeKey, origin: { lat: 14.5803, lng: 121.0002 } },
        nowMs
      )
    ).toBe(false);

    // Significant movement (>=250m after >=30s) or stop reassignment MUST recompute
    expect(
      shouldRecomputeDriverRoute(
        prevCache,
        { routeKey: prevCache.routeKey, origin: { lat: 14.575, lng: 121.005 } },
        nowMs + 35_000
      )
    ).toBe(true);
    expect(
      shouldRecomputeDriverRoute(
        prevCache,
        { routeKey: "different-route-key", origin: { lat: 14.58, lng: 121.0 } },
        nowMs
      )
    ).toBe(true);
  });

  it("Scenarios 7, 8, 9 & 10: pickup, customer & collection arrivals notify once and dedupe replays", async () => {
    const context: ArrivalValidationContext = {
      expectedBranchId: BRANCH_ID,
      bookingsById: new Map([
        [
          BOOKING_ID,
          {
            id: BOOKING_ID,
            branchId: BRANCH_ID,
            driverId: DRIVER_ID,
            bookingStatus: "confirmed",
            bookingProgressStatus: "travel_started",
          },
        ],
      ]),
      nowMs: Date.parse("2026-11-17T06:00:00Z"),
    };

    const store = new ArrivalDeduplicationStore();

    const pickup = store.accept(
      {
        eventId: "ev-pickup",
        kind: "pickup_arrival",
        source: "synthetic_test_event",
        authorizedByServer: true,
        branchId: BRANCH_ID,
        driverId: DRIVER_ID,
        driverName: "Carlos",
        bookingId: BOOKING_ID,
        stopId: "pickup-main",
        destinationLabel: "Main Branch",
        therapistNames: ["Maria"],
        accuracyMeters: 15,
        observedAt: "2026-11-17T05:45:00Z",
        revision: 1,
      },
      context
    );
    expect(pickup.accepted).toBe(true);
    if (pickup.accepted) {
      expect(pickup.shouldNotify).toBe(true);
      expect(pickup.record.copy.title).toBe("Arrived at pickup");
      expect(pickup.record.copy.body).toContain("Main Branch");
    }

    // Replayed duplicate event (different eventId but same semantic key) produces zero repeat popup
    const pickupReplay = store.accept(
      {
        eventId: "ev-pickup-replayed-2",
        kind: "pickup_arrival",
        source: "synthetic_test_event",
        authorizedByServer: true,
        branchId: BRANCH_ID,
        driverId: DRIVER_ID,
        driverName: "Carlos",
        bookingId: BOOKING_ID,
        stopId: "pickup-main",
        destinationLabel: "Main Branch",
        therapistNames: ["Maria"],
        accuracyMeters: 15,
        observedAt: "2026-11-17T05:45:01Z",
        revision: 1,
      },
      context
    );
    expect(pickupReplay.accepted).toBe(true);
    if (pickupReplay.accepted) {
      expect(pickupReplay.duplicate).toBe(true);
      expect(pickupReplay.shouldNotify).toBe(false);
    }

    const customerPub = await publishCrmDriverArrivalNotification(
      {
        eventId: "ev-customer",
        kind: "customer_arrival",
        source: "server_journey_transition",
        authorizedByServer: true,
        branchId: BRANCH_ID,
        driverId: DRIVER_ID,
        driverName: "Carlos",
        bookingId: BOOKING_ID,
        destinationLabel: "Makati Ave",
        customerName: "Customer A",
        therapistNames: ["Maria"],
        accuracyMeters: 12,
        observedAt: "2026-11-17T05:55:00Z",
        revision: 2,
      },
      context
    );
    expect(customerPub.published).toBe(true);
    expect(mocks.createNotificationOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        targetWorkspace: "crm",
        title: "Arrived at customer",
        type: "booking_status_changed",
        actionHref: `/crm/dispatch?bookingId=${BOOKING_ID}&view=map`,
      })
    );

    const collection = store.accept(
      {
        eventId: "ev-collection",
        kind: "collection_arrival",
        source: "server_journey_transition",
        authorizedByServer: true,
        branchId: BRANCH_ID,
        driverId: DRIVER_ID,
        driverName: "Carlos",
        bookingId: BOOKING_ID,
        stopId: "collect-1",
        destinationLabel: "Makati Ave",
        therapistNames: ["Maria"],
        accuracyMeters: 10,
        observedAt: "2026-11-17T05:59:00Z",
        revision: 4,
      },
      context
    );
    expect(collection.accepted).toBe(true);
    if (collection.accepted) {
      expect(collection.record.copy.title).toBe("Arrived for collection");
    }

    // Existing notification display renders driver arrival metadata cleanly
    const rendered = getNotificationDisplay({
      id: "notif-1",
      branch_id: BRANCH_ID,
      target_workspace: "crm",
      target_role: null,
      recipient_staff_id: null,
      actor_staff_id: DRIVER_ID,
      type: "booking_status_changed",
      title: "Arrived at customer",
      body: "Driver Carlos arrived at Customer A's location with Maria.",
      entity_type: "booking",
      entity_id: BOOKING_ID,
      action_href: `/crm/dispatch?bookingId=${BOOKING_ID}&view=map`,
      priority: "high",
      status: "unread",
      requires_action: true,
      read_at: null,
      resolved_at: null,
      dedupe_key: "driver_arrival:k",
      metadata: { driver_arrival_kind: "customer_arrival", driver_name: "Carlos" },
      created_at: "2026-11-17T05:55:00Z",
    } as WorkspaceNotification);
    expect(rendered.title).toBe("Arrived at customer");
    expect(rendered.actionLabel).toBe("View Live Map");
  });

  it("Scenario 19: rejects unauthorized users, cross-branch payloads & untrusted client GPS arrivals", async () => {
    mocks.getAttendanceActionContext.mockResolvedValue({
      role: "therapist",
      branchId: BRANCH_ID,
      staffId: "therapist-1",
    });

    const unauthorizedRoute = await getCrmDriverRouteAction({
      date: "2026-11-17",
      driverId: DRIVER_ID,
    });
    expect(unauthorizedRoute.ok).toBe(false);
    if (!unauthorizedRoute.ok) expect(unauthorizedRoute.code).toBe("UNAUTHORIZED");
    expect(mocks.getDispatchData).not.toHaveBeenCalled();

    const ctx: ArrivalValidationContext = {
      expectedBranchId: BRANCH_ID,
      bookingsById: new Map([
        [
          BOOKING_ID,
          {
            id: BOOKING_ID,
            branchId: BRANCH_ID,
            driverId: DRIVER_ID,
            bookingStatus: "confirmed",
            bookingProgressStatus: "travel_started",
          },
        ],
      ]),
    };

    // Untrusted client_gps source MUST NOT publish arrival notifications
    const forged = await publishCrmDriverArrivalNotification(
      {
        eventId: "forged-1",
        kind: "customer_arrival",
        source: "client_gps",
        authorizedByServer: false,
        branchId: BRANCH_ID,
        driverId: DRIVER_ID,
        driverName: "Carlos",
        bookingId: BOOKING_ID,
        destinationLabel: "Makati",
        therapistNames: ["Maria"],
        observedAt: new Date().toISOString(),
      },
      ctx
    );
    expect(forged.published).toBe(false);
    expect(forged.reason).toBe("untrusted_source");
    expect(mocks.createNotificationOnce).not.toHaveBeenCalled();

    // Cross-branch arrival event rejected
    const crossBranch = await publishCrmDriverArrivalNotification(
      {
        eventId: "other-branch-1",
        kind: "customer_arrival",
        source: "server_journey_transition",
        authorizedByServer: true,
        branchId: "99999999-9999-4999-8999-999999999999",
        driverId: DRIVER_ID,
        driverName: "Carlos",
        bookingId: BOOKING_ID,
        destinationLabel: "Other Branch",
        therapistNames: ["Maria"],
        observedAt: new Date().toISOString(),
      },
      ctx
    );
    expect(crossBranch.published).toBe(false);
    expect(crossBranch.reason).toBe("branch_mismatch");
  });
});
