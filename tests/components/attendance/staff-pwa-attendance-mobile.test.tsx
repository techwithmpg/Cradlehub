/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  snapshot: vi.fn(),
  clockOut: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
  redirect: mocks.redirect,
}));
vi.mock("@/app/(dashboard)/staff-portal/actions", () => ({
  getMyProfileAction: mocks.profile,
  clockOutFromStaffPortalAction: mocks.clockOut,
}));
vi.mock("@/lib/staff-portal/attendance", () => ({
  getPureAttendanceSnapshot: mocks.snapshot,
}));
vi.mock("@/lib/attendance/device-registration", () => ({
  getOwnAttendancePhoneState: async () => null,
}));
vi.mock("@/components/features/staff-portal/attendance-readiness-card", () => ({
  AttendanceReadinessCard: () => <div>Phone and schedule readiness</div>,
}));
vi.mock("@/components/features/staff-portal/staff-attendance-history", () => ({
  StaffAttendanceHistory: () => <div>Clock history</div>,
}));
vi.mock("@/components/features/staff-portal/staff-attendance-realtime", () => ({
  StaffAttendanceRealtime: () => null,
}));
vi.mock("@/components/features/dashboard/page-header", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import StaffPwaAttendancePage from "@/app/(dashboard)/staff/attendance/page";
import LegacyAttendancePage from "@/app/(dashboard)/staff-portal/attendance/page";

const baseAvailability = {
  enabled: true,
  code: "final_home_service_complete",
  label: "Clock out",
  message: "Final assignment complete.",
  expectedClockOutAt: null,
  nextAssignmentAt: null,
};

function setMobileViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  window.dispatchEvent(new Event("resize"));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.snapshot.mockResolvedValue({
    staffId: "staff-1",
    currentClockState: "clocked_in",
    currentRecord: { checkedOutAt: null },
    portalClockOut: baseAvailability,
    todayState: { timezone: "Asia/Manila" },
  });
});
afterEach(cleanup);

describe("/staff/attendance in simulated mobile authenticated states", () => {
  it("shows a therapist's server-provided Home Service clock-out at 375px", async () => {
    setMobileViewport(375);
    mocks.profile.mockResolvedValue({ staff: { system_role: "service_staff", staff_type: "therapist" } });
    mocks.clockOut.mockResolvedValue({
      ok: true, title: "All done", message: "Shift ended.",
      checkedOutAt: "2026-10-31T12:00:00Z",
    });
    render(await StaffPwaAttendancePage());
    expect(screen.getByRole("heading", { name: "My Attendance" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Today's Attendance" })).toBeTruthy();
    const button = screen.getByRole("button", { name: "Clock out" });
    expect(button.className).toContain("min-h-11");
    expect(button.parentElement?.className).toContain("flex-col");
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText(/Clocked out at 8:00/)).toBeTruthy());
    expect(mocks.clockOut).toHaveBeenCalledOnce();
    expect(mocks.clockOut).toHaveBeenCalledWith();
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Clock out" })).toBeNull();
  });

  it("shows the driver's legacy attendance route at 390px and keeps refusal visible", async () => {
    setMobileViewport(390);
    mocks.profile.mockResolvedValue({ staff: { system_role: "driver", staff_type: "driver" } });
    mocks.snapshot.mockResolvedValue({
      staffId: "driver-1", currentClockState: "clocked_in",
      portalClockOut: { ...baseAvailability, code: "final_trip_complete" },
      todayState: { timezone: "Asia/Manila" },
    });
    mocks.clockOut.mockResolvedValue({
      ok: false, title: "Assignment still active", message: "Finish the trip first.",
    });
    const routedPage = await StaffPwaAttendancePage();
    expect(routedPage.type).toBe(LegacyAttendancePage);
    render(await LegacyAttendancePage());
    expect(screen.getByRole("heading", { name: "My Attendance" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Today's Attendance" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clock out" }));
    await waitFor(() => expect(screen.getByText("Finish the trip first.")).toBeTruthy());
    expect(mocks.clockOut).toHaveBeenCalledWith();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Clock out" })).toBeTruthy();
  });

  it("shows QR-only and network-failure states without sending identity from the browser", async () => {
    setMobileViewport(375);
    mocks.profile.mockResolvedValue({ staff: { system_role: "service_staff", staff_type: "therapist" } });
    mocks.snapshot.mockResolvedValueOnce({
      staffId: "staff-1", currentClockState: "clocked_in", currentRecord: null,
      portalClockOut: { ...baseAvailability, enabled: false, code: "use_branch_qr" },
      todayState: { timezone: "Asia/Manila" },
    });
    const qrPage = render(await StaffPwaAttendancePage());
    expect(screen.getByText("Branch QR")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clock out" })).toBeNull();
    qrPage.unmount();

    mocks.clockOut.mockRejectedValue(new Error("network unavailable"));
    render(await StaffPwaAttendancePage());
    fireEvent.click(screen.getByRole("button", { name: "Clock out" }));
    await waitFor(() => expect(screen.getByText("Please retry or ask CRM for help.")).toBeTruthy());
    expect(mocks.clockOut).toHaveBeenCalledWith();
    expect(screen.getByRole("button", { name: "Clock out" })).toBeTruthy();
  });
});
