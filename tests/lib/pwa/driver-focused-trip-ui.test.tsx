// @vitest-environment jsdom
import React from "react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

const calls = vi.hoisted(() => ({
  progress: vi.fn(),
  location: vi.fn(),
  route: vi.fn(),
}));
vi.mock("@/app/(dashboard)/staff-portal/actions", () => ({
  updateBookingProgressAction: calls.progress,
}));
vi.mock("@/app/(dashboard)/staff/driver/map/live-location-action", () => ({
  recordAssignedDriverLiveLocationAction: calls.location,
}));
vi.mock("@/app/(dashboard)/staff/driver/routes/actions", () => ({
  getAssignedDriverRouteAction: calls.route,
}));
vi.mock("@/components/features/staff-pwa/safe-memory", () => ({
  invalidateStaffSafeMemory: vi.fn(),
}));
vi.mock("@vis.gl/react-google-maps", () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Map: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Marker: () => null,
  useMap: () => null,
  useMapsLibrary: () => null,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/staff/driver/map" }));

import { DriverFocusedTripRoute } from "@/components/features/staff-pwa/driver/driver-focused-trip-route";
import { getDriverBottomNavItems } from "@/components/features/staff-portal/driver/driver-mobile-bottom-nav";

const trip = (changes: Partial<RealDispatchItem> = {}): RealDispatchItem => ({
  id: "11111111-1111-4111-8111-111111111111",
  number: "#001",
  bookingDate: "2026-11-10",
  startTime: "16:00:00",
  endTime: "17:00:00",
  customerName: "Test Customer",
  serviceName: "Sports Massage",
  area: "Central Market, Bacolod",
  formattedAddress: "Central Market, Bacolod",
  lat: 10.676,
  lng: 122.956,
  branchName: "Main Branch",
  branchLat: null,
  branchLng: null,
  needsLocationReview: false,
  driverId: "assigned-driver",
  driverName: "Driver",
  therapistId: "provider",
  therapistName: "Therapist",
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
  ...changes,
});

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("Driver focused trip UI (review only)", () => {
  it("loads one assigned destination and offers only Start Trip as the main trip mutation", () => {
    render(<DriverFocusedTripRoute job={trip()} />);
    expect(screen.getByText("Test Customer")).toBeTruthy();
    expect(screen.getByText("Central Market, Bacolod")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Start Trip/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Mark arrived/i })).toBeNull();
    expect(calls.progress).not.toHaveBeenCalled();
  });

  it("never marks travel started if the server rejects the action", async () => {
    calls.progress.mockResolvedValue({ ok: false, message: "Trip reassigned." });
    render(<DriverFocusedTripRoute job={trip()} />);
    fireEvent.click(screen.getByRole("button", { name: /Start Trip/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Trip reassigned."));
    expect(calls.progress).toHaveBeenCalledExactlyOnceWith({
      bookingId: trip().id, nextStatus: "travel_started",
    });
  });

  it("does not allow starting a trip with unverified customer coordinates", () => {
    render(<DriverFocusedTripRoute job={trip({ needsLocationReview: true })} />);
    expect((screen.getByRole("button", { name: /Start Trip/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(calls.progress).not.toHaveBeenCalled();
  });

  it("shows Resume navigation for an en-route booking, not another Start", () => {
    render(<DriverFocusedTripRoute job={trip({
      bookingProgressStatus: "travel_started", dispatchStatus: "in_route",
    })} />);
    expect(screen.getByRole("button", { name: /Resume navigation/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Start Trip/i })).toBeNull();
  });

  it("shows authoritative recorded arrival without completing the provider's service", () => {
    render(<DriverFocusedTripRoute job={trip({
      bookingProgressStatus: "arrived", dispatchStatus: "arrived_at_customer",
    })} />);
    expect(screen.getByText(/Arrival recorded in CradleHub/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Start Trip/i })).toBeNull();
  });

  it("limits canonical Driver tabs to trips, moving attendance to More", () => {
    expect(getDriverBottomNavItems("canonical").map(item => item.label))
      .toEqual(["Today", "Trips", "More"]);
    expect(getDriverBottomNavItems("driver").map(item => item.label))
      .toContain("Scan");
    const more = readFileSync("src/app/(dashboard)/staff/driver/more/page.tsx", "utf8");
    expect(more).toContain("Scan attendance QR");
    expect(more).toContain("/staff/attendance");
  });

  it("allows USB localhost only in an explicit debug build, never release", () => {
    const gradle = readFileSync("native/driver-android/app/build.gradle.kts", "utf8");
    const shell = readFileSync(
      "native/driver-android/app/src/main/java/com/mpgtechnologies/cradlehub/driver/DriverShellActivity.java", "utf8"
    );
    const manifest = readFileSync(
      "native/driver-android/app/src/debug/AndroidManifest.xml", "utf8"
    );
    const network = readFileSync(
      "native/driver-android/app/src/debug/res/xml/driver_debug_network_security.xml", "utf8"
    );
    expect(gradle).toContain("CRADLE_DRIVER_DEBUG_ORIGIN");
    expect(gradle).toContain("http://localhost:7100");
    expect(gradle).toContain("getByName(\"release\")");
    expect(gradle).toContain("buildConfigField(\"String\", \"DRIVER_WEB_ORIGIN\",");
    expect(shell).toContain("BuildConfig.DRIVER_WEB_ORIGIN");
    expect(shell).toContain("expected.getHost().equals(url.getHost())");
    expect(manifest).toContain("@xml/driver_debug_network_security");
    expect(network).toContain("<domain>localhost</domain>");
    expect(network).toContain('<base-config cleartextTrafficPermitted="false"');
  });

  it("native shell has no competing button, and native arrival does not write booking state", () => {
    const shell = readFileSync(
      "native/driver-android/app/src/main/java/com/mpgtechnologies/cradlehub/driver/DriverShellActivity.java", "utf8"
    );
    const nativeRoute = readFileSync(
      "native/driver-android/app/src/main/java/com/mpgtechnologies/cradlehub/driver/NativeNavigationActivity.java", "utf8"
    );
    const layout = readFileSync(
      "native/driver-android/app/src/main/res/layout/activity_driver_shell.xml", "utf8"
    );
    expect(shell).toContain("maybeLaunchNavigation");
    expect(shell).toContain("onNewIntent");
    expect(shell).toContain("BOOKING_ID.matcher(id).matches()");
    expect(layout).not.toContain("openNativeNavigation");
    expect(nativeRoute).toContain("navigator.stopGuidance()");
    expect(nativeRoute).not.toContain("nextStatus");
  });
});
