// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createBooking: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/actions/administrative-booking", () => ({
  getAdministrativeBookingCustomerPrefillAction: vi.fn(),
}));
vi.mock("@/lib/actions/inhouse-booking", () => ({
  createInhouseBookingMultiAction: mocks.createBooking,
}));
vi.mock("@/lib/actions/attendance-queue", () => ({
  getAttendanceQueueSuggestionAction: async () => ({ success: true, suggestion: null }),
}));

import { QuickBookingForm } from "@/components/features/bookings/quick-booking-form";

const massageService = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Swedish Massage",
  durationMinutes: 60,
  price: 600,
  durationPolicy: "fixed" as const,
  availableInSpa: true,
  availableHomeService: true,
};

const facialService = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Signature Facial",
  durationMinutes: 45,
  price: 800,
  durationPolicy: "fixed" as const,
  availableInSpa: true,
  availableHomeService: true,
};

const staff1 = { id: "staff-1", name: "Maria Santos", serviceIds: [massageService.id, facialService.id] };
const staff2 = { id: "staff-2", name: "Anna Reyes", serviceIds: [massageService.id, facialService.id] };

const baseProps = {
  branchId: "11111111-1111-4111-8111-111111111111",
  branchName: "Main Spa",
  services: [massageService, facialService],
  staff: [staff1, staff2],
  resources: [],
  bookingRules: {
    inSpaStartTime: "10:00",
    inSpaEndTime: "22:00",
    homeServiceStartTime: "10:00",
    homeServiceEndTime: "20:00",
    homeServiceEnabled: true,
    maxAdvanceBookingDays: 30,
  },
  initialDate: "2026-11-02",
  initialTime: "14:00",
  initialName: "Sarah Organizer",
  initialPhone: "09171234567",
  initialServiceId: massageService.id,
  initialMode: "walkin" as const,
  successBehavior: "stay" as const,
};

describe("QuickBookingForm Failure Diagnostics & Form State Retention", () => {
  beforeEach(() => {
    mocks.createBooking.mockReset();
    mocks.fetch.mockReset().mockImplementation(async (url: string) => {
      if (url === "/api/booking/crm-availability") {
        return {
          ok: true,
          json: async () => ({
            available: true,
            slots: [{ slot_time: "14:00:00", available: true, staff_id: "staff-1", staff_name: "Maria Santos", staff_tier: "senior" }],
            providers: [
              { staffId: "staff-1", fullName: "Maria Santos", selectable: true, statusLabel: "Available", recommended: true },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(cleanup);

  it("displays persistent diagnostic card with affected guest and preserves entered form details when individual therapist is unavailable", async () => {
    mocks.createBooking.mockResolvedValueOnce({
      ok: false,
      code: "INDIVIDUAL_THERAPIST_UNAVAILABLE",
      title: "Therapist unavailable",
      message: "Second Guest: No qualified therapist is available at this time.",
      guestIndex: 1,
      guestName: "Second Guest",
      field: "staffId",
      correctiveAction: "Choose another available start time or review the selected service.",
      retrySafety: "safe",
    });

    render(<QuickBookingForm {...baseProps} />);

    // Add a second guest
    const addGuestBtn = screen.getByRole("button", { name: "Add Guest" });
    fireEvent.click(addGuestBtn);

    // Enter name and select service for second guest
    const secondGuestRegion = within(screen.getByRole("region", { name: "Guest 2 booking details" }));
    const nameInput = secondGuestRegion.getByRole("textbox", { name: "Guest 2 name" });
    fireEvent.change(nameInput, { target: { value: "Second Guest" } });
    fireEvent.click(secondGuestRegion.getByRole("button", { name: /^Signature Facial,/ }));

    // Submit the form
    const saveButton = screen.getByRole("button", { name: /Save Booking/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId("crm-booking-failure-card")).toBeDefined();
    });

    const card = screen.getByTestId("crm-booking-failure-card");
    expect(card.textContent).toContain("Therapist unavailable");
    expect(card.textContent).toContain("Second Guest: No qualified therapist is available at this time.");
    expect(card.textContent).toContain("Choose another available start time or review the selected service.");

    // Verify all form state remains intact (inputs are NOT cleared)
    expect(screen.getByDisplayValue("Sarah Organizer")).toBeDefined();
    expect(screen.getByDisplayValue("09171234567")).toBeDefined();
    expect(screen.getByDisplayValue("Second Guest")).toBeDefined();
    expect(screen.getAllByRole("region", { name: /Guest [1-2] booking details/ }).length).toBe(2);
  });

  it("displays group capacity explanation without misattributing to a single guest and preserves group draft", async () => {
    mocks.createBooking.mockResolvedValueOnce({
      ok: false,
      code: "GROUP_THERAPIST_CAPACITY_EXCEEDED",
      title: "Not enough therapists for this group",
      message: "Not enough distinct qualified therapists are available to serve all 2 guests simultaneously.",
      field: "staffId",
      correctiveAction: "Choose another start time or adjust the number of concurrent guests.",
      retrySafety: "safe",
    });

    render(<QuickBookingForm {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));
    const secondGuestRegion = within(screen.getByRole("region", { name: "Guest 2 booking details" }));
    fireEvent.click(secondGuestRegion.getByRole("button", { name: /^Signature Facial,/ }));

    const saveButton = screen.getByRole("button", { name: /Save Booking/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId("crm-booking-failure-card")).toBeDefined();
    });

    const card = screen.getByTestId("crm-booking-failure-card");
    expect(card.textContent).toContain("Not enough therapists for this group");
    expect(card.textContent).toContain("Not enough distinct qualified therapists are available");
    expect(card.textContent).toContain("Choose another start time or adjust the number of concurrent guests.");

    // Retains form inputs
    expect(screen.getByDisplayValue("Sarah Organizer")).toBeDefined();
    expect(screen.getAllByRole("region", { name: /Guest [1-2] booking details/ }).length).toBe(2);
  });

  it("displays concurrency conflict alert with verify_first retry safety on BOOKING_STAFF_TIME_CONFLICT", async () => {
    mocks.createBooking.mockResolvedValueOnce({
      ok: false,
      code: "BOOKING_STAFF_TIME_CONFLICT",
      title: "Therapist booked concurrently",
      message: "Another booking was just scheduled with this therapist at this exact time.",
      field: "staffId",
      correctiveAction: "Select another available therapist or choose a different start time.",
      retrySafety: "safe",
    });

    render(<QuickBookingForm {...baseProps} />);

    const saveButton = screen.getByRole("button", { name: /Save Booking/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId("crm-booking-failure-card")).toBeDefined();
    });

    const card = screen.getByTestId("crm-booking-failure-card");
    expect(card.textContent).toContain("Therapist booked concurrently");
    expect(card.textContent).toContain("Another booking was just scheduled with this therapist");
    expect(card.textContent).toContain("Select another available therapist or choose a different start time.");

    expect(screen.getByDisplayValue("Sarah Organizer")).toBeDefined();
  });

  it("displays Cash Flow instructions when cash drawer session is required", async () => {
    mocks.createBooking.mockResolvedValueOnce({
      ok: false,
      code: "CASH_DRAWER_SESSION_REQUIRED",
      title: "Cash drawer session required",
      message: "Cash payment cannot be accepted because there is no open cash drawer session for this branch. Open a cash drawer session in Cash Flow, or choose an electronic payment method.",
      field: "paymentMethod",
      correctiveAction: "Open a cash drawer session in Cash Flow, or switch to an electronic payment method.",
      retrySafety: "safe",
    });

    render(<QuickBookingForm {...baseProps} />);

    const saveButton = screen.getByRole("button", { name: /Save Booking/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId("crm-booking-failure-card")).toBeDefined();
    });

    const card = screen.getByTestId("crm-booking-failure-card");
    expect(card.textContent).toContain("Cash drawer session required");
    expect(card.textContent).toContain("Open a cash drawer session in Cash Flow");
  });

  it("displays persistent diagnostic card on client validation failure near Save button without clearing input", async () => {
    // Render with empty phone
    render(<QuickBookingForm {...baseProps} initialPhone="" />);

    const saveButton = screen.getByRole("button", { name: /Save Booking/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId("crm-booking-failure-card")).toBeDefined();
    });

    const card = screen.getByTestId("crm-booking-failure-card");
    expect(card.textContent).toContain("Incomplete booking details");
    expect(card.textContent).toContain("Please complete the highlighted fields before saving");

    // Client action was not invoked
    expect(mocks.createBooking).not.toHaveBeenCalled();

    // Organizer name preserved
    expect(screen.getByDisplayValue("Sarah Organizer")).toBeDefined();
  });

  it("displays verify_first warning on network interruption to prevent double bookings while preserving all entered draft data", async () => {
    mocks.createBooking.mockRejectedValueOnce(new Error("Network connection dropped during save"));

    render(<QuickBookingForm {...baseProps} />);

    const saveButton = screen.getByRole("button", { name: /Save Booking/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId("crm-booking-failure-card")).toBeDefined();
    });

    const card = screen.getByTestId("crm-booking-failure-card");
    expect(card.textContent).toContain("Booking confirmation could not be verified");
    expect(card.textContent).toContain("Check existing bookings");
    expect(card.textContent).toContain("Do not resubmit blindly");

    // Draft data preserved
    expect(screen.getByDisplayValue("Sarah Organizer")).toBeDefined();
    expect(screen.getByDisplayValue("09171234567")).toBeDefined();
  });
});
