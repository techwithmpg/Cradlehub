/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SelectedBookingHeader } from "@/components/features/bookings/selected-booking-header";
import { SelectedBookingTabs } from "@/components/features/bookings/selected-booking-tabs";
import { SelectedBookingActivity } from "@/components/features/bookings/selected-booking-activity";
import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";

afterEach(() => cleanup());

const booking: WorkspaceBookingRow = {
  id: "1ea3ce31-6ead-49e0-9ff4-43501d5cf20d",
  booking_date: "2026-07-14",
  start_time: "10:00:00",
  end_time: "11:00:00",
  type: "online",
  delivery_type: "in_spa",
  status: "pending",
  payment_method: "pay_on_site",
  payment_status: "pending",
  amount_paid: 0,
  customers: { id: "customer-1", full_name: "Malcom Patem", phone: "99994462" },
  services: { id: "service-1", name: "Angels Massage", duration_minutes: 60 },
};

describe("selected booking command structure", () => {
  it("uses customer identity as the heading and exposes an accessible close control", () => {
    render(<SelectedBookingHeader booking={booking} onClose={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Malcom Patem" })).toBeTruthy();
    expect(screen.queryByText("Selected Booking")).toBeNull();
    expect(screen.getByRole("button", { name: "Close selected booking" })).toBeTruthy();
  });

  it("renders Overview, Activity, and Details with tab semantics", () => {
    render(<SelectedBookingTabs activeTab="overview" onChange={vi.fn()} />);

    expect(screen.getByRole("tablist", { name: "Selected booking information" })).toBeTruthy();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Overview",
      "Activity",
      "Details",
    ]);
    expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected")).toBe("true");
  });

  it("shows an honest activity empty state when no persisted event time exists", () => {
    render(<SelectedBookingActivity booking={booking} />);

    expect(screen.getByText(/No timestamped activity is available/i)).toBeTruthy();
    expect(screen.queryByText(/previous visits/i)).toBeNull();
  });
});
