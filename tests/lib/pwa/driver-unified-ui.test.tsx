// @vitest-environment jsdom
import React from "react";
import { afterEach, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/staff/driver",
}));
vi.mock("@/components/features/staff-pwa/safe-memory", () => ({
  StaffSnapshotRecorder: () => null,
}));
vi.mock("@/components/features/staff-pwa/driver/driver-trip-alerts", () => ({
  DriverTripAlerts: () => null,
}));
vi.mock("@/components/features/staff-portal/staff-attendance-clock-out", () => ({
  StaffAttendanceClockOut: () => null,
}));
import { DriverNativeHome } from "@/components/features/staff-pwa/driver/driver-native-home";
const staff = {
  id: "test-driver",
  full_name: "Test Driver",
  nickname: "Alex",
  system_role: "driver",
  staff_type: "driver",
  branch_id: "test-branch",
  tier: null,
};
afterEach(cleanup);
it("keeps a compact greeting and honest empty state", () => {
  render(
    <DriverNativeHome staff={staff} items={[]} businessDate="2026-11-17" attendanceData={null} />
  );
  expect(screen.getByRole("heading", { name: "Hello, Alex" })).toBeTruthy();
  expect(screen.getByText("No assigned trips")).toBeTruthy();
  expect(screen.getByText(/Shift: status unavailable/)).toBeTruthy();
});
it("does not present request failure as a successful empty state", () => {
  render(
    <DriverNativeHome
      staff={staff}
      items={[]}
      businessDate="2026-11-17"
      attendanceData={null}
      journeyError="Assignments unavailable"
    />
  );
  expect(screen.getByRole("alert").textContent).toContain("Assignments unavailable");
  expect(screen.queryByText("No assigned trips")).toBeNull();
});
it("shows collection even when the completed service is absent from today's jobs", () => {
  render(
    <DriverNativeHome
      staff={staff}
      items={[]}
      businessDate="2026-11-17"
      attendanceData={null}
      journeys={[
        {
          bookingId: "11111111-1111-4111-8111-111111111111",
          revision: 5,
          stage: "collection_pending",
          leg: "collection",
          destination: { lat: 10, lng: 120, label: "Test collection point" },
          observedAt: "2026-11-17T00:00:00Z",
          therapistName: "Test Provider",
        },
      ]}
    />
  );
  expect(screen.getByText("Therapist ready for collection")).toBeTruthy();
  expect(screen.getByText("Therapist: Test Provider")).toBeTruthy();
  expect(screen.queryByText("No assigned trips")).toBeNull();
});
