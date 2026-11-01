// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createBooking: vi.fn(), fetch: vi.fn() }));
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
const staff3 = { id: "staff-3", name: "Elena Cruz", serviceIds: [massageService.id, facialService.id] };
const staff4 = { id: "staff-4", name: "Grace Lim", serviceIds: [massageService.id, facialService.id] };

const baseProps = {
  branchId: "11111111-1111-4111-8111-111111111111",
  branchName: "Main Spa",
  services: [massageService, facialService],
  staff: [staff1, staff2, staff3, staff4],
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

beforeEach(() => {
  mocks.createBooking.mockReset().mockResolvedValue({ ok: true, bookingId: "booking-order-1" });
  mocks.fetch.mockReset().mockImplementation(async (url: string) => {
    if (url === "/api/booking/crm-availability") {
      return {
        ok: true,
        json: async () => ({
          available: true,
          slots: [{ slot_time: "14:00:00", available: true, staff_id: "staff-1", staff_name: "Maria Santos", staff_tier: "senior" }],
          providers: [
            { staffId: "staff-1", fullName: "Maria Santos", selectable: true, statusLabel: "Available", recommended: true },
            { staffId: "staff-2", fullName: "Anna Reyes", selectable: true, statusLabel: "Available", recommended: false },
          ],
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(cleanup);

describe("CRM Multi-Guest Booking Save Component Lifecycle", () => {
  it("shows inline explanation, blocks save, and offers deliberate preference/return choices when adding guest after customer requested therapist", async () => {
    render(
      <QuickBookingForm
        {...baseProps}
        initialStaffId="staff-1"
      />
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Customer requested this therapist" }));
    expect((screen.getByRole("checkbox", { name: "Customer requested this therapist" }) as HTMLInputElement).checked).toBe(true);

    // Click Add Guest
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));

    // Inline explanation appears
    expect(screen.getByRole("alert", { name: "Exact therapist unsupported" })).toBeTruthy();
    expect(screen.getByText(/Exact therapist allocation is unsupported for group bookings/i)).toBeTruthy();

    // Select service for Guest 2
    const guest2Region = within(screen.getByRole("region", { name: "Guest 2 booking details" }));
    fireEvent.click(guest2Region.getByRole("button", { name: /^Signature Facial,/ }));

    // Attempting Save is blocked
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));
    expect(mocks.createBooking).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Exact therapist allocation is unsupported for group bookings/i).length).toBeGreaterThanOrEqual(1);

    // Click "Return to single booking"
    fireEvent.click(screen.getByRole("button", { name: "Return to single booking" }));
    // Guest 2 is removed, returning to single-guest mode with customer request intact
    expect(screen.queryByRole("region", { name: "Guest 2 booking details" })).toBeNull();
    const restoredCheckbox = screen.getByRole("checkbox", { name: "Customer requested this therapist" }) as HTMLInputElement;
    expect(restoredCheckbox).toBeTruthy();
    expect(restoredCheckbox.checked).toBe(true);

    // Click Add Guest again
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));
    const guest2RegionAgain = within(screen.getByRole("region", { name: "Guest 2 booking details" }));
    fireEvent.click(guest2RegionAgain.getByRole("button", { name: /^Signature Facial,/ }));

    // Now click "Proceed with non-guaranteed preference"
    fireEvent.click(screen.getByRole("button", { name: "Proceed with non-guaranteed preference" }));
    expect(screen.queryByText(/Exact therapist allocation is unsupported for group bookings/i)).toBeNull();

    // Label reflects soft preference
    expect(screen.getByText("Preferred therapist (Organizer)")).toBeTruthy();
    expect(screen.getByText(/Soft preference for Organizer — not guaranteed/i)).toBeTruthy();

    // Save Booking now succeeds with staffId as soft preference and customerRequestedTherapist: false
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));
    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalledOnce());
    expect(mocks.createBooking.mock.calls[0]?.[0]).toMatchObject({
      staffId: "staff-1",
      customerRequestedTherapist: false,
    });
  });

  it("submits 2 guests with blank guest name safely defaulted to Guest 2", async () => {
    render(<QuickBookingForm {...baseProps} initialMode="walkin" />);
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));

    const secondGuestRegion = within(screen.getByRole("region", { name: "Guest 2 booking details" }));
    const nameInput = secondGuestRegion.getByRole("textbox", { name: "Guest 2 name" }) as HTMLInputElement;
    expect(nameInput.placeholder).toBe("Guest name (e.g. Guest 2)");
    expect(nameInput.value).toBe("");

    // Select service for Guest 2 without entering a custom name
    fireEvent.click(secondGuestRegion.getByRole("button", { name: /^Signature Facial,/ }));

    // Click Save Booking
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));

    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalledOnce());
    const payload = mocks.createBooking.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      bookingFor: "me_and_others",
      staffId: undefined,
      customerRequestedTherapist: false,
      resourceId: undefined,
      attendees: [
        { name: "Sarah Organizer", isOrganizer: true, serviceIds: [massageService.id] },
        { name: "Guest 2", isOrganizer: false, serviceIds: [facialService.id] },
      ],
    });
  });

  it("submits 3 guests with custom names and sequential multi-services", async () => {
    render(<QuickBookingForm {...baseProps} initialMode="standard_future" />);
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));

    const g1 = within(screen.getByRole("region", { name: "Guest 1 booking details" }));
    const g2 = within(screen.getByRole("region", { name: "Guest 2 booking details" }));
    const g3 = within(screen.getByRole("region", { name: "Guest 3 booking details" }));

    // Guest 1 selects a second service (Massage + Facial)
    fireEvent.click(g1.getByRole("button", { name: /^Signature Facial,/ }));

    // Guest 2 custom name + Facial
    fireEvent.change(g2.getByRole("textbox", { name: "Guest 2 name" }), { target: { value: "Bob Smith" } });
    fireEvent.click(g2.getByRole("button", { name: /^Signature Facial,/ }));

    // Guest 3 custom name + Massage
    fireEvent.change(g3.getByRole("textbox", { name: "Guest 3 name" }), { target: { value: "Charlie Brown" } });
    fireEvent.click(g3.getByRole("button", { name: /^Swedish Massage,/ }));

    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));

    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalledOnce());
    const payload = mocks.createBooking.mock.calls[0]?.[0];
    expect(payload.attendees).toHaveLength(3);
    expect(payload.attendees[0]).toMatchObject({
      name: "Sarah Organizer",
      isOrganizer: true,
      serviceIds: [massageService.id, facialService.id],
    });
    expect(payload.attendees[1]).toMatchObject({
      name: "Bob Smith",
      isOrganizer: false,
      serviceIds: [facialService.id],
    });
    expect(payload.attendees[2]).toMatchObject({
      name: "Charlie Brown",
      isOrganizer: false,
      serviceIds: [massageService.id],
    });
  });

  it("submits 4 guests in a single modal interaction", async () => {
    render(<QuickBookingForm {...baseProps} initialMode="walkin" />);
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));

    expect(screen.getAllByRole("region", { name: /Guest [1-4] booking details/ })).toHaveLength(4);

    // Provide services for Guests 2, 3, 4
    for (let i = 2; i <= 4; i++) {
      const region = within(screen.getByRole("region", { name: `Guest ${i} booking details` }));
      fireEvent.click(region.getByRole("button", { name: /^Swedish Massage,/ }));
    }

    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));

    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalledOnce());
    const payload = mocks.createBooking.mock.calls[0]?.[0];
    expect(payload.attendees).toHaveLength(4);
    expect(payload.attendees.map((a: { name: string }) => a.name)).toEqual([
      "Sarah Organizer",
      "Guest 2",
      "Guest 3",
      "Guest 4",
    ]);
  });

  it("validates missing service with targeted error for the specific guest", () => {
    render(<QuickBookingForm {...baseProps} initialMode="walkin" />);
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));

    // Guest 2 has no service selected
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));

    expect(screen.getByText("Select at least one service for Guest 2.")).toBeTruthy();
    expect(mocks.createBooking).not.toHaveBeenCalled();
  });

  it("validates guest name length when a single character is entered", () => {
    render(<QuickBookingForm {...baseProps} initialMode="walkin" />);
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));

    const secondGuestRegion = within(screen.getByRole("region", { name: "Guest 2 booking details" }));
    fireEvent.change(secondGuestRegion.getByRole("textbox", { name: "Guest 2 name" }), {
      target: { value: "A" },
    });
    fireEvent.click(secondGuestRegion.getByRole("button", { name: /^Swedish Massage,/ }));

    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));

    expect(screen.getByText("Guest names must be at least 2 characters.")).toBeTruthy();
    expect(mocks.createBooking).not.toHaveBeenCalled();
  });

  it("restores single-mode manual therapist picker when all additional guests are removed", async () => {
    render(<QuickBookingForm {...baseProps} initialMode="walkin" />);
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));

    // Guest 2 has Automatic indicator
    const secondGuestRegion = within(screen.getByRole("region", { name: "Guest 2 booking details" }));
    expect(secondGuestRegion.getByText(/Assigned automatically on Save/)).toBeTruthy();

    // Remove Guest 2
    fireEvent.click(secondGuestRegion.getByRole("button", { name: "Remove" }));

    // Back to 1 guest: the single-guest therapist combobox is restored
    const guest1Region = within(screen.getByRole("region", { name: "Guest 1 booking details" }));
    const combobox = guest1Region.getByRole("combobox", { name: "Guest 1 therapist" });
    expect(combobox).toBeTruthy();
    expect(screen.queryByText(/Assigned automatically on Save/)).toBeNull();
  });

  it("requires a coordinating provider when a consultation package is selected in a group booking", async () => {
    const consultationPackage = {
      id: "44444444-4444-4444-4444-444444444444",
      name: "Heavenly Harmony Couples or Besties Spa",
      durationMinutes: 120,
      price: 2500,
      durationPolicy: "fixed" as const,
      availableInSpa: true,
      availableHomeService: false,
      categoryName: "Spa Packages",
    };

    render(
      <QuickBookingForm
        {...baseProps}
        services={[...baseProps.services, consultationPackage]}
        staff={baseProps.staff.map((s) => ({
          ...s,
          serviceIds: [...s.serviceIds, consultationPackage.id],
        }))}
        initialServiceId={consultationPackage.id}
        initialStaffId=""
      />
    );

    // Add Guest 2
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));
    const secondGuestRegion = within(screen.getByRole("region", { name: "Guest 2 booking details" }));
    fireEvent.click(secondGuestRegion.getByRole("button", { name: /^Signature Facial,/ }));

    // Verify Guest 1 has label "Coordinating provider"
    const guest1Region = within(screen.getByRole("region", { name: "Guest 1 booking details" }));
    expect(guest1Region.getByText("Coordinating provider")).toBeTruthy();

    // Click Save without choosing coordinating provider -> validation error
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));
    expect(screen.getByText("Select a coordinating provider for this package.")).toBeTruthy();
    expect(mocks.createBooking).not.toHaveBeenCalled();

    // Select coordinating provider for Guest 1
    const staffSelect = guest1Region.getByRole("combobox", { name: "Guest 1 therapist" });
    await waitFor(() =>
      expect(within(staffSelect).getByRole("option", { name: /Maria Santos/ })).toBeTruthy()
    );
    fireEvent.change(staffSelect, { target: { value: "staff-1" } });

    // Now Save Booking -> succeeds with staffId: "staff-1"
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));
    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalledOnce());
    expect(mocks.createBooking.mock.calls[0]?.[0]).toMatchObject({
      bookingFor: "me_and_others",
      staffId: "staff-1",
      customerRequestedTherapist: false,
    });
  });
});
