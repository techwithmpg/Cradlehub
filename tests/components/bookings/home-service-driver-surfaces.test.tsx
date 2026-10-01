// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("server-only", () => ({}));

const { assignDriver, assignTherapist, notifyChanged } = vi.hoisted(() => ({
  assignDriver: vi.fn(),
  assignTherapist: vi.fn(),
  notifyChanged: vi.fn(),
}));

vi.mock("@/lib/actions/driver-actions", () => ({ assignBookingDriverAction: assignDriver }));
vi.mock("@/app/(dashboard)/crm/bookings/actions", () => ({ assignBookingTherapistAction: assignTherapist }));
vi.mock("@/lib/bookings/bookings-client-events", () => ({ notifyBookingsChanged: notifyChanged }));
vi.mock("@/components/features/assignments/assignment-recommendation-panel", () => ({
  AssignmentRecommendationPanel: ({ onAssignDriver }: { onAssignDriver?: (id: string) => void }) =>
    <button type="button" onClick={() => onAssignDriver?.("driver-2")}>Choose driver</button>,
}));
vi.mock("@/components/shared/overlays", () => ({
  AdminDialog: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div>,
  AdminOverlayHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
  AdminOverlayBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdminOverlayFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { SelectedBookingStaffRow } from "@/components/features/bookings/selected-booking-staff-row";
import { CradleFlowBookingDialog } from "@/components/features/crm/today/cradle-flow-booking-dialog";
import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";
import type { CradleFlowBooking } from "@/lib/crm/cradle-flow";

const workspaceBooking = (driverId: string | null): WorkspaceBookingRow => ({
  id: "booking-1", booking_date: "2026-10-01", start_time: "10:00", type: "home_service",
  delivery_type: "home_service", status: "confirmed", payment_method: "pay_on_site",
  payment_status: "unpaid", amount_paid: 0, driver_id: driverId,
  driver: driverId ? { id: driverId, full_name: "Alex Driver" } : null,
});

const flowBooking = (driverId: string | null): CradleFlowBooking => ({
  id: "booking-1", booking_date: "2026-10-01", start_time: "10:00", type: "home_service",
  delivery_type: "home_service", status: "confirmed", payment_status: "unpaid",
  payment_method: "pay_on_site", amount_paid: 0, price_paid: 500,
  booking_progress_status: "not_started", driver_id: driverId,
  driver_name: driverId ? "Alex Driver" : null, staff_id: "therapist-1", staff_name: "Sam Therapist",
} as CradleFlowBooking);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Home Service driver assignment surfaces", () => {
  it("shows the persisted driver in Bookings and saves a manual change in place", async () => {
    assignDriver.mockResolvedValue({ success: true });
    const onChanged = vi.fn();
    const { rerender } = render(<SelectedBookingStaffRow booking={workspaceBooking(null)} canEdit onChanged={onChanged} />);
    expect(screen.getByText("Not assigned")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Assign Driver" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose driver" }));
    await waitFor(() => expect(assignDriver).toHaveBeenCalledWith({ bookingId: "booking-1", driverId: "driver-2" }));
    expect(onChanged).toHaveBeenCalledOnce();

    rerender(<SelectedBookingStaffRow booking={workspaceBooking("driver-2")} canEdit onChanged={onChanged} />);
    expect(screen.getByText("Alex Driver")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Change" })).toBeTruthy();
  });

  it("assigns a driver in the Cradle Flow quick modal without closing it", async () => {
    assignDriver.mockResolvedValue({ success: true });
    const onOpenChange = vi.fn();
    render(<CradleFlowBookingDialog booking={flowBooking(null)} open onOpenChange={onOpenChange} onPrimary={vi.fn()} onAssignRoom={vi.fn()} onAssignTherapist={vi.fn()} />);
    expect(screen.getByText("Not assigned")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Assign Driver" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose driver" }));
    await waitFor(() => expect(assignDriver).toHaveBeenCalledWith({ bookingId: "booking-1", driverId: "driver-2" }));
    expect(notifyChanged).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
