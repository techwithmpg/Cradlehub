/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SelectedBookingPrimaryAction } from "@/components/features/bookings/selected-booking-primary-action";
import { SelectedBookingQuickActions } from "@/components/features/bookings/selected-booking-quick-actions";
import { CancelBookingDialog } from "@/components/features/bookings/cancel-booking-dialog";
import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";

const actionMocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  followup: vi.fn(),
  start: vi.fn(),
}));
const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/app/(dashboard)/crm/bookings/actions", () => ({
  markBookingConfirmedAction: actionMocks.confirm,
  recordBookingFollowupAction: actionMocks.followup,
  crmStartServiceAction: actionMocks.start,
}));

vi.mock("@/app/(dashboard)/manager/bookings/actions", () => ({
  updateBookingStatusAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({ toast: toastMocks }));

const booking: WorkspaceBookingRow = {
  id: "1ea3ce31-6ead-49e0-9ff4-43501d5cf20d",
  branch_id: "20a30d2a-2899-48c8-b643-c12ce26715f1",
  booking_date: "2026-07-14",
  start_time: "10:00:00",
  end_time: "11:00:00",
  type: "online",
  delivery_type: "in_spa",
  status: "pending",
  booking_progress_status: "not_started",
  payment_method: "pay_on_site",
  payment_status: "pending",
  amount_paid: 0,
  customers: { id: "customer-1", full_name: "Malcom Patem", phone: "99994462" },
  services: { id: "service-1", name: "Angels Massage", duration_minutes: 60 },
};

beforeEach(() => {
  actionMocks.confirm.mockReset().mockResolvedValue({ success: true });
  actionMocks.followup.mockReset().mockResolvedValue({ success: true });
  actionMocks.start.mockReset().mockResolvedValue({ success: true });
  toastMocks.success.mockReset();
  toastMocks.error.mockReset();
});

afterEach(() => cleanup());

describe("desktop booking direct actions", () => {
  it("confirms directly with the real booking UUID and refreshes the workspace", async () => {
    const onChanged = vi.fn();
    render(
      <SelectedBookingPrimaryAction
        booking={booking}
        onOpenArrival={vi.fn()}
        onOpenRoom={vi.fn()}
        onSessionStarted={vi.fn()}
        onChanged={onChanged}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark Booking Confirmed" }));

    await waitFor(() => {
      expect(actionMocks.confirm).toHaveBeenCalledWith({ bookingId: booking.id });
      expect(onChanged).toHaveBeenCalledTimes(1);
    });
    expect(toastMocks.success).toHaveBeenCalledWith("Booking confirmed.");
    expect(screen.queryByText("Booking Follow-up")).toBeNull();
  });

  it("records No Answer directly without opening the follow-up modal", async () => {
    const onChanged = vi.fn();
    render(
      <SelectedBookingQuickActions
        booking={booking}
        viewerRole="crm"
        onOpenReschedule={vi.fn()}
        onChanged={onChanged}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open more booking actions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "No Answer" }));

    await waitFor(() => {
      expect(actionMocks.followup).toHaveBeenCalledWith({
        bookingId: booking.id,
        result: "no_answer",
      });
      expect(onChanged).toHaveBeenCalledTimes(1);
    });
    expect(toastMocks.success).toHaveBeenCalledWith("No answer recorded.");
    expect(screen.queryByText("Booking Follow-up")).toBeNull();
  });

  it("records Confirm Later directly and keeps the booking pending", async () => {
    render(
      <SelectedBookingQuickActions
        booking={booking}
        viewerRole="crm"
        onOpenReschedule={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open more booking actions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Confirm Later" }));

    await waitFor(() => {
      expect(actionMocks.followup).toHaveBeenCalledWith({
        bookingId: booking.id,
        result: "confirm_later",
      });
    });
    expect(toastMocks.success).toHaveBeenCalledWith("Booking kept in follow-up.");
  });

  it("opens the existing reschedule flow directly", () => {
    const onOpenReschedule = vi.fn();
    render(
      <SelectedBookingQuickActions
        booking={booking}
        viewerRole="crm"
        onOpenReschedule={onOpenReschedule}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    expect(onOpenReschedule).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Booking Follow-up")).toBeNull();
  });

  it("opens the focused cancellation dialog from the compact action row", async () => {
    render(
      <SelectedBookingQuickActions
        booking={booking}
        viewerRole="crm"
        onOpenReschedule={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("heading", { name: "Cancel booking?" })).toBeTruthy();
    expect(screen.queryByText("Booking Follow-up")).toBeNull();
  });
});

describe("focused cancellation dialog", () => {
  it("requires a reason and saves the selected reason plus optional note", async () => {
    const onChanged = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <CancelBookingDialog
        booking={booking}
        open
        onOpenChange={onOpenChange}
        onChanged={onChanged}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel Booking" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Select a cancellation reason.");
    expect(actionMocks.followup).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("combobox", { name: /Reason/i }), {
      target: { value: "scheduling_conflict" },
    });
    fireEvent.change(screen.getByLabelText(/Note/i), { target: { value: "Customer asked for another day." } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel Booking" }));

    await waitFor(() => {
      expect(actionMocks.followup).toHaveBeenCalledWith({
        bookingId: booking.id,
        result: "cancel",
        cancellationReason: "scheduling_conflict",
        note: "Customer asked for another day.",
      });
      expect(onChanged).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
