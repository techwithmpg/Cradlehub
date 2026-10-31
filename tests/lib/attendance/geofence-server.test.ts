import { afterEach, describe, expect, it, vi } from "vitest";
import { attendanceGeofenceMode, verifyAttendanceGeofence } from "@/lib/attendance/geofence-server";
import type { AttendanceDb } from "@/lib/attendance/db";

vi.mock("server-only", () => ({}));
const main = "c1000000-0000-0000-0000-000000000001";
const location = {
  latitude: 10.7024485,
  longitude: 122.9619465,
  accuracy: 10,
  timestamp: Date.now(),
};

function db(latitude: number | null, longitude: number | null): AttendanceDb {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { latitude, longitude }, error: null });
  return {
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })),
  } as unknown as AttendanceDb;
}

describe("server attendance geofence gate", () => {
  afterEach(() => {
    delete process.env.ATTENDANCE_GEOFENCE_MODE;
    delete process.env.ATTENDANCE_GEOFENCE_MAIN_RADIUS_METERS;
  });

  it("requires an explicit mode before enforcement and fails closed on invalid mode", async () => {
    expect(attendanceGeofenceMode()).toBe("disabled");
    process.env.ATTENDANCE_GEOFENCE_MODE = "enabledd";
    expect(
      await verifyAttendanceGeofence({
        admin: db(10.7024485, 122.9619465),
        branchId: main,
        location,
      })
    ).toBe("geofence_configuration");
  });

  it("blocks a server request with no location while enabled", async () => {
    process.env.ATTENDANCE_GEOFENCE_MODE = "enabled";
    expect(
      await verifyAttendanceGeofence({
        admin: db(10.7024485, 122.9619465),
        branchId: main,
        location: null,
      })
    ).toBe("location_required");
  });

  it("fails closed when database coordinates are absent", async () => {
    process.env.ATTENDANCE_GEOFENCE_MODE = "enabled";
    expect(
      await verifyAttendanceGeofence({ admin: db(null, null), branchId: main, location })
    ).toBe("geofence_configuration");
  });

  it("rejects malformed radius overrides", async () => {
    process.env.ATTENDANCE_GEOFENCE_MODE = "enabled";
    process.env.ATTENDANCE_GEOFENCE_MAIN_RADIUS_METERS = "NaN";
    expect(
      await verifyAttendanceGeofence({
        admin: db(10.7024485, 122.9619465),
        branchId: main,
        location,
      })
    ).toBe("geofence_configuration");
  });
});
