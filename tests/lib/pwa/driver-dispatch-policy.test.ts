import { describe, expect, it } from "vitest";
import {
  appointmentWarnings, isNavigableDriverTrip, isValidDriverDestination,
  orderDriverStops, MAX_DRIVER_ROUTE_STOPS,
} from "@/lib/staff-pwa/driver-dispatch-policy";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

function job(id: string, startTime = "16:00:00", overrides: Partial<RealDispatchItem> = {}): RealDispatchItem {
  return {
    id, number: id, bookingDate: "2026-11-10", startTime, endTime: "17:00:00",
    customerName: id, serviceName: "Massage", area: "Bacolod", formattedAddress: "Bacolod",
    lat: 10.66, lng: 122.95, branchName: "Main", branchLat: 10.67, branchLng: 122.96,
    needsLocationReview: false, driverId: "driver-1", driverName: null, therapistId: "staff-1",
    therapistName: null, dispatchStatus: "ready", bookingStatus: "confirmed",
    bookingProgressStatus: "not_started", paymentStatus: "unpaid", etaMinutes: null,
    travelStartedAt: null, arrivedAt: null, sessionStartedAt: null, completedAt: null, rating: null,
    currentLocation: null, ...overrides,
  };
}
const at = Date.parse("2026-11-10T14:00:00+08:00");

describe("driver combined-route policy", () => {
  it("uses shortest driving-time next, not input order", () => {
    const stops = [job("far"), job("near"), job("mid")];
    const matrix = [
      { originIndex: 0, destinationIndex: 0, seconds: 2000 },
      { originIndex: 0, destinationIndex: 1, seconds: 120 },
      { originIndex: 0, destinationIndex: 2, seconds: 800 },
      { originIndex: 2, destinationIndex: 0, seconds: 1000 },
      { originIndex: 2, destinationIndex: 2, seconds: 80 },
    ];
    expect(orderDriverStops(stops, matrix, at).ordered.map(x => x.id)).toEqual(["near", "mid", "far"]);
  });
  it("keeps an already-started trip as the first stop", () => {
    const stops = [
      job("new", "16:00:00"), job("active", "16:00:00", { bookingProgressStatus: "travel_started" }),
    ];
    const matrix = [
      { originIndex: 0, destinationIndex: 0, seconds: 60 },
      { originIndex: 0, destinationIndex: 1, seconds: 600 },
    ];
    expect(orderDriverStops(stops, matrix, at).ordered[0]?.id).toBe("active");
  });
  it("protects imminent appointment timing over closeness", () => {
    const stops = [job("urgent", "14:05:00"), job("near", "17:00:00")];
    const matrix = [
      { originIndex: 0, destinationIndex: 0, seconds: 400 },
      { originIndex: 0, destinationIndex: 1, seconds: 60 },
    ];
    expect(orderDriverStops(stops, matrix, at).ordered[0]?.id).toBe("urgent");
  });
  it("uses chronological fallback and labels it when road durations fail", () => {
    const result = orderDriverStops([job("later", "17:00:00"), job("first", "15:00:00")], [], at);
    expect(result.basis).toBe("schedule_fallback");
    expect(result.ordered.map(x=>x.id)).toEqual(["first","later"]);
  });
  it("never navigates cancelled, arrived or unverified-coordinate bookings", () => {
    expect(isNavigableDriverTrip(job("cancelled", "15:00:00", {bookingStatus:"cancelled"}))).toBe(false);
    expect(isNavigableDriverTrip(job("arrived", "15:00:00", {bookingProgressStatus:"arrived"}))).toBe(false);
    expect(isValidDriverDestination(job("unverified", "15:00:00", {needsLocationReview:true}))).toBe(false);
    expect(orderDriverStops([job("a"),job("b", "16:00:00", {needsLocationReview:true})], [], at).ordered).toHaveLength(1);
  });
  it("caps API billing, leaves the excess for later and flags overlapping booked times", () => {
    const stops = Array.from({length: MAX_DRIVER_ROUTE_STOPS + 4}, (_, i) => job(`job-${i}`, "15:00:00"));
    const result = orderDriverStops(stops, [], at);
    expect(result.ordered).toHaveLength(MAX_DRIVER_ROUTE_STOPS);
    expect(appointmentWarnings([job("first","15:00:00"), job("second","16:00:00")]).length).toBe(1);
  });
});
