import { describe, it, expect } from "vitest";
import {
  journeySchema,
  nextJourneyAction,
  validArrivalPoint,
  type DriverJourney,
} from "@/lib/driver/journey";
const j = (stage: DriverJourney["stage"]): DriverJourney => ({
  bookingId: "11111111-1111-4111-8111-111111111111",
  revision: 3,
  stage,
  leg: "collection",
  destination: { lat: 10, lng: 120, label: "TEST" },
  observedAt: "2026-11-17T00:00:00Z",
});
describe("unified transport boundaries", () => {
  it.each(["pickup_arrived", "collection_arrived"] as const)(
    "GPS arrival at %s still requires boarding",
    (stage) => expect(nextJourneyAction(j(stage))?.action).toBe("board")
  );
  it.each(["service_active", "customer_arrived", "complete", "review"] as const)(
    "%s cannot start a new transport leg",
    (stage) => expect(nextJourneyAction(j(stage))).toBeNull()
  );
  it("starts only a known destination", () =>
    expect(nextJourneyAction({ ...j("pickup_pending"), destination: null })).toBeNull());
  it("requires explicit branch drop-off", () =>
    expect(nextJourneyAction(j("return_arrived"))?.action).toBe("finish_return"));
  const now = Date.parse("2026-11-17T00:00:00Z"),
    point = { lat: 10, lng: 120, accuracyMeters: 10, observedAt: new Date(now).toISOString() };
  it("accepts fresh accurate evidence at the verified point", () =>
    expect(validArrivalPoint(point, { lat: 10, lng: 120 }, now)).toBe(true));
  it.each([
    { accuracyMeters: 51 },
    { accuracyMeters: 0 },
    { observedAt: "2026-11-16T23:59:00Z" },
    { observedAt: "2026-11-17T00:00:30Z" },
    { lat: 11 },
  ])("rejects insufficient location evidence: %s", (override) =>
    expect(validArrivalPoint({ ...point, ...override }, { lat: 10, lng: 120 }, now)).toBe(false)
  );
  it("rejects malformed server snapshots", () =>
    expect(journeySchema.safeParse({ ...j("pickup_pending"), revision: -1 }).success).toBe(false));
});

it("rejects a valid stage paired with the wrong leg", () =>
  expect(journeySchema.safeParse(j("pickup_enroute")).success).toBe(false));
