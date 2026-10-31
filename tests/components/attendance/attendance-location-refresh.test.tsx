// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { warmAttendanceLocation } = vi.hoisted(() => ({
  warmAttendanceLocation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/attendance/browser-location", () => ({ warmAttendanceLocation }));

import { AttendanceLocationRefresh } from "@/components/features/staff-pwa/attendance-location-refresh";

afterEach(() => {
  cleanup();
  warmAttendanceLocation.mockClear();
});

describe("Staff PWA attendance location readiness", () => {
  it("both Staff layouts take their flag from the server geofence mode", () => {
    for (const route of ["staff", "staff-portal"]) {
      const source = readFileSync(
        join(process.cwd(), "src", "app", "(dashboard)", route, "layout.tsx"),
        "utf8"
      );
      expect(source).toContain('enabled={attendanceGeofenceMode() === "enabled"}');
    }
  });

  it("does not acquire location while server enforcement is disabled", () => {
    render(<AttendanceLocationRefresh enabled={false} />);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(warmAttendanceLocation).not.toHaveBeenCalled();
  });

  it("refreshes on open and on return to the foreground", () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    render(<AttendanceLocationRefresh enabled />);
    expect(warmAttendanceLocation).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event("visibilitychange"));
    expect(warmAttendanceLocation).toHaveBeenCalledTimes(2);
  });
});
