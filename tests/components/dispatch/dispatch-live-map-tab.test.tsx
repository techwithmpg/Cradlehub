/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ChannelStatusHandler = (status: string) => void;
type PostgresInsertHandler = (payload: { new: unknown }) => void;

const mocks = vi.hoisted(() => {
  const mapConstructors = vi.fn();
  const fitBoundsSpy = vi.fn();
  const markers: Array<{
    options: {
      map?: unknown;
      position: { lat: number; lng: number };
      title: string;
      icon?: string;
      label?: string;
      zIndex?: number;
      opacity?: number;
    };
    attached: boolean;
    clickHandlers: Array<() => void>;
    setMap: ReturnType<typeof vi.fn>;
  }> = [];
  const polylines: Array<{
    options: {
      map?: unknown;
      path: Array<{ lat: number; lng: number }>;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
    };
    attached: boolean;
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
    mapConstructors,
    fitBoundsSpy,
    markers,
    polylines,
    toastFn,
    getCrmDriverRouteAction,
    channel,
    removeChannel: vi.fn(),
    triggerStatus: (status: string) => statusHandler?.(status),
    triggerSnapshotInsert: (row: unknown) => snapshotInsertHandler?.({ new: row }),
    resetRealtime: () => {
      mapConstructors.mockClear();
      fitBoundsSpy.mockClear();
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
    fitBounds = mocks.fitBoundsSpy;
    setCenter = vi.fn();
    setZoom = vi.fn();
    constructor() {
      mocks.mapConstructors();
    }
  }
  class MockMarker {
    options: (typeof mocks.markers)[number]["options"];
    attached: boolean;
    clickHandlers: Array<() => void> = [];
    setMap = vi.fn((map: unknown) => {
      this.attached = map !== null;
    });
    addListener = vi.fn((event: string, fn: () => void) => {
      if (event === "click") this.clickHandlers.push(fn);
    });
    constructor(options: (typeof mocks.markers)[number]["options"]) {
      this.options = options;
      this.attached = Boolean(options.map);
      mocks.markers.push(this);
    }
  }
  class MockPolyline {
    options: (typeof mocks.polylines)[number]["options"];
    attached: boolean;
    setMap = vi.fn((map: unknown) => {
      this.attached = map !== null;
    });
    constructor(options: (typeof mocks.polylines)[number]["options"]) {
      this.options = options;
      this.attached = Boolean(options.map);
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
    startTime: "15:00:00",
    endTime: "16:40:00",
    durationMinutes: 100,
    customerName: "Dawn Navarro",
    serviceName: "Post Natal Massage",
    area: "Talisay",
    formattedAddress: "Talisay City",
    lat: 10.73,
    lng: 122.97,
    branchName: "Main Spa",
    branchLat: 10.6765,
    branchLng: 122.9509,
    needsLocationReview: false,
    driverId: "driver-b",
    driverName: "Driver B",
    therapistId: "therapist-1",
    therapistName: "Therapist Maria",
    dispatchStatus: "in_route",
    bookingStatus: "confirmed",
    bookingProgressStatus: "travel_started",
    paymentStatus: "paid",
    etaMinutes: 12,
    travelStartedAt: new Date(Date.now() - 300_000).toISOString(),
    arrivedAt: null,
    sessionStartedAt: null,
    sessionDueAt: null,
    sessionCompletedAt: null,
    sessionCompletionSource: null,
    completedAt: null,
    rating: null,
    currentLocation: {
      lat: 10.7,
      lng: 122.96,
      recorded_at: new Date(Date.now() - 20_000).toISOString(),
      accuracyMeters: 12,
      staffId: "driver-b",
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

describe("Redesigned Map-First CRM Live Map UI & Interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetRealtime();
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY = "test-browser-key";
    installGoogleMapsMock();
    mocks.getCrmDriverRouteAction.mockImplementation(async (args: { driverId: string }) => ({
      ok: true,
      driverId: args.driverId,
      routeKey: `${args.driverId}=>route`,
      durationMinutes: 12,
      distanceMeters: 3400,
      encodedPolyline: "_p~iF~ps|U_ulLnnqC",
      estimatedArrivalIso: new Date(Date.now() + 12 * 60_000).toISOString(),
      basis: "routes_api",
      computedAt: new Date().toISOString(),
      stopCount: 1,
    }));
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

  it("Scenarios 1-10: floating trip rail, collapse/expand, horizontal filters, route highlighting & dismissible details panel without remounting map", async () => {
    const trip1 = makeItem({
      id: "b-1",
      number: "#001",
      customerName: "Dawn Navarro",
      driverId: "driver-b",
      driverName: "Driver B",
      bookingStatus: "in_progress",
      bookingProgressStatus: "session_started",
      sessionStartedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      sessionDueAt: new Date(Date.now() + 136 * 60_000).toISOString(),
    });
    const trip2 = makeItem({
      id: "b-2",
      number: "#002",
      customerName: "Dario Barba",
      serviceName: "Swedish Massage",
      area: "Bacolod",
      driverId: "driver-a",
      driverName: "Driver A",
      bookingStatus: "confirmed",
      bookingProgressStatus: "travel_started",
      lat: 10.69,
      lng: 122.98,
      currentLocation: {
        lat: 10.68,
        lng: 122.95,
        recorded_at: new Date(Date.now() - 20_000).toISOString(),
        staffId: "driver-a",
      },
    });
    // Shared second booking on Driver A -> must NOT duplicate Driver A vehicle marker
    const trip3 = makeItem({
      id: "b-3",
      number: "#003",
      customerName: "Malcom Patem",
      area: "Mandalagan",
      driverId: "driver-a",
      driverName: "Driver A",
      bookingStatus: "confirmed",
      bookingProgressStatus: "arrived",
      arrivedAt: new Date(Date.now() - 120_000).toISOString(),
      lat: 10.695,
      lng: 122.985,
    });

    render(<DispatchLiveMapTab data={makeData([trip1, trip2, trip3])} branchId="branch-a" />);

    // Shared map mounted once cleanly, details closed by default until trip clicked
    await waitFor(() => expect(mocks.mapConstructors).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("selected-driver-details")).toBeNull();
    expect(screen.getByText("Trips (3)")).toBeTruthy();
    expect(screen.getByText("Live Tracking: 2 Drivers (2 live GPS)")).toBeTruthy();

    // Horizontal filters reflect exact dynamic counts
    expect(screen.getByRole("button", { name: "All (3)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "En Route (1)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "In Service (1)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Arrived (1)" })).toBeTruthy();

    // Shared Driver A appears ONCE among active driver vehicle markers (3 destination pins + 2 physical driver markers = 5)
    const driverAMarkers = mocks.markers.filter(
      (m) => m.attached && m.options.title.startsWith("Driver A")
    );
    expect(driverAMarkers).toHaveLength(1);

    await waitFor(() => expect(mocks.getCrmDriverRouteAction).toHaveBeenCalledTimes(2));

    // Clicking trip #002 selects it, highlights Driver A's route & dims Driver B's route, opens right details panel
    fireEvent.click(screen.getByTestId("trip-card-b-2"));
    expect(screen.getByTestId("selected-driver-details")).toBeTruthy();
    expect(screen.getByTestId("selected-driver-details").textContent).toContain("Dario Barba");
    expect(screen.getByTestId("selected-driver-details").textContent).toContain(
      "Shared Driver Vehicle (2 assigned stops)"
    );

    const highlighted = mocks.polylines.filter((p) => p.attached && p.options.strokeWeight === 6);
    const secondary = mocks.polylines.filter((p) => p.attached && p.options.strokeWeight === 2.5);
    expect(highlighted).toHaveLength(1);
    expect(secondary).toHaveLength(1);

    // Switching selection to #001 swaps route highlight & details WITHOUT remounting Google Maps
    fireEvent.click(screen.getByTestId("trip-card-b-1"));
    expect(screen.getByTestId("selected-driver-details").textContent).toContain("Dawn Navarro");
    expect(screen.getByTestId("selected-driver-details").textContent).toContain("Service Ends In");
    expect(mocks.mapConstructors).toHaveBeenCalledTimes(1);

    // Closing details panel preserves highlighted trip route and offers quick "Show Details" button
    fireEvent.click(screen.getByRole("button", { name: "Close journey details" }));
    expect(screen.queryByTestId("selected-driver-details")).toBeNull();
    expect(screen.getByRole("button", { name: "Open journey details" })).toBeTruthy();
    expect(mocks.polylines.filter((p) => p.attached && p.options.strokeWeight === 6)).toHaveLength(1);

    // Collapsing & expanding left rail preserves map mount & filters cleanly
    fireEvent.click(screen.getByRole("button", { name: "Collapse trip list" }));
    expect(screen.queryByTestId("trip-card-b-1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand trip list" }));
    expect(screen.getByTestId("trip-card-b-1")).toBeTruthy();

    // Filtering narrows list cleanly; Search filters by customer
    fireEvent.click(screen.getByRole("button", { name: "En Route (1)" }));
    expect(screen.getByText("Trips (1 of 3)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "All (3)" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle trip search" }));
    fireEvent.change(screen.getByLabelText("Search trips"), { target: { value: "Dawn" } });
    expect(screen.getByText("Trips (1 of 3)")).toBeTruthy();
  });

  it("Scenarios 11-16: preserves selection across live GPS snapshots, suppresses duplicate arrival popups & distinguishes stale GPS", async () => {
    const staleTrip = makeItem({
      id: "b-stale",
      number: "#002",
      customerName: "Stale Client",
      driverId: "driver-stale",
      driverName: "Driver Slow",
      currentLocation: {
        lat: 10.71,
        lng: 122.97,
        recorded_at: new Date(Date.now() - 25 * 60_000).toISOString(),
        staffId: "driver-stale",
      },
    });
    const activeTrip = makeItem({ id: "b-live", number: "#001", driverId: "driver-b", driverName: "Driver B" });
    const onRefresh = vi.fn();

    const { rerender } = render(
      <DispatchLiveMapTab data={makeData([activeTrip, staleTrip])} branchId="branch-a" onRefresh={onRefresh} />
    );

    await waitFor(() => expect(mocks.mapConstructors).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Stale · 25m ago/)).toBeTruthy();

    // Select activeTrip -> stays selected when realtime GPS moves Driver B, without refitting bounds
    fireEvent.click(screen.getByTestId("trip-card-b-live"));
    const fitsAfterSelection = mocks.fitBoundsSpy.mock.calls.length;
    expect(fitsAfterSelection).toBeGreaterThanOrEqual(1);

    act(() => {
      mocks.triggerSnapshotInsert({
        branch_id: "branch-a",
        staff_id: "driver-b",
        booking_id: "b-live",
        lat: 10.725,
        lng: 122.968,
        accuracy_meters: 8,
        recorded_at: new Date(Date.now() + 2_000).toISOString(),
      });
    });

    await waitFor(() => {
      expect(
        mocks.markers.some(
          (m) => m.attached && m.options.title.startsWith("Driver B") && m.options.position.lat === 10.725
        )
      ).toBe(true);
    });
    expect(screen.getByTestId("selected-driver-details").textContent).toContain("Dawn Navarro");
    expect(mocks.fitBoundsSpy).toHaveBeenCalledTimes(fitsAfterSelection);

    // Authoritative arrival transition -> ONE toast + ONE bottom-left arrival alert, no duplicate on replay
    const arrivedAt = new Date().toISOString();
    rerender(
      <DispatchLiveMapTab
        data={makeData([makeItem({ ...activeTrip, bookingProgressStatus: "arrived", arrivedAt }), staleTrip])}
        branchId="branch-a"
        onRefresh={onRefresh}
      />
    );

    expect(mocks.toastFn).toHaveBeenCalledTimes(1);
    expect(mocks.toastFn).toHaveBeenCalledWith(
      "Driver arrived at customer location",
      expect.objectContaining({ description: expect.stringContaining("Dawn Navarro") })
    );
    const arrivalAlert = await waitFor(() =>
      screen.getByRole("status", { name: "Latest driver arrival notification" })
    );
    expect(arrivalAlert.textContent).toContain("Driver arrived at customer location");

    // Replayed identical arrived state after reconnect does not repeat toast
    act(() => mocks.triggerStatus("CHANNEL_ERROR"));
    act(() => mocks.triggerStatus("SUBSCRIBED"));
    expect(onRefresh).toHaveBeenCalled();

    rerender(
      <DispatchLiveMapTab
        data={makeData([makeItem({ ...activeTrip, bookingProgressStatus: "arrived", arrivedAt }), staleTrip])}
        branchId="branch-a"
        onRefresh={onRefresh}
      />
    );
    expect(mocks.toastFn).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Close arrival alert" }));
    expect(screen.queryByRole("status", { name: "Latest driver arrival notification" })).toBeNull();
  });

  it("Scenarios 17-18: distinguishes approved independent departure from undecided collection & exposes CRM booking links", async () => {
    const independentTrip = makeItem({
      id: "b-indep",
      number: "#004",
      customerName: "Elena Cruz",
      bookingStatus: "in_progress",
      bookingProgressStatus: "session_started",
      sessionStartedAt: new Date(Date.now() - 100 * 60_000).toISOString(),
      sessionCompletedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      sessionCompletionSource: "staff_portal",
      collectionRequirement: {
        decision: "not_required",
        approvedBy: "Dispatcher Maya",
        approvedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
        source: "schedule",
      },
    });
    const undecidedTrip = makeItem({
      id: "b-undecided",
      number: "#005",
      customerName: "Marco Diaz",
      driverId: "driver-a",
      driverName: "Driver A",
      bookingStatus: "in_progress",
      bookingProgressStatus: "session_started",
      sessionStartedAt: new Date(Date.now() - 100 * 60_000).toISOString(),
      sessionCompletedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      sessionCompletionSource: "staff_portal",
      collectionRequirement: {
        decision: "not_required",
        conflictingApproval: true,
      },
    });

    render(<DispatchLiveMapTab data={makeData([independentTrip, undecidedTrip])} branchId="branch-a" />);
    await waitFor(() => expect(mocks.mapConstructors).toHaveBeenCalledTimes(1));

    // Approved independent departure must not claim unresolved collection
    fireEvent.click(screen.getByTestId("trip-card-b-indep"));
    const indepPanel = screen.getByTestId("selected-driver-details");
    expect(indepPanel.textContent).toContain("Independent Departure Approved");
    expect(indepPanel.textContent).toContain("Skipped — independent departure approved");
    const routeLink = screen.getByRole("link", { name: /Open Customer Route/ });
    expect(routeLink.getAttribute("href")).toContain("https://www.google.com/maps/dir/");
    const bookingLink = screen.getByRole("link", { name: /View \/ Edit Booking/ });
    expect(bookingLink.getAttribute("href")).toBe("/crm/bookings?bookingId=b-indep");

    // Conflicting approval must stay unresolved and clearly surface CRM decision needed
    fireEvent.click(screen.getByTestId("trip-card-b-undecided"));
    const undecidedPanel = screen.getByTestId("selected-driver-details");
    expect(undecidedPanel.textContent).toContain("Collection Decision Needed");
    expect(undecidedPanel.textContent).toContain("Collection undecided — resolve conflicting approval");
  });
});
