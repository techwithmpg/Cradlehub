// @vitest-environment jsdom
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
  it("refreshes on open and on return to the foreground", () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    render(<AttendanceLocationRefresh />);
    expect(warmAttendanceLocation).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event("visibilitychange"));
    expect(warmAttendanceLocation).toHaveBeenCalledTimes(2);
  });
});
