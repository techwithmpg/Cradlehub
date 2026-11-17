import { describe, expect, it } from "vitest";
import { buildLiveMapDriversViewModel } from "@/lib/dispatch/crm-live-map-model";
import { buildLiveMapTripsViewModel } from "@/lib/dispatch/trip-presentation";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";
import type { DispatchJourney } from "@/lib/driver/dispatch";

const NOW = Date.parse("2026-11-17T06:00:00Z");

function booking(overrides: Partial<RealDispatchItem> = {}): RealDispatchItem {
  return {
    id: "b-1",
    branchId: "branch-a",
    number: "#001",
    bookingDate: "2026-11-17",
    startTime: "14:00:00",
    endTime: "15:00:00",
    durationMinutes: 60,
    customerName: "Dawn Navarro",
    serviceName: "Post Natal Massage",
    area: "Talisay",
    formattedAddress: "Talisay",
    lat: 10.73,
    lng: 122.97,
    branchName: "Main Spa",
    branchLat: 10.67,
    branchLng: 122.95,
    needsLocationReview: false,
    driverId: "driver-b",
    driverName: "Driver B",
    therapistId: "t-1",
    therapistName: "Therapist Dawn",
    dispatchStatus: "in_route",
    bookingStatus: "confirmed",
    bookingProgressStatus: "travel_started",
    paymentStatus: "paid",
    etaMinutes: 12,
    travelStartedAt: "2026-11-17T05:50:00Z",
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
      recorded_at: "2026-11-17T05:59:30Z",
      staffId: "driver-b",
    },
    ...overrides,
  };
}

describe("Live Map Trip Presentation & Filter Model", () => {
  it("computes accurate dynamic stage counts across active bookings without fabricating timestamps", () => {
    const items: RealDispatchItem[] = [
      booking({ id: "b-in-service", number: "#001", bookingStatus: "in_progress", bookingProgressStatus: "session_started", sessionStartedAt: "2026-11-17T05:30:00Z", sessionDueAt: "2026-11-17T07:00:00Z" }),
      booking({ id: "b-enroute", number: "#002", driverId: "driver-a", driverName: "Driver A", bookingProgressStatus: "travel_started", travelStartedAt: "2026-11-17T05:55:00Z" }),
      booking({ id: "b-arrived", number: "#003", driverId: "driver-a", driverName: "Driver A", bookingProgressStatus: "arrived", arrivedAt: "2026-11-17T05:58:00Z" }),
      booking({ id: "b-dispatched", number: "#004", driverId: "driver-d", driverName: "Driver D", bookingProgressStatus: "not_started", travelStartedAt: null }),
      booking({ id: "b-cancelled", number: "#999", bookingStatus: "cancelled" }),
    ];

    const journeys: DispatchJourney[] = [
      {
        journey: {
          bookingId: "b-dispatched",
          revision: 1,
          stage: "pickup_enroute",
          leg: "pickup",
          destination: { lat: 10.67, lng: 122.95, label: "Main Branch" },
          observedAt: "2026-11-17T05:45:00Z",
        },
        driverName: "Driver D",
        location: null,
      },
    ];

    const driversVm = buildLiveMapDriversViewModel({ items, transportJourneys: journeys, nowMs: NOW });
    const { trips, counts } = buildLiveMapTripsViewModel({
      items,
      transportJourneys: journeys,
      drivers: driversVm.drivers,
      nowMs: NOW,
    });

    expect(trips).toHaveLength(4);
    expect(counts.all).toBe(4);
    expect(counts.in_service).toBe(1);
    expect(counts.en_route).toBe(1);
    expect(counts.arrived).toBe(1);
    expect(counts.pickup).toBe(1);

    // En-route trip without arrival/service must NOT manufacture arrival or completion timestamps
    const enRouteTrip = trips.find((t) => t.bookingId === "b-enroute")!;
    const arrivedStep = enRouteTrip.timeline.find((s) => s.key === "arrived")!;
    const completedStep = enRouteTrip.timeline.find((s) => s.key === "completed")!;
    expect(arrivedStep.timestampIso).toBeNull();
    expect(completedStep.timestampIso).toBeNull();

    // Shared driver count on Driver A equals 2 (b-enroute + b-arrived)
    expect(enRouteTrip.sharedDriverTripCount).toBe(2);
    expect(driversVm.drivers.filter((d) => d.driverId === "driver-a")).toHaveLength(1);
  });

  it("handles conditional collection: approved independent departure vs unresolved requirement", () => {
    const approved = booking({
      id: "b-indep",
      number: "#010",
      bookingStatus: "completed",
      bookingProgressStatus: "completed",
      sessionCompletedAt: "2026-11-17T05:50:00Z",
      sessionCompletionSource: "staff_manual",
      collectionRequirement: {
        decision: "not_required",
        source: "schedule",
        approvedBy: "manager-1",
        approvedAt: "2026-11-17T04:00:00Z",
      },
    });
    const undecided = booking({
      id: "b-undecided",
      number: "#011",
      bookingStatus: "completed",
      bookingProgressStatus: "completed",
      sessionCompletedAt: "2026-11-17T05:52:00Z",
      sessionCompletionSource: "staff_manual",
      collectionRequirement: { decision: "undecided" },
    });

    const driversVm = buildLiveMapDriversViewModel({ items: [approved, undecided], nowMs: NOW });
    const { trips, counts } = buildLiveMapTripsViewModel({
      items: [approved, undecided],
      drivers: driversVm.drivers,
      nowMs: NOW,
    });

    const indepTrip = trips.find((t) => t.bookingId === "b-indep")!;
    expect(indepTrip.stageKey).toBe("completed");
    expect(indepTrip.miniSteps.find((s) => s.key === "collection")?.state).toBe("skipped");
    expect(indepTrip.miniSteps.find((s) => s.key === "returning")?.state).toBe("skipped");

    const undecidedTrip = trips.find((t) => t.bookingId === "b-undecided")!;
    expect(undecidedTrip.stageKey).toBe("collection");
    expect(undecidedTrip.collection.requiresResolution).toBe(true);
    expect(counts.collection).toBe(1);
  });
});
