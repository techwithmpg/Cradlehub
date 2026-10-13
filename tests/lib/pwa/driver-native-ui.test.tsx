// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DriverNativeDetail } from "@/components/features/staff-pwa/driver/driver-native-detail";
import { DriverNativeMap } from "@/components/features/staff-pwa/driver/driver-native-map";
import {
  getDriverNavigationUrl,
  getDriverPrimaryTrip,
  getDriverTripSummary,
  getNextDriverAction,
} from "@/lib/staff-pwa/driver-ui-model";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

const mocks = vi.hoisted(() => ({ action: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/app/(dashboard)/staff-portal/actions", () => ({
  updateBookingProgressAction: mocks.action,
}));

function trip(overrides: Partial<RealDispatchItem> = {}): RealDispatchItem {
  return {
    id: "booking-1",
    number: "#001",
    bookingDate: "2026-10-12",
    startTime: "10:00:00",
    endTime: "11:00:00",
    customerName: "Customer A",
    serviceName: "Home Service Massage",
    area: "Makati",
    formattedAddress: "Main Street, Makati",
    lat: null,
    lng: null,
    branchName: "Main Branch",
    branchLat: null,
    branchLng: null,
    needsLocationReview: false,
    driverId: "driver-1",
    driverName: "Driver A",
    therapistId: "provider-1",
    therapistName: "Provider A",
    dispatchStatus: "ready",
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
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("Driver native presentation", () => {
  it("chooses active work and counts only real assigned trips", () => {
    const ready = trip();
    const active = trip({
      id: "booking-2",
      dispatchStatus: "in_route",
      bookingProgressStatus: "travel_started",
    });
    const done = trip({
      id: "booking-3",
      dispatchStatus: "completed",
      bookingStatus: "completed",
      bookingProgressStatus: "completed",
    });
    expect(getDriverPrimaryTrip([ready, active, done])?.id).toBe("booking-2");
    expect(getDriverTripSummary([ready, active, done])).toEqual({
      today: 3,
      completed: 1,
      remaining: 2,
    });
  });

  it("offers only the two Driver-owned transitions", () => {
    expect(getNextDriverAction(trip())?.nextStatus).toBe("travel_started");
    expect(getNextDriverAction(trip({ bookingProgressStatus: "travel_started" }))?.nextStatus).toBe(
      "arrived"
    );
    expect(getNextDriverAction(trip({ bookingProgressStatus: "arrived" }))).toBeNull();
    expect(getNextDriverAction(trip({ bookingStatus: "completed" }))).toBeNull();
  });

  it("uses the recorded destination for external directions", () => {
    expect(getDriverNavigationUrl(trip())).toContain("destination=Main%20Street%2C%20Makati");
    expect(
      getDriverNavigationUrl(trip({ formattedAddress: null, lat: null, lng: null }))
    ).toBeNull();
  });

  it("confirms arrival through the existing server action and does not offer service completion", async () => {
    mocks.action.mockResolvedValue({
      ok: true,
      status: "arrived",
      timestamp: "2026-10-12T10:00:00Z",
    });
    render(
      <DriverNativeDetail
        job={trip({ dispatchStatus: "in_route", bookingProgressStatus: "travel_started" })}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark arrived" }));
    await waitFor(() => expect(screen.getByText("Arrival confirmed.")).toBeTruthy());
    expect(mocks.action).toHaveBeenCalledWith({ bookingId: "booking-1", nextStatus: "arrived" });
    expect(screen.queryByRole("button", { name: /complete service/i })).toBeNull();
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("states the map limitation and offers external directions", () => {
    render(<DriverNativeMap items={[trip()]} businessDate="2026-10-12" />);
    expect(screen.getByText(/Route geometry is unavailable here/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Trip details" }).getAttribute("href")).toBe(
      "/staff/driver/trips/booking-1"
    );
  });
});
