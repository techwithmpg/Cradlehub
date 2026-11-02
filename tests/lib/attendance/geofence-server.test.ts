import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attendanceGeofenceMode,
  attendanceGeofenceRequired,
  verifyAttendanceGeofence,
} from "@/lib/attendance/geofence-server";
import type { AttendanceDb } from "@/lib/attendance/db";

vi.mock("server-only", () => ({}));

const mainBranchId = "c1000000-0000-0000-0000-000000000001";
const smBranchId = "c1000000-0000-0000-0000-000000000002";
const unknownBranchId = "c1000000-0000-0000-0000-000000000099";

const mainCoords = { latitude: 10.7024485, longitude: 122.9619465 };
const smCoords = { latitude: 10.671561584942413, longitude: 122.94369105292084 };

function createTestDb(branches: Record<string, { latitude: number | null; longitude: number | null }>): AttendanceDb {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn((col: string, val: string) => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: table === "branches" && col === "id" && branches[val] ? branches[val] : null,
            error: null,
          }),
        })),
      })),
    })),
  } as unknown as AttendanceDb;
}

const standardDb = createTestDb({
  [mainBranchId]: mainCoords,
  [smBranchId]: smCoords,
});

function createLocation(
  base: { latitude: number; longitude: number },
  deltaLat = 0,
  options?: { accuracy?: number; ageMs?: number }
) {
  return {
    latitude: base.latitude + deltaLat,
    longitude: base.longitude,
    accuracy: options?.accuracy ?? 10,
    timestamp: Date.now() - (options?.ageMs ?? 0),
  };
}

describe("server attendance geofence gate", () => {
  afterEach(() => {
    delete process.env.ATTENDANCE_GEOFENCE_MODE;
    delete process.env.ATTENDANCE_GEOFENCE_MAIN_RADIUS_METERS;
    delete process.env.ATTENDANCE_GEOFENCE_SM_RADIUS_METERS;
  });

  describe("geofence mode evaluation", () => {
    it("defaults to disabled when unconfigured and bypasses location verification", async () => {
      expect(attendanceGeofenceMode()).toBe("disabled");
      expect(attendanceGeofenceRequired()).toBe(false);
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: mainBranchId,
          location: null,
        })
      ).toBeNull();
    });

    it("bypasses location verification when explicitly disabled", async () => {
      process.env.ATTENDANCE_GEOFENCE_MODE = "disabled";
      expect(attendanceGeofenceMode()).toBe("disabled");
      expect(attendanceGeofenceRequired()).toBe(false);
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: mainBranchId,
          location: null,
        })
      ).toBeNull();
    });

    it("fails closed on invalid mode strings", async () => {
      process.env.ATTENDANCE_GEOFENCE_MODE = "enabledd";
      expect(attendanceGeofenceMode()).toBe("invalid");
      expect(attendanceGeofenceRequired()).toBe(true);
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: mainBranchId,
          location: createLocation(mainCoords),
        })
      ).toBe("geofence_configuration");
    });
  });

  describe("enabled geofence validation and branch limits", () => {
    afterEach(() => {
      delete process.env.ATTENDANCE_GEOFENCE_MODE;
      delete process.env.ATTENDANCE_GEOFENCE_MAIN_RADIUS_METERS;
      delete process.env.ATTENDANCE_GEOFENCE_SM_RADIUS_METERS;
    });

    it("blocks a server request with no location while enabled", async () => {
      process.env.ATTENDANCE_GEOFENCE_MODE = "enabled";
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: mainBranchId,
          location: null,
        })
      ).toBe("location_required");
    });

    it("fails closed when database coordinates are absent or branch is unknown", async () => {
      process.env.ATTENDANCE_GEOFENCE_MODE = "enabled";
      const emptyDb = createTestDb({ [mainBranchId]: { latitude: null, longitude: null } });
      expect(
        await verifyAttendanceGeofence({
          admin: emptyDb,
          branchId: mainBranchId,
          location: createLocation(mainCoords),
        })
      ).toBe("geofence_configuration");

      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: unknownBranchId,
          location: createLocation(mainCoords),
        })
      ).toBe("geofence_configuration");
    });

    it("enforces Main Spa default 100m radius", async () => {
      process.env.ATTENDANCE_GEOFENCE_MODE = "enabled";
      // +0.0008 lat is ~89m from Main -> inside 100m
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: mainBranchId,
          location: createLocation(mainCoords, 0.0008),
        })
      ).toBeNull();

      // +0.0010 lat is ~111m from Main -> outside 100m
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: mainBranchId,
          location: createLocation(mainCoords, 0.001),
        })
      ).toBe("location_outside");
    });

    it("enforces SM Branch default 150m radius", async () => {
      process.env.ATTENDANCE_GEOFENCE_MODE = "enabled";
      // +0.0012 lat is ~133m from SM -> inside 150m
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: smBranchId,
          location: createLocation(smCoords, 0.0012),
        })
      ).toBeNull();

      // +0.0015 lat is ~167m from SM -> outside 150m
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: smBranchId,
          location: createLocation(smCoords, 0.0015),
        })
      ).toBe("location_outside");
    });

    it("allows valid tighter overrides for Main Spa and SM Branch", async () => {
      process.env.ATTENDANCE_GEOFENCE_MODE = "enabled";
      // Tighten Main Spa to 50m
      process.env.ATTENDANCE_GEOFENCE_MAIN_RADIUS_METERS = "50";
      // +0.0004 lat is ~44.5m -> inside 50m
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: mainBranchId,
          location: createLocation(mainCoords, 0.0004),
        })
      ).toBeNull();
      // +0.0008 lat is ~89m -> outside 50m (even though inside default 100m)
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: mainBranchId,
          location: createLocation(mainCoords, 0.0008),
        })
      ).toBe("location_outside");

      // Tighten SM Branch to 100m
      process.env.ATTENDANCE_GEOFENCE_SM_RADIUS_METERS = "100";
      // +0.0008 lat is ~89m -> inside 100m
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: smBranchId,
          location: createLocation(smCoords, 0.0008),
        })
      ).toBeNull();
      // +0.0012 lat is ~133m -> outside 100m (even though inside default 150m)
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: smBranchId,
          location: createLocation(smCoords, 0.0012),
        })
      ).toBe("location_outside");
    });

    it("accepts exact approved maximum boundary overrides", async () => {
      process.env.ATTENDANCE_GEOFENCE_MODE = "enabled";
      process.env.ATTENDANCE_GEOFENCE_MAIN_RADIUS_METERS = "100";
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: mainBranchId,
          location: createLocation(mainCoords, 0.0008),
        })
      ).toBeNull();

      process.env.ATTENDANCE_GEOFENCE_SM_RADIUS_METERS = "150";
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: smBranchId,
          location: createLocation(smCoords, 0.0012),
        })
      ).toBeNull();
    });

    it("rejects wider overrides exceeding approved branch limits", async () => {
      process.env.ATTENDANCE_GEOFENCE_MODE = "enabled";

      // Main Spa limit is 100m: 101, 150, 500, 1000 must all fail closed
      process.env.ATTENDANCE_GEOFENCE_MAIN_RADIUS_METERS = "101";
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: mainBranchId,
          location: createLocation(mainCoords),
        })
      ).toBe("geofence_configuration");

      process.env.ATTENDANCE_GEOFENCE_MAIN_RADIUS_METERS = "150";
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: mainBranchId,
          location: createLocation(mainCoords),
        })
      ).toBe("geofence_configuration");

      process.env.ATTENDANCE_GEOFENCE_MAIN_RADIUS_METERS = "500";
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: mainBranchId,
          location: createLocation(mainCoords),
        })
      ).toBe("geofence_configuration");

      // SM Branch limit is 150m: 151, 200, 500 must all fail closed
      process.env.ATTENDANCE_GEOFENCE_SM_RADIUS_METERS = "151";
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: smBranchId,
          location: createLocation(smCoords),
        })
      ).toBe("geofence_configuration");

      process.env.ATTENDANCE_GEOFENCE_SM_RADIUS_METERS = "500";
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: smBranchId,
          location: createLocation(smCoords),
        })
      ).toBe("geofence_configuration");
    });

    it("rejects invalid, zero, negative, or malformed radius overrides", async () => {
      process.env.ATTENDANCE_GEOFENCE_MODE = "enabled";

      const invalidValues = ["0", "-10", "NaN", "100m", "100.0.0", " ", ""];
      for (const val of invalidValues) {
        process.env.ATTENDANCE_GEOFENCE_MAIN_RADIUS_METERS = val;
        expect(
          await verifyAttendanceGeofence({
            admin: standardDb,
            branchId: mainBranchId,
            location: createLocation(mainCoords),
          }),
          `Expected override '${val}' to fail closed`
        ).toBe("geofence_configuration");
      }
    });

    it("enforces maximum GPS accuracy limit of 75 meters", async () => {
      process.env.ATTENDANCE_GEOFENCE_MODE = "enabled";
      // 75m accuracy passes
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: mainBranchId,
          location: createLocation(mainCoords, 0, { accuracy: 75 }),
        })
      ).toBeNull();

      // 76m accuracy fails closed with location_inaccurate
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: mainBranchId,
          location: createLocation(mainCoords, 0, { accuracy: 76 }),
        })
      ).toBe("location_inaccurate");
    });

    it("enforces location freshness window (-5s to 20s)", async () => {
      process.env.ATTENDANCE_GEOFENCE_MODE = "enabled";
      // 10s old reading passes
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: mainBranchId,
          location: createLocation(mainCoords, 0, { ageMs: 10_000 }),
        })
      ).toBeNull();

      // 21s old reading fails closed with location_stale
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: mainBranchId,
          location: createLocation(mainCoords, 0, { ageMs: 21_000 }),
        })
      ).toBe("location_stale");

      // Future reading beyond 5s fails closed with location_stale
      expect(
        await verifyAttendanceGeofence({
          admin: standardDb,
          branchId: mainBranchId,
          location: createLocation(mainCoords, 0, { ageMs: -6_000 }),
        })
      ).toBe("location_stale");
    });
  });
});
