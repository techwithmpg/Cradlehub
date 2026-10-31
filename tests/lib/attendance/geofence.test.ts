import { describe, expect, it } from "vitest";
import {
  distanceMeters,
  validateAttendanceLocation,
  type AttendanceLocation,
} from "@/lib/attendance/geofence";

const MAIN = "c1000000-0000-0000-0000-000000000001";
const SM = "c1000000-0000-0000-0000-000000000002";
const now = 1_800_000_000_000;
const mainLocation: AttendanceLocation = {
  latitude: 10.7024485,
  longitude: 122.9619465,
  accuracy: 10,
  timestamp: now,
};
const smLocation: AttendanceLocation = {
  latitude: 10.671561584942413,
  longitude: 122.94369105292084,
  accuracy: 10,
  timestamp: now,
};

function check(
  branchId: string,
  latitude: number | null,
  longitude: number | null,
  location: AttendanceLocation | null = mainLocation,
  radiusMeters?: number
) {
  return validateAttendanceLocation({
    branchId,
    branchLatitude: latitude,
    branchLongitude: longitude,
    location,
    now,
    radiusMeters,
  });
}

describe("attendance geofence", () => {
  it("accepts Main Spa and SM Branch at their confirmed coordinates", () => {
    expect(check(MAIN, mainLocation.latitude, mainLocation.longitude)).toBeNull();
    expect(check(SM, smLocation.latitude, smLocation.longitude, smLocation)).toBeNull();
  });

  it("honors the distinct initial radii", () => {
    const nearMain = { ...mainLocation, latitude: mainLocation.latitude + 0.001 }; // ~111 m
    const nearSm = { ...smLocation, latitude: smLocation.latitude + 0.001 };
    expect(check(MAIN, mainLocation.latitude, mainLocation.longitude, nearMain)).toBe(
      "location_outside"
    );
    expect(check(SM, smLocation.latitude, smLocation.longitude, nearSm)).toBeNull();
    expect(distanceMeters(mainLocation, nearMain)).toBeGreaterThan(100);
  });

  it("uses the reported point at the Main Spa boundary without widening the approved radius for GPS uncertainty", () => {
    const nearInside = {
      ...mainLocation,
      latitude: mainLocation.latitude + 99 / 111_195,
      accuracy: 75,
    };
    const nearOutside = {
      ...mainLocation,
      latitude: mainLocation.latitude + 101 / 111_195,
      accuracy: 75,
    };
    expect(distanceMeters(mainLocation, nearInside)).toBeLessThan(100);
    expect(distanceMeters(mainLocation, nearOutside)).toBeGreaterThan(100);
    expect(check(MAIN, mainLocation.latitude, mainLocation.longitude, nearInside)).toBeNull();
    expect(check(MAIN, mainLocation.latitude, mainLocation.longitude, nearOutside)).toBe(
      "location_outside"
    );
  });

  it("rejects a reading from the other branch", () => {
    expect(check(MAIN, mainLocation.latitude, mainLocation.longitude, smLocation)).toBe(
      "location_outside"
    );
    expect(check(SM, smLocation.latitude, smLocation.longitude, mainLocation)).toBe(
      "location_outside"
    );
  });

  it("rejects missing, inaccurate and stale readings", () => {
    expect(check(MAIN, mainLocation.latitude, mainLocation.longitude, null)).toBe(
      "location_required"
    );
    expect(
      check(MAIN, mainLocation.latitude, mainLocation.longitude, { ...mainLocation, accuracy: 76 })
    ).toBe("location_inaccurate");
    expect(
      check(MAIN, mainLocation.latitude, mainLocation.longitude, {
        ...mainLocation,
        timestamp: now - 20_001,
      })
    ).toBe("location_stale");
    expect(
      check(MAIN, mainLocation.latitude, mainLocation.longitude, {
        ...mainLocation,
        timestamp: now + 5_001,
      })
    ).toBe("location_stale");
  });

  it.each([
    { latitude: Number.NaN },
    { latitude: Number.POSITIVE_INFINITY },
    { latitude: 91 },
    { longitude: -181 },
    { accuracy: 0 },
    { accuracy: Number.NaN },
    { timestamp: Number.POSITIVE_INFINITY },
  ])("rejects malformed coordinate data: %j", (change: Partial<AttendanceLocation>) => {
    expect(
      check(MAIN, mainLocation.latitude, mainLocation.longitude, { ...mainLocation, ...change })
    ).toBe("location_invalid");
  });

  it("fails closed on missing or invalid branch configuration", () => {
    expect(check("unknown", mainLocation.latitude, mainLocation.longitude)).toBe(
      "geofence_configuration"
    );
    expect(check(MAIN, null, mainLocation.longitude)).toBe("geofence_configuration");
    expect(check(MAIN, 91, mainLocation.longitude)).toBe("geofence_configuration");
    expect(check(MAIN, mainLocation.latitude, mainLocation.longitude, mainLocation, 0)).toBe(
      "geofence_configuration"
    );
  });
});
