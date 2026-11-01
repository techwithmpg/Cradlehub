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
vi.mock("@/components/public/places-autocomplete", () => ({
  PlacesAutocomplete: ({ onPlaceSelect }: { onPlaceSelect: (place: unknown) => void }) => (
    <>
      <button
        type="button"
        onClick={() =>
          onPlaceSelect({
            formattedAddress: "123 Acacia Street, Makati City",
            lat: 14.55321,
            lng: 121.02456,
            placeId: "verified-place-1",
            addressComponents: [],
            mapUrl: "https://www.google.com/maps/search/?api=1&query=14.55321,121.02456",
            source: "google_places",
          })
        }
      >
        Choose verified destination
      </button>
      <button
        type="button"
        onClick={() =>
          onPlaceSelect({
            formattedAddress: "Unverified address",
            lat: 14.5,
            lng: 121,
            placeId: "",
            addressComponents: [],
            mapUrl: "https://www.google.com/maps",
            source: "google_places",
          })
        }
      >
        Choose unverified destination
      </button>
    </>
  ),
}));

import { QuickBookingForm } from "@/components/features/bookings/quick-booking-form";

const service = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Swedish Massage",
  durationMinutes: 60,
  price: 600,
  durationPolicy: "fixed" as const,
  availableInSpa: true,
  availableHomeService: true,
};
const staffId = "33333333-3333-4333-8333-333333333333";
const secondStaffId = "44444444-4444-4444-8444-444444444444";
const props = {
  branchId: "11111111-1111-4111-8111-111111111111",
  branchName: "Main Spa",
  services: [service],
  staff: [
    { id: staffId, name: "Maria Santos", serviceIds: [service.id] },
    { id: secondStaffId, name: "Anna Reyes", serviceIds: [service.id] },
  ],
  resources: [],
  bookingRules: {
    inSpaStartTime: "10:00",
    inSpaEndTime: "22:00",
    homeServiceStartTime: "10:00",
    homeServiceEndTime: "20:00",
    homeServiceEnabled: true,
    maxAdvanceBookingDays: 30,
  },
  initialDate: "2026-10-22",
  initialTime: "14:00",
  initialName: "Test Guest",
  initialPhone: "09171234567",
  initialServiceId: service.id,
  successBehavior: "stay" as const,
};

beforeEach(() => {
  mocks.createBooking.mockReset().mockResolvedValue({ ok: true, bookingId: "booking-1" });
  mocks.fetch.mockReset().mockImplementation(async (url: string) => {
    if (url === "/api/home-service/distance")
      return {
        ok: true,
        json: async () => ({
          distanceKm: 8.5,
          distanceSource: "google_driving",
          freeKm: 5,
          extraKm: 3.5,
          feePerExtraKm: 50,
          travelFee: 175,
        }),
      };
    if (url === "/api/booking/crm-availability")
      return {
        ok: true,
        json: async () => ({
          available: true,
          availableStaffIds: [staffId, secondStaffId],
          slots: [{ staff_id: staffId, slot_time: "14:30", available: true }],
          providers: [
            {
              staffId,
              fullName: "Maria Santos",
              nickname: null,
              selectable: true,
              recommended: true,
              statusLabel: "Scheduled · Available",
              availableAtTime: true,
              scheduledAtTime: true,
              scheduledForDay: true,
              checkedIn: false,
              checkedOut: false,
            },
            {
              staffId: secondStaffId,
              fullName: "Anna Reyes",
              nickname: null,
              selectable: true,
              recommended: false,
              statusLabel: "Scheduled · Available",
              availableAtTime: true,
              scheduledAtTime: true,
              scheduledForDay: true,
              checkedIn: false,
              checkedOut: false,
            },
          ],
        }),
      };
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Unified CRM booking modes", () => {
  it("keeps a verified Home Service GPS destination and travel preview outside the guest editor", async () => {
    render(<QuickBookingForm {...props} initialMode="home_service" />);
    expect(screen.getByText("Service Location")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Guest 1 booking details" })).toBeTruthy();
    expect(screen.queryByText("Room")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Choose verified destination" }));
    expect(screen.getByText(/Location confirmed/).textContent).toContain("123 Acacia Street");
    expect(screen.queryByLabelText("Verified destination coordinates")).toBeNull();
    expect(screen.getByRole("link", { name: "Review map" }).getAttribute("href")).toContain(
      "google.com/maps"
    );
    await waitFor(() => expect(screen.getByText("Transportation fee")).toBeTruthy());
    await waitFor(() => expect(screen.getAllByText(/₱175/).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));
    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalledOnce());
    expect(mocks.createBooking.mock.calls[0]?.[0]).toMatchObject({
      type: "home_service",
      crmBookingMode: "home_service",
      homeServicePlaceId: "verified-place-1",
      homeServiceLat: 14.55321,
      homeServiceLng: 121.02456,
      resourceId: undefined,
      paymentReceived: false,
    });
    expect(
      mocks.fetch.mock.calls.some(([url]) => url === "/api/home-service/distance")
    ).toBe(true);
  });

  it("refuses an unverified GPS result without a Places identity", () => {
    render(<QuickBookingForm {...props} initialMode="home_service" />);
    fireEvent.click(screen.getByRole("button", { name: "Choose unverified destination" }));
    expect(screen.queryByLabelText("Verified destination coordinates")).toBeNull();
    expect(screen.getByText(/Please select a valid address from the search results/)).toBeTruthy();
    expect(
      mocks.fetch.mock.calls.some(([url]) => url === "/api/home-service/distance")
    ).toBe(false);
  });

  it("shows a suggested therapist in one dropdown and persists an explicit single-guest choice", async () => {
    render(<QuickBookingForm {...props} initialMode="walkin" />);
    const first = within(screen.getByRole("region", { name: "Guest 1 booking details" }));
    const selector = first.getByRole("combobox", { name: "Guest 1 therapist" });
    await waitFor(() =>
      expect(
        within(selector).getByRole("option", { name: /Maria Santos · Suggested/ })
      ).toBeTruthy()
    );
    fireEvent.change(selector, { target: { value: staffId } });
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));
    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalledOnce());
    expect(mocks.createBooking.mock.calls[0]?.[0]).toMatchObject({
      staffId,
      customerRequestedTherapist: false,
    });
  });

  it("keeps Automatic available after an explicit single-guest choice", async () => {
    render(<QuickBookingForm {...props} initialMode="walkin" />);
    const first = within(screen.getByRole("region", { name: "Guest 1 booking details" }));
    const selector = first.getByRole("combobox", { name: "Guest 1 therapist" });
    await waitFor(() => expect(selector.hasAttribute("disabled")).toBe(false));
    fireEvent.change(selector, { target: { value: staffId } });
    fireEvent.change(selector, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));
    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalledOnce());
    expect(mocks.createBooking.mock.calls[0]?.[0].staffId).toBeUndefined();
  });

  it("enforces automatic therapist allocation in group mode and saves cleanly", async () => {
    render(<QuickBookingForm {...props} initialMode="standard_future" />);
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));
    const first = within(screen.getByRole("region", { name: "Guest 1 booking details" }));
    const second = within(screen.getByRole("region", { name: "Guest 2 booking details" }));
    fireEvent.change(second.getByRole("textbox", { name: "Guest 2 name" }), {
      target: { value: "Guest Two" },
    });
    fireEvent.click(second.getByRole("button", { name: /^Swedish Massage,/ }));
    expect(first.getByRole("combobox", { name: "Guest 1 therapist" })).toBeTruthy();
    expect(second.getByLabelText("Guest 2 therapist")).toBeTruthy();
    expect(second.getByText(/Assigned automatically on Save/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));
    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalledOnce());
    expect(mocks.createBooking.mock.calls[0]?.[0]).toMatchObject({
      bookingFor: "me_and_others",
      staffId: undefined,
      customerRequestedTherapist: false,
      attendees: [
        { name: "Test Guest", isOrganizer: true, serviceIds: [service.id] },
        { name: "Guest Two", isOrganizer: false, serviceIds: [service.id] },
      ],
    });
  });

  it("paginates four guest summaries while keeping Save available", () => {
    render(<QuickBookingForm {...props} initialMode="standard_future" />);
    for (let index = 0; index < 3; index += 1)
      fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));
    expect(screen.getByText("Guests 1–2 of 4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next summary guests" }));
    expect(screen.getByText("Guests 3–4 of 4")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save Booking" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous summary guests" }));
    expect(screen.getByText("Guests 1–2 of 4")).toBeTruthy();
  });

  it.each([5, 10, 20])(
    "renders %i vertically stacked guest cards in a non-submitting preview",
    (count: number) => {
      const started = performance.now();
      render(<QuickBookingForm {...props} initialMode="walkin" previewGuestCapacity={count} />);
      for (let index = 1; index < count; index += 1)
        fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));
      expect(screen.getAllByRole("region", { name: /^Guest \d+ booking details$/ })).toHaveLength(
        count
      );
      expect(screen.getByRole("region", { name: "Guest 1 booking details" })).toBeTruthy();
      expect(screen.getByRole("region", { name: `Guest ${count} booking details` })).toBeTruthy();
      expect(screen.getByLabelText("Expanded guest booking cards").className).toContain(
        "lg:overflow-y-auto"
      );
      expect(screen.getByText(new RegExp(`Guests & services \\(${count}\\)`))).toBeTruthy();
      expect(screen.getByRole("button", { name: "Save Booking" }).hasAttribute("disabled")).toBe(
        true
      );
      expect(screen.getByText(/layout preview only and cannot be saved/)).toBeTruthy();
      console.info(
        `Guest layout ${count}: ${(performance.now() - started).toFixed(0)} ms in jsdom`
      );
    },
    15000
  );

  it("offers only server-returned Phone/Future time slots", async () => {
    render(<QuickBookingForm {...props} initialMode="standard_future" />);
    const slots = await screen.findByRole("group", { name: "Available booking slots for Guest 1" });
    fireEvent.click(within(slots).getByRole("button", { name: "2:30 PM" }));
    expect((screen.getByLabelText("Guest 1 shared start time") as HTMLInputElement).value).toBe(
      "14:30"
    );
    expect(
      within(slots).getByRole("button", { name: "2:30 PM" }).getAttribute("aria-pressed")
    ).toBe("true");
  });
});
