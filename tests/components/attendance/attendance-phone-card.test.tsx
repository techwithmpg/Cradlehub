/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/(dashboard)/staff-portal/profile/attendance-device-actions", () => ({
  cancelAttendancePhoneRequestAction: vi.fn(),
  completeAttendancePhoneRequestAction: vi.fn(),
  completeProfileAttendanceRecoveryAction: vi.fn(),
  renameOwnAttendancePhoneAction: vi.fn(),
  requestAttendancePhoneAction: vi.fn(),
}));

import { AttendancePhoneCard } from "@/components/features/staff-portal/attendance-phone-card";
import type { StaffAttendancePhoneState } from "@/lib/attendance/device-registration";

afterEach(() => cleanup());

describe("AttendancePhoneCard maintenance mode", () => {
  it("keeps the existing phone visible but removes all mutation controls", () => {
    const state: StaffAttendancePhoneState = {
      staffId: "staff-1",
      registeredDevice: {
        id: "device-1",
        label: "Maria's phone",
        lastSeenAt: "2026-07-26T10:00:00.000Z",
      },
      activeDevices: [{ id: "device-1", label: "Maria's phone", isCurrent: true }],
      request: null,
      profileRecovery: null,
      recentBrowserRecoveryCount: 0,
    };

    render(<AttendancePhoneCard state={state} maintenanceActive />);

    expect(
      screen.getByText("Attendance phone changes are temporarily unavailable during maintenance.")
    ).toBeInTheDocument();
    expect(screen.getByText("This phone: Maria's phone")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText(/revoke/i)).toBeNull();
  });
});
