// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  browserLocationFailureResult,
  freshAttendanceLocation,
  needsLocationExplanation,
} from "@/lib/attendance/browser-location";

describe("attendance browser location", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("explains first-time permission and identifies denial", async () => {
    vi.stubGlobal("navigator", {
      permissions: { query: vi.fn().mockResolvedValue({ state: "prompt" }) },
    });
    expect(await needsLocationExplanation()).toBe("explain");
    vi.stubGlobal("navigator", {
      permissions: { query: vi.fn().mockResolvedValue({ state: "denied" }) },
    });
    expect(await needsLocationExplanation()).toBe("denied");
    expect(browserLocationFailureResult("location_permission_denied").message).toBe(
      "Location access is required for attendance. Please enable location permission for CradleHub and try again."
    );
  });

  it("requests a new high-accuracy reading for a scan", async () => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    const getCurrentPosition = vi.fn((success: PositionCallback) =>
      success({
        coords: { latitude: 10.7024485, longitude: 122.9619465, accuracy: 10 },
        timestamp: 123,
      } as GeolocationPosition)
    );
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    expect(await freshAttendanceLocation()).toMatchObject({ accuracy: 10, timestamp: 123 });
    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15_000,
    });
  });
});
