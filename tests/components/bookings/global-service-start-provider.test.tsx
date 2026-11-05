// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  snapshot: vi.fn(),
  start: vi.fn(),
  arrived: vi.fn(),
  followup: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  bookingsChanged: vi.fn(),
}));

vi.mock("@/app/(dashboard)/crm/service-start-actions", () => ({ getCrmServiceStartSnapshotAction: mocks.snapshot }));
vi.mock("@/app/(dashboard)/crm/bookings/actions", () => ({
  crmStartServiceAction: mocks.start,
  markBookingArrivedAction: mocks.arrived,
  recordBookingFollowupAction: mocks.followup,
}));
vi.mock("@/lib/bookings/bookings-client-events", () => ({
  BOOKINGS_CHANGED_EVENT: "cradlehub:bookings-changed",
  notifyBookingsChanged: mocks.bookingsChanged,
}));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

import { GlobalServiceStartProvider } from "@/components/features/bookings/global-service-start-provider";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.clearAllMocks();
});

describe("global CRM service start queue", () => {
  it("shows the dialog outside Bookings and retains a dismissed action across module changes", async () => {
    const now = Date.now();
    mocks.snapshot.mockResolvedValue({
      ok: true,
      serverNow: new Date(now).toISOString(),
      actions: [{
        bookingId: "booking-1", recipientName: "Guest A", serviceName: "Massage",
        durationMinutes: 60, scheduledStart: "14:00:00",
        scheduledAtIso: new Date(now + 60_000).toISOString(),
        therapistName: "Therapist A", roomName: "Room 1", groupReference: "GROUP-1",
      }],
    });
    const view = render(<GlobalServiceStartProvider branchId="branch-1"><div>Cash Flow</div></GlobalServiceStartProvider>);
    expect(screen.getByText("Cash Flow")).toBeTruthy();
    const dialog = await screen.findByRole("dialog");
    expect(screen.getByRole("heading", { name: "Action Required" })).toBeTruthy();
    expect(dialog.textContent).toContain("Guest A");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: /Service Actions · 1 due/ })).toBeTruthy();

    view.rerender(<GlobalServiceStartProvider branchId="branch-1"><div>Attendance</div></GlobalServiceStartProvider>);
    expect(screen.getByText("Attendance")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Service Actions · 1 due/ }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
