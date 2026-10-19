import { describe, expect, it } from "vitest";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";
import { getDriverPrimaryTrip } from "@/lib/staff-pwa/driver-ui-model";

function trip(id: string, dispatchStatus: RealDispatchItem["dispatchStatus"], startTime: string): RealDispatchItem {
  return {
    id,
    dispatchStatus,
    bookingDate: "2026-10-19",
    startTime,
  } as RealDispatchItem;
}

describe("driver multi-run primary trip selection", () => {
  it("shows the next ready pickup instead of a previous therapist's ongoing service", () => {
    const selected = getDriverPrimaryTrip([
      trip("first-dropoff", "arrived_at_customer", "14:00:00"),
      trip("therapist-still-working", "service_started", "15:00:00"),
      trip("next-departure", "ready", "17:00:00"),
    ]);
    expect(selected?.id).toBe("next-departure");
  });

  it("keeps an actually travelling run in focus before upcoming work", () => {
    const selected = getDriverPrimaryTrip([
      trip("future", "ready", "18:00:00"),
      trip("en-route", "in_route", "16:00:00"),
    ]);
    expect(selected?.id).toBe("en-route");
  });

  it("does not erase previous drop-offs from the driver's list", () => {
    const selected = getDriverPrimaryTrip([
      trip("arrived", "arrived_at_customer", "14:00:00"),
    ]);
    expect(selected?.id).toBe("arrived");
  });
});
