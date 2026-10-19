import { describe, expect, it } from "vitest";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";
import { buildDriverRoutePageViewModel } from "@/components/features/staff-portal/driver/map/driver-route-view-model";

function trip(id: string, status: RealDispatchItem["dispatchStatus"], startTime: string): RealDispatchItem {
  return {
    id,
    bookingDate: "2026-10-19",
    startTime,
    endTime: "22:00:00",
    customerName: "Test Customer",
    serviceName: "Massage",
    formattedAddress: "Bacolod City",
    area: "Bacolod City",
    lat: null,
    lng: null,
    branchLat: null,
    branchLng: null,
    needsLocationReview: false,
    dispatchStatus: status,
    bookingProgressStatus: status === "in_route" ? "travel_started" : "not_started",
    eta: null,
    currentLocation: null,
  } as RealDispatchItem;
}

const options = { detailsBasePath: "/staff/driver/trips", today: new Date("2026-10-19T12:00:00Z") };

describe("driver PWA automatic route queue", () => {
  it("prioritizes an actively travelling journey", () => {
    const model = buildDriverRoutePageViewModel([
      trip("ready", "ready", "18:00:00"),
      trip("driving", "in_route", "17:00:00"),
    ], options);
    expect(model.nextStop?.id).toBe("driving");
  });

  it("advances to a queued job after the last driver run reaches the customer", () => {
    const model = buildDriverRoutePageViewModel([
      trip("dropped-off", "arrived_at_customer", "14:00:00"),
      trip("massage-still-running", "service_started", "15:00:00"),
      trip("next-run", "ready", "16:00:00"),
    ], options);
    expect(model.nextStop?.id).toBe("next-run");
    expect(model.stops).toHaveLength(3); // no booking-history deletion
  });

  it("can focus any other open assigned stop for manual route choice", () => {
    const model = buildDriverRoutePageViewModel([
      trip("first", "ready", "15:00:00"),
      trip("second", "ready", "17:00:00"),
    ], { ...options, preferredStopId: "second" });
    expect(model.nextStop?.id).toBe("second");
  });

  it("will not show an unassigned, missing, or completed manual selection", () => {
    const model = buildDriverRoutePageViewModel([
      trip("closed", "completed", "15:00:00"),
      trip("open", "ready", "17:00:00"),
    ], { ...options, preferredStopId: "closed" });
    expect(model.nextStop?.id).toBe("open");
    const missing = buildDriverRoutePageViewModel([
      trip("open", "ready", "17:00:00"),
    ], { ...options, preferredStopId: "some-other-driver-booking" });
    expect(missing.nextStop?.id).toBe("open");
  });

  it("selects no active route after all assigned jobs complete", () => {
    const model = buildDriverRoutePageViewModel([
      trip("done", "completed", "15:00:00"),
    ], options);
    expect(model.nextStop).toBeNull();
  });
});
