// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prefill: vi.fn(),
  createBooking: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.routerPush }) }));
vi.mock("@/lib/actions/administrative-booking", () => ({
  getAdministrativeBookingCustomerPrefillAction: mocks.prefill,
}));
vi.mock("@/lib/actions/inhouse-booking", () => ({
  createInhouseBookingMultiAction: mocks.createBooking,
}));
vi.mock("@/lib/actions/attendance-queue", () => ({
  getAttendanceQueueSuggestionAction: async () => ({ success: true, suggestion: null }),
}));

import { QuickBookingForm } from "@/components/features/bookings/quick-booking-form";
import type { QuickBookingServiceOption } from "@/components/features/bookings/quick-booking-form";
import type { ServiceLineQuote } from "@/lib/services/service-line-quote";

import { clearDurationQuotesCache } from "@/components/features/bookings/inline-service-duration-dropdown";

const branchId = "11111111-1111-4111-8111-111111111111";

const massage: QuickBookingServiceOption = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Swedish Massage",
  durationMinutes: 60,
  price: 600,
  durationPolicy: "extendable",
  quoteVersion: "a".repeat(64),
  availableInSpa: true,
  availableHomeService: true,
};

const fixedService: QuickBookingServiceOption = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Foot Reflexology",
  durationMinutes: 45,
  price: 450,
  durationPolicy: "fixed",
  availableInSpa: true,
  availableHomeService: true,
};

const defaultBookingRules = {
  inSpaStartTime: "10:00",
  inSpaEndTime: "22:00",
  homeServiceStartTime: "10:00",
  homeServiceEndTime: "20:00",
  homeServiceEnabled: true,
  maxAdvanceBookingDays: 30,
};

function quote(
  service: QuickBookingServiceOption,
  minutes: number,
  price: number,
  index: number
): ServiceLineQuote {
  return {
    serviceId: service.id,
    durationPolicy: "extendable",
    baseDurationMinutes: 60,
    selectedDurationMinutes: minutes,
    basePrice: service.price,
    extensionIncrementMinutes: 30,
    extensionPrice: 300,
    maximumDurationMinutes: 180,
    extensionUnits: index,
    calculatedPrice: price,
    quoteVersion: index === 0 ? service.quoteVersion! : String(index).repeat(64),
  };
}

const massageQuotes = [
  quote(massage, 60, 600, 0),
  quote(massage, 90, 900, 1),
  quote(massage, 120, 1200, 2),
];

function setupQuotesFetch(
  map = new Map<string, ServiceLineQuote[]>([[massage.id, massageQuotes]])
) {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("/api/booking/service-line-quotes") && init?.body) {
      const body = JSON.parse(String(init.body)) as { serviceId: string };
      const options = map.get(body.serviceId);
      if (options) {
        return { ok: true, json: async () => ({ options }) };
      }
    }
    return { ok: true, json: async () => ({ availableStaffIds: [] }) };
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

beforeEach(() => {
  clearDurationQuotesCache();
});

afterEach(() => {
  cleanup();
  clearDurationQuotesCache();
  vi.unstubAllGlobals();
});

describe("CRM Quick Booking inline service duration dropdown", () => {
  it("displays static duration badge for fixed-duration services without a dropdown", () => {
    render(
      <QuickBookingForm
        branchId={branchId}
        branchName="Main Branch"
        services={[fixedService]}
        staff={[]}
        resources={[]}
        bookingRules={defaultBookingRules}
        initialMode="walkin"
        initialDate="2026-10-17"
        initialTime="12:00"
      />
    );

    // Select the fixed service
    fireEvent.click(screen.getByText("Foot Reflexology"));

    // Selected services should show 45 min
    const badges = screen.getAllByText("45 min");
    expect(badges.length).toBeGreaterThan(0);

    // There should NOT be an adjust duration button
    expect(screen.queryByTitle("Adjust duration")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens an inline dropdown on click, shows server quotes, updates duration and price immediately without a modal", async () => {
    const fetcher = setupQuotesFetch();

    render(
      <QuickBookingForm
        branchId={branchId}
        branchName="Main Branch"
        services={[massage]}
        staff={[]}
        resources={[]}
        bookingRules={defaultBookingRules}
        initialMode="walkin"
        initialDate="2026-10-17"
        initialTime="12:00"
      />
    );

    // Select extendable service
    fireEvent.click(screen.getByText("Swedish Massage"));

    // Find the inline duration trigger
    const durationBtn = screen.getByTitle("Adjust duration");
    expect(durationBtn).toBeTruthy();
    expect(durationBtn.textContent).toContain("1h");

    // Click duration control to open dropdown
    fireEvent.click(durationBtn);

    // Verify fetch was called with CRM audience
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([url]) => String(url).includes("/api/booking/service-line-quotes"))
      ).toBe(true)
    );

    // Verify dropdown is open and displays duration options with prices
    const listbox = await screen.findByRole("listbox", { name: "Available durations" });
    expect(listbox).toBeTruthy();

    // Verify NO second modal dialog with Apply duration button exists
    expect(screen.queryByText(/Apply duration/i)).toBeNull();
    expect(screen.queryByText(/Choose a treatment duration/i)).toBeNull();

    // Verify options are listed
    expect(screen.getByRole("option", { name: /1h 30m/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /2h/ })).toBeTruthy();

    // Select 90 min (1h 30m)
    fireEvent.click(screen.getByRole("option", { name: /1h 30m/ }));

    // Dropdown closes and duration trigger updates immediately
    await waitFor(() => {
      expect(durationBtn.textContent).toContain("1h 30m");
    });

    // Check summary updates immediately (₱900)
    expect(screen.getAllByText(/₱900/).length).toBeGreaterThan(0);
  });

  it("retains separate duration selections for different guests", async () => {
    setupQuotesFetch();

    render(
      <QuickBookingForm
        branchId={branchId}
        branchName="Main Branch"
        services={[massage]}
        staff={[]}
        resources={[]}
        bookingRules={defaultBookingRules}
        initialMode="walkin"
        initialDate="2026-10-17"
        initialTime="12:00"
        initialName="Guest One"
        initialPhone="09171111111"
      />
    );

    // Guest 1 selects Swedish Massage
    fireEvent.click(screen.getByText("Swedish Massage"));

    // Add Guest 2
    fireEvent.click(screen.getByRole("button", { name: "+ Add guest" }));

    // Guest 2 selects Swedish Massage
    fireEvent.click(screen.getByText("Swedish Massage"));

    // Adjust Guest 2's duration to 120 min (2h)
    const guest2DurationBtn = screen.getByTitle("Adjust duration");
    fireEvent.click(guest2DurationBtn);
    const option2h = await screen.findByRole("option", { name: /2h/ });
    fireEvent.click(option2h);

    await waitFor(() => {
      expect(guest2DurationBtn.textContent).toContain("2h");
    });

    // Switch back to Guest 1 tab
    fireEvent.click(screen.getByRole("tab", { name: /Guest One/ }));

    // Guest 1's duration remains 1h (60 min)
    const guest1DurationBtn = screen.getByTitle("Adjust duration");
    expect(guest1DurationBtn.textContent).toContain("1h");

    // Switch back to Guest 2
    fireEvent.click(screen.getByRole("tab", { name: /Guest 2/ }));
    expect(screen.getByTitle("Adjust duration").textContent).toContain("2h");
  });

  it("displays a retryable error message when quote request fails", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (String(url).includes("/api/booking/service-line-quotes")) {
        return { ok: false, status: 500, json: async () => ({ error: "Network failure" }) };
      }
      return { ok: true, json: async () => ({ availableStaffIds: [] }) };
    });
    vi.stubGlobal("fetch", fetcher);

    render(
      <QuickBookingForm
        branchId={branchId}
        branchName="Main Branch"
        services={[massage]}
        staff={[]}
        resources={[]}
        bookingRules={defaultBookingRules}
        initialMode="walkin"
        initialDate="2026-10-17"
        initialTime="12:00"
      />
    );

    fireEvent.click(screen.getByText("Swedish Massage"));
    const durationBtn = screen.getByTitle("Adjust duration");
    fireEvent.click(durationBtn);

    // Should display the error message and retry button
    expect(await screen.findByText(/Service duration options could not be loaded/i)).toBeTruthy();
    const retryBtn = screen.getByRole("button", { name: "Retry" });
    expect(retryBtn).toBeTruthy();

    // Duration is kept as 1h
    expect(durationBtn.textContent).toContain("1h");
  });
});
