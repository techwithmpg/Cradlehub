/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ChannelStatusHandler = (status: string) => void;
type PostgresInsertHandler = (payload: { new: unknown }) => void;

const mocks = vi.hoisted(() => {
  const markers: Array<{
    options: { position: { lat: number; lng: number }; title: string; icon?: string; label?: string };
    setMap: ReturnType<typeof vi.fn>;
    addListener: ReturnType<typeof vi.fn>;
  }> = [];
  const polylines: Array<{
    options: { path: Array<{ lat: number; lng: number }>; strokeColor?: string };
    setMap: ReturnType<typeof vi.fn>;
  }> = [];
  const toastFn = vi.fn();
  const getCrmDriverRouteAction = vi.fn();

  let statusHandler: ChannelStatusHandler | null = null;
  let snapshotInsertHandler: PostgresInsertHandler | null = null;
  const channel = {
    on: vi.fn((_type: string, _filter: unknown, handler: PostgresInsertHandler) => {
      snapshotInsertHandler = handler;
      return channel;
    }),
    subscribe: vi.fn((cb: ChannelStatusHandler) => {
      statusHandler = cb;
      cb("SUBSCRIBED");
      return channel;
    }),
  };

  return {
    markers,
    polylines,
    toastFn,
    getCrmDriverRouteAction,
    channel,
    removeChannel: vi.fn(),
    triggerStatus: (status: string) => statusHandler?.(status),
    triggerSnapshotInsert: (row: unknown) => snapshotInsertHandler?.({ new: row }),
    resetRealtime: () => {
      statusHandler = null;
      snapshotInsertHandler = null;
      markers.length = 0;
      polylines.length = 0;
    },
  };
});

vi.mock("sonner", () => ({
  toast: mocks.toastFn,
}));

vi.mock("@/lib/actions/dispatch-live-map-actions", () => ({
  getCrmDriverRouteAction: mocks.getCrmDriverRouteAction,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: vi.fn(() => mocks.channel),
    removeChannel: mocks.removeChannel,
  }),
}));

import { DispatchLiveMapTab } from "@/components/features/dispatch/dispatch-live-map-tab";
import type { DispatchData, RealDispatchItem } from "@/lib/queries/dispatch-queries";

function installGoogleMapsMock() {
  class MockMap {
    fitBounds = vi.fn();
    setCenter = vi.fn();
    setZoom = vi.fn();
  }
  class MockMarker {
    options: (typeof mocks.markers)[number]["options"];
    setMap = vi.fn();
    addListener = vi.fn();
    constructor(options: (typeof mocks.markers)[number]["options"]) {
      this.options = options;
      mocks.markers.push(this);
    }
  }
  class MockPolyline {
    options: (typeof mocks.polylines)[number]["options"];
    setMap = vi.fn();
    constructor(options: (typeof mocks.polylines)[number]["options"]) {
      this.options = options;
      mocks.polylines.push(this);
    }
  }
  class MockInfoWindow {
    open = vi.fn();
  }
  class MockLatLngBounds {
    extend = vi.fn();
  }

  Object.defineProperty(window, "google", {
    configurable: true,
    writable: true,
    value: {
      maps: {
        Map: MockMap,
        Marker: MockMarker,
        Polyline: MockPolyline,
        InfoWindow: MockInfoWindow,
        LatLngBounds: MockLatLngBounds,
      },
    },
  });
}

function makeItem(overrides: Partial<RealDispatchItem> = {}): RealDispatchItem {
  return {
    id: "booking-1",
    branchId: "branch-a",
    number: "#001",
    bookingDate: "2026-11-17",
    startTime: "14:00:00",
    endTime: "15:00:00",
    durationMinutes: 60,
    customerName: "Alice Santos",
    serviceName: "Home Relaxation",
    area: "BGC",
    formattedAddress: "BGC Taguig",
    lat: 14.551,
    lng: 121.05,
    branchName: "Main Spa",
    branchLat: 14.5995,
    branchLng: 120.9842,
    needsLocationReview: false,
    driverId: "driver-1",
    driverName: "Carlos",
    therapistId: "therapist-1",
    therapistName: "Therapist Maria",
    dispatchStatus: "in_route",
    bookingStatus: "confirmed",
    bookingProgressStatus: "travel_started",
    paymentStatus: "paid",
    etaMinutes: 11,
    eta: {
      minutes: 11,
      source: "stored_routes_api",
      calculatedAt: new Date(Date.now() - 20_000).toISOString(),
      origin: "driver_location",
    },
    travelStartedAt: new Date(Date.now() - 300_000).toISOString(),
    arrivedAt: null,
    sessionStartedAt: null,
    sessionDueAt: null,
    sessionCompletedAt: null,
    sessionCompletionSource: null,
    completedAt: null,
    rating: null,
    currentLocation: {
      lat: 14.575,
      lng: 121.02,
      recorded_at: new Date(Date.now() - 20_000).toISOString(),
      accuracyMeters: 12,
      staffId: "driver-1",
    },
    ...overrides,
  };
}

function makeData(items: RealDispatchItem[]): DispatchData {
  return {
    today: "2026-11-17",
    items,
    alerts: [],
    stats: {
      totalToday: items.length,
      awaitingDispatch: 0,
      activeTrips: items.length,
      completedToday: 0,
      cancelledToday: 0,
    },
  };
}

describe("DispatchLiveMapTab O2 UI & Realtime Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetRealtime();
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY = "test-browser-key";
    installGoogleMapsMock();
    mocks.getCrmDriverRouteAction.mockResolvedValue({
      ok: true,
      driverId: "driver-1",
      routeKey: "k1",
      durationMinutes: 11,
      distanceMeters: 3400,
      encodedPolyline: "_p~iF~ps|U_ulLnnqC",
      estimatedArrivalIso: new Date(Date.now() + 11 * 60_000).toISOString(),
      basis: "routes_api",
      computedAt: new Date().toISOString(),
      stopCount: 1,
    });
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, "google", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  });

  it("renders multiple drivers, route polyline, ETA, stale GPS warning & selected details", async () => {
    const staleDriver = makeItem({
      id: "booking-2",
      number: "#002",
      driverId: "driver-2",
      driverName: "Elena",
      customerName: "Bob Cruz",
      therapistName: "Therapist Joy",
      currentLocation: {
        lat: 14.61,
        lng: 121.04,
        recorded_at: new Date(Date.now() - 25 * 60_000).toISOString(),
        accuracyMeters: 10,
        staffId: "driver-2",
      },
    });
    const data = makeData([makeItem(), staleDriver]);

    render(<DispatchLiveMapTab data={data} branchId="branch-a" />);

    expect(screen.getByText("Active Drivers (2)")).toBeTruthy();
    expect(screen.getAllByText("Carlos").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Elena")).toBeTruthy();
    expect(screen.getByText(/Stale · 25m ago/)).toBeTruthy();

    await waitFor(() => expect(mocks.getCrmDriverRouteAction).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByTestId("selected-driver-details").textContent).toContain("3.4 km");
    });

    // Vehicle markers & Google Maps Polyline rendered cleanly
    expect(mocks.markers.some((m) => m.options.title.includes("Carlos"))).toBe(true);
    expect(mocks.markers.some((m) => m.options.title.includes("Elena"))).toBe(true);
    expect(mocks.polylines.length).toBeGreaterThanOrEqual(1);
  });

  it("Scenario 2, 8, 10 & 11: live snapshot moves driver marker; arrival notifies once; reconnect restores without duplicate popup", async () => {
    const onRefresh = vi.fn();
    const initial = makeData([makeItem()]);
    const { rerender } = render(
      <DispatchLiveMapTab data={initial} branchId="branch-a" onRefresh={onRefresh} />
    );

    // Realtime snapshot INSERT moves driver-1 marker to new coordinates
    act(() => {
      mocks.triggerSnapshotInsert({
        branch_id: "branch-a",
        staff_id: "driver-1",
        booking_id: "booking-1",
        lat: 14.56234,
        lng: 121.03891,
        accuracy_meters: 9,
        recorded_at: new Date(Date.now() + 1_000).toISOString(),
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("selected-driver-details").textContent).toContain("14.56234");
    });

    // Simulate realtime disconnect -> reconnect triggers authoritative server reconciliation
    act(() => mocks.triggerStatus("CHANNEL_ERROR"));
    expect(screen.getByText(/Realtime connection interrupted/i)).toBeTruthy();
    act(() => mocks.triggerStatus("SUBSCRIBED"));
    expect(onRefresh).toHaveBeenCalled();

    // Server refresh brings authoritative arrived transition -> notifies ONCE
    const arrivedTime = new Date().toISOString();
    const arrivedData = makeData([
      makeItem({ bookingProgressStatus: "arrived", arrivedAt: arrivedTime }),
    ]);
    rerender(<DispatchLiveMapTab data={arrivedData} branchId="branch-a" onRefresh={onRefresh} />);

    expect(mocks.toastFn).toHaveBeenCalledTimes(1);
    expect(mocks.toastFn).toHaveBeenCalledWith(
      "Arrived at customer",
      expect.objectContaining({
        description: expect.stringContaining("Alice Santos"),
      })
    );

    // Another refresh with the same arrived state (e.g. reconnect) MUST NOT repeat popup
    rerender(<DispatchLiveMapTab data={makeData([makeItem({ bookingProgressStatus: "arrived", arrivedAt: arrivedTime })])} branchId="branch-a" onRefresh={onRefresh} />);
    expect(mocks.toastFn).toHaveBeenCalledTimes(1);
  });

  it("Scenario 6 & 16: cancelled booking disappears; therapist completion updates CRM", () => {
    const initial = makeData([
      makeItem({
        bookingStatus: "in_progress",
        bookingProgressStatus: "session_started",
        sessionStartedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
        sessionDueAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      }),
      makeItem({ id: "b-cancel", number: "#009", bookingStatus: "cancelled", driverId: "driver-9", driverName: "Ghost" }),
    ]);

    const { rerender } = render(<DispatchLiveMapTab data={initial} branchId="branch-a" />);
    expect(screen.queryByText("Ghost")).toBeNull();
    expect(screen.getAllByText("Ending soon").length).toBeGreaterThanOrEqual(1);

    // Search filter narrows down and Reset clears cleanly
    const searchInput = screen.getByPlaceholderText(/Search driver/i);
    fireEvent.change(searchInput, { target: { value: "Nobody" } });
    expect(screen.getByText("No matching active drivers or home-service bookings.")).toBeTruthy();
    fireEvent.change(searchInput, { target: { value: "" } });

    // Therapist completes service with required collection
    const completed = makeData([
      makeItem({
        bookingStatus: "completed",
        bookingProgressStatus: "completed",
        sessionCompletedAt: new Date().toISOString(),
        sessionCompletionSource: "staff_manual",
        collectionRequirement: { decision: "required", source: "schedule" },
      }),
    ]);
    rerender(<DispatchLiveMapTab data={completed} branchId="branch-a" />);
    expect(screen.getAllByText("Ready for collection").length).toBeGreaterThanOrEqual(1);
  });

  it("Scenario 5, 7 & 9: reassignment triggers new route; pickup and collection arrivals notify once each", async () => {
    mocks.getCrmDriverRouteAction.mockResolvedValue({
      ok: true,
      driverId: "driver-1",
      routeKey: "driver-1=>booking-1:customer_dropoff:14.55100,121.05000",
      durationMinutes: 10,
      distanceMeters: 2500,
      encodedPolyline: "_p~iF~ps|U_ulLnnqC",
      estimatedArrivalIso: new Date(Date.now() + 10 * 60_000).toISOString(),
      basis: "routes_api",
      computedAt: new Date().toISOString(),
      stopCount: 1,
    });

    const pickupItem = makeItem({
      bookingProgressStatus: "not_started",
      dispatchStatus: "ready",
    });
    const initialWithJourney: DispatchData = {
      ...makeData([pickupItem]),
      transportJourneys: [
        {
          journey: {
            bookingId: "booking-1",
            revision: 1,
            stage: "pickup_enroute",
            leg: "pickup",
            destination: { lat: 14.5995, lng: 120.9842, label: "Main Branch" },
            observedAt: new Date().toISOString(),
            therapistName: "Therapist Maria",
            customerName: "Alice Santos",
            pickupLabel: "Main Branch",
          },
          driverName: "Carlos",
          location: { lat: 14.585, lng: 121.0, recordedAt: new Date().toISOString() },
        },
      ],
    };

    const { rerender } = render(<DispatchLiveMapTab data={initialWithJourney} branchId="branch-a" />);
    await waitFor(() =>
      expect(mocks.getCrmDriverRouteAction).toHaveBeenCalledWith(
        expect.objectContaining({ driverId: "driver-1" })
      )
    );

    // Pickup arrival transition emits one CRM notification
    rerender(
      <DispatchLiveMapTab
        data={{
          ...initialWithJourney,
          transportJourneys: [
            {
              ...initialWithJourney.transportJourneys![0]!,
              journey: {
                ...initialWithJourney.transportJourneys![0]!.journey,
                revision: 2,
                stage: "pickup_arrived",
              },
            },
          ],
        }}
        branchId="branch-a"
      />
    );
    expect(mocks.toastFn).toHaveBeenCalledWith(
      "Arrived at pickup",
      expect.objectContaining({ description: expect.stringContaining("Main Branch") })
    );

    // Driver reassignment updates route request to new driver
    mocks.getCrmDriverRouteAction.mockResolvedValueOnce({
      ok: true,
      driverId: "driver-2",
      routeKey: "driver-2=>booking-1:customer_dropoff:14.55100,121.05000",
      durationMinutes: 14,
      distanceMeters: 4100,
      encodedPolyline: "_p~iF~ps|U_ulLnnqC",
      estimatedArrivalIso: new Date(Date.now() + 14 * 60_000).toISOString(),
      basis: "routes_api",
      computedAt: new Date().toISOString(),
      stopCount: 1,
    });
    const reassignedBooking = makeItem({
      driverId: "driver-2",
      driverName: "Elena",
      bookingProgressStatus: "completed",
      sessionCompletedAt: new Date().toISOString(),
      sessionCompletionSource: "staff_manual",
      collectionRequirement: { decision: "required", source: "schedule" },
      currentLocation: {
        lat: 14.57,
        lng: 121.03,
        recorded_at: new Date().toISOString(),
      },
    });
    rerender(
      <DispatchLiveMapTab
        data={{
          ...makeData([reassignedBooking]),
          transportJourneys: [
            {
              journey: {
                bookingId: "booking-1",
                revision: 3,
                stage: "collection_enroute",
                leg: "collection",
                destination: { lat: 14.551, lng: 121.05, label: "BGC" },
                observedAt: new Date().toISOString(),
                therapistName: "Therapist Maria",
                customerName: "Alice Santos",
              },
              driverName: "Elena",
              location: { lat: 14.57, lng: 121.03, recordedAt: new Date().toISOString() },
            },
          ],
        }}
        branchId="branch-a"
      />
    );

    await waitFor(() =>
      expect(mocks.getCrmDriverRouteAction).toHaveBeenCalledWith(
        expect.objectContaining({ driverId: "driver-2" })
      )
    );

    // Collection arrival emits one CRM notification
    rerender(
      <DispatchLiveMapTab
        data={{
          ...makeData([reassignedBooking]),
          transportJourneys: [
            {
              journey: {
                bookingId: "booking-1",
                revision: 4,
                stage: "collection_arrived",
                leg: "collection",
                destination: { lat: 14.551, lng: 121.05, label: "BGC" },
                observedAt: new Date().toISOString(),
                therapistName: "Therapist Maria",
                customerName: "Alice Santos",
              },
              driverName: "Elena",
              location: { lat: 14.551, lng: 121.05, recordedAt: new Date().toISOString() },
            },
          ],
        }}
        branchId="branch-a"
      />
    );
    expect(mocks.toastFn).toHaveBeenCalledWith(
      "Arrived for collection",
      expect.objectContaining({ description: expect.stringContaining("Therapist Maria") })
    );
  });
});
