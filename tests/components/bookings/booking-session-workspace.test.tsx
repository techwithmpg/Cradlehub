// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BookingSessionWorkspace } from "@/components/features/bookings/booking-session-workspace";
import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";

afterEach(() => cleanup());

function booking(overrides: Partial<WorkspaceBookingRow> = {}): WorkspaceBookingRow {
  return {
    id: "booking-1",
    booking_date: "2026-11-02",
    start_time: "16:00",
    end_time: "17:00",
    type: "appointment",
    status: "confirmed",
    booking_progress_status: "checked_in",
    payment_method: "cash",
    payment_status: "unpaid",
    amount_paid: 0,
    services: { name: "Cradle Swedish Massage", duration_minutes: 60 },
    staff: { full_name: "Gigi Pabon" },
    branch_resources: { name: "Room 2" },
    ...overrides,
  };
}

describe("BookingSessionWorkspace", () => {
  it("shows the persisted extended plan separately from the purchased duration", () => {
    render(
      <BookingSessionWorkspace
        line={booking({
          status: "in_progress",
          booking_progress_status: "session_started",
          session_started_at: "2026-11-02T08:00:00Z",
          session_due_at: "2026-11-02T09:30:00Z",
          session_duration_minutes_snapshot: 60,
        })}
        recipientName="Preview Guest"
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("Planned duration").nextElementSibling?.textContent).toBe("90 min");
    expect(screen.getByText("Purchased duration").nextElementSibling?.textContent).toBe("60 min");
  });
  it("shows a neutral timer before service starts and a stopped timer after completion", () => {
    const { rerender } = render(
      <BookingSessionWorkspace line={booking()} recipientName="Rhea Mendoza" onClose={vi.fn()} />
    );
    expect(screen.getByText("not started")).toBeTruthy();
    expect(screen.getAllByText("60 min").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Apply Extension" })).toBeNull();

    rerender(
      <BookingSessionWorkspace
        line={booking({
          status: "completed",
          booking_progress_status: "completed",
          session_completed_at: "2026-11-02T09:05:00Z",
        })}
        recipientName="Rhea Mendoza"
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("completed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Apply Extension" })).toBeNull();
  });

  it("uses persisted start and due timestamps across remounts and keeps extension confirmation unavailable", async () => {
    const now = Date.now();
    const active = booking({
      status: "in_progress",
      booking_progress_status: "session_started",
      session_started_at: new Date(now - 30 * 60_000).toISOString(),
      session_due_at: new Date(now + 30 * 60_000).toISOString(),
    });
    const onClose = vi.fn();
    const view = render(
      <BookingSessionWorkspace line={active} recipientName="Rhea Mendoza" onClose={onClose} />
    );
    await waitFor(() =>
      expect(screen.getByRole("timer").getAttribute("aria-label")).toMatch(
        /^00:(29|30):\d{2} left$/
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "+30 min" }));
    expect(screen.getByText(/cannot yet be verified together/i)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Apply Extension" }) as HTMLButtonElement).disabled
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Keep original end time" }));
    expect(onClose).toHaveBeenCalledOnce();

    view.unmount();
    render(
      <BookingSessionWorkspace line={active} recipientName="Rhea Mendoza" onClose={vi.fn()} />
    );
    await waitFor(() =>
      expect(screen.getByRole("timer").getAttribute("aria-label")).toMatch(
        /^00:(29|30):\d{2} left$/
      )
    );
  });
});
