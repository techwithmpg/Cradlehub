// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DriverFocusedTripRoute } from "@/components/features/staff-pwa/driver/driver-focused-trip-route";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

const mocks = vi.hoisted(() => ({ progress: vi.fn() }));
vi.mock("@/app/(dashboard)/staff-portal/actions", () => ({
  updateBookingProgressAction: mocks.progress,
}));

function trip(overrides: Partial<RealDispatchItem> = {}): RealDispatchItem {
  return {
    id: "9dc25a6e-d10b-4ab5-9a1c-1da1e1da96cf",
    number: "#001",
    bookingDate: "2026-11-10",
    startTime: "16:00:00",
    endTime: "17:00:00",
    customerName: "Assigned test trip",
    serviceName: "Home Service Massage",
    area: "Bacolod",
    formattedAddress: "Central Market, Bacolod",
    lat: 10.676,
    lng: 122.956,
    branchName: "SM Branch",
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
    paymentStatus: "unpaid",
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

describe("Driver one-action trip screen", () => {
  it("shows only Start Trip for a confirmed, GPS-verified assignment", () => {
    render(<DriverFocusedTripRoute job={trip()} verifiedDestination />);
    expect(screen.getByRole("button", { name: "Start Trip" })).toBeTruthy();
    expect(screen.getByText("Central Market, Bacolod")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /mark arrived|complete service|scan/i })).toBeNull();
  });

  it("does not offer a Start Trip mutation without CRM-verified GPS", () => {
    render(<DriverFocusedTripRoute job={trip()} verifiedDestination={false} />);
    expect(screen.queryByRole("button", { name: "Start Trip" })).toBeNull();
    expect(screen.getByText(/CRM must verify this destination/i)).toBeTruthy();
    expect(mocks.progress).not.toHaveBeenCalled();
  });

  it("offers Resume Navigation for travel already authorized by the server", () => {
    render(<DriverFocusedTripRoute job={trip({
      dispatchStatus: "in_route",
      bookingProgressStatus: "travel_started",
    })} verifiedDestination />);
    expect(screen.getByRole("button", { name: "Resume Navigation" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start Trip" })).toBeNull();
  });

  it("does not offer travel action on arrived, cancelled or completed trips", () => {
    for (const item of [
      trip({ bookingProgressStatus: "arrived", dispatchStatus: "arrived_at_customer" }),
      trip({ bookingStatus: "cancelled" }),
      trip({ bookingStatus: "completed", bookingProgressStatus: "completed" }),
    ]) {
      const mounted = render(<DriverFocusedTripRoute job={item} verifiedDestination />);
      expect(screen.queryByRole("button", { name: /Start Trip|Resume Navigation/ })).toBeNull();
      mounted.unmount();
    }
  });

  it("calls only the existing authorized Start Trip action, no arrival writer", () => {
    // Keep the operation unresolved: navigation must await a server result.
    mocks.progress.mockImplementation(() => new Promise(() => {}));
    render(<DriverFocusedTripRoute job={trip()} verifiedDestination />);
    fireEvent.click(screen.getByRole("button", { name: "Start Trip" }));
    expect(mocks.progress).toHaveBeenCalledWith({
      bookingId: "9dc25a6e-d10b-4ab5-9a1c-1da1e1da96cf",
      nextStatus: "travel_started",
    });
    expect(mocks.progress).toHaveBeenCalledTimes(1);
  });
});
