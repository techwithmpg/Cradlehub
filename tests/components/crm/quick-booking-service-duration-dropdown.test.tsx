// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
import { InlineServiceDurationButtons } from "@/components/features/bookings/inline-service-duration-dropdown";
import type { QuickBookingServiceOption } from "@/components/features/bookings/quick-booking-form";
import type { ServiceLineQuote } from "@/lib/services/service-line-quote";

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

afterEach(() => {
  cleanup();
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
        initialMode="standard_future"
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

  it("shows server-quoted duration buttons in Phone/Future and updates price", async () => {
    const fetcher = setupQuotesFetch();
    render(
      <QuickBookingForm
        branchId={branchId}
        branchName="Main Branch"
        services={[massage]}
        staff={[]}
        resources={[]}
        bookingRules={defaultBookingRules}
        initialMode="standard_future"
        initialDate="2026-10-17"
        initialTime="12:00"
      />
    );
    fireEvent.click(screen.getByText("Swedish Massage"));
    const durations = screen.getByRole("group", { name: "Duration options for Swedish Massage" });
    const longer = await within(durations).findByRole("button", { name: "1h 30m" });
    fireEvent.click(longer);
    await waitFor(() => expect(longer.getAttribute("aria-pressed")).toBe("true"));
    expect(screen.getAllByText(/₱900/).length).toBeGreaterThan(0);
    expect(
      fetcher.mock.calls.filter(([url]) => String(url).includes("/api/booking/service-line-quotes"))
    ).toHaveLength(2);
    expect(screen.queryByText(/Apply duration/i)).toBeNull();
  });

  it("refreshes the authorized quote on every duration choice", async () => {
    const fetcher = setupQuotesFetch();
    render(
      <QuickBookingForm
        branchId={branchId}
        branchName="Main Branch"
        services={[massage]}
        staff={[]}
        resources={[]}
        bookingRules={defaultBookingRules}
        initialMode="phone"
        initialDate="2026-10-17"
        initialTime="12:00"
      />
    );
    fireEvent.click(screen.getByText("Swedish Massage"));
    const durations = screen.getByRole("group", { name: "Duration options for Swedish Massage" });
    fireEvent.click(await within(durations).findByRole("button", { name: "1h 30m" }));
    await waitFor(() =>
      expect(
        within(durations).getByRole("button", { name: "1h 30m" }).getAttribute("aria-pressed")
      ).toBe("true")
    );
    fireEvent.click(within(durations).getByRole("button", { name: "2h" }));
    await waitFor(() =>
      expect(
        within(durations).getByRole("button", { name: "2h" }).getAttribute("aria-pressed")
      ).toBe("true")
    );
    expect(
      fetcher.mock.calls.filter(([url]) => String(url).includes("/api/booking/service-line-quotes"))
    ).toHaveLength(3);
  });

  it("ignores an old duration response after the edited service changes", async () => {
    const pendingRequests: Array<
      (response: { ok: boolean; json: () => Promise<{ options: ServiceLineQuote[] }> }) => void
    > = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) =>
            pendingRequests.push(
              resolve as (response: {
                ok: boolean;
                json: () => Promise<{ options: ServiceLineQuote[] }>;
              }) => void
            )
          )
      )
    );
    const aroma: QuickBookingServiceOption = {
      ...massage,
      id: "44444444-4444-4444-8444-444444444444",
      name: "Aromatherapy",
    };
    const selected = vi.fn();
    const view = render(
      <InlineServiceDurationButtons
        key={massage.id}
        branchId={branchId}
        service={massage}
        deliveryMode="in_spa"
        onSelectQuote={selected}
      />
    );
    await waitFor(() => expect(pendingRequests).toHaveLength(1));
    view.rerender(
      <InlineServiceDurationButtons
        key={aroma.id}
        branchId={branchId}
        service={aroma}
        deliveryMode="in_spa"
        onSelectQuote={selected}
      />
    );
    await waitFor(() => expect(pendingRequests).toHaveLength(2));
    await act(async () =>
      pendingRequests[1]!({
        ok: true,
        json: async () => ({ options: [quote(aroma, 60, 600, 0), quote(aroma, 90, 900, 1)] }),
      })
    );
    expect(screen.getByRole("group", { name: "Duration options for Aromatherapy" })).toBeTruthy();
    await act(async () =>
      pendingRequests[0]!({ ok: true, json: async () => ({ options: massageQuotes }) })
    );
    expect(
      screen.queryByRole("group", { name: "Duration options for Swedish Massage" })
    ).toBeNull();
    expect(selected).not.toHaveBeenCalled();
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
    fireEvent.click(
      within(screen.getByRole("region", { name: "Guest 1 booking details" })).getByRole("button", {
        name: /Swedish Massage.*₱/,
      })
    );

    // Add Guest 2
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));

    // Guest 2 selects Swedish Massage
    fireEvent.click(
      within(screen.getByRole("region", { name: "Guest 2 booking details" })).getByRole("button", {
        name: /Swedish Massage.*₱/,
      })
    );

    // Walk-in shows server-quoted duration buttons in each expanded guest card.
    const guest2 = within(screen.getByRole("region", { name: "Guest 2 booking details" }));
    const guest2Durations = guest2.getByRole("group", {
      name: "Duration options for Swedish Massage",
    });
    const option2h = await within(guest2Durations).findByRole("button", { name: "2h" });
    fireEvent.click(option2h);

    await waitFor(() => {
      expect(option2h.getAttribute("aria-pressed")).toBe("true");
    });

    // Both cards remain expanded, with independent duration quotes.
    const guest1 = within(screen.getByRole("region", { name: "Guest 1 booking details" }));
    const guest1Durations = guest1.getByRole("group", {
      name: "Duration options for Swedish Massage",
    });
    expect(
      within(guest1Durations).getByRole("button", { name: "1h" }).getAttribute("aria-pressed")
    ).toBe("true");
    expect(guest2.getAllByText(/₱1,200/).length).toBeGreaterThan(0);
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
    // Should display the error message and retry button
    expect(await screen.findByText(/Service duration options could not be loaded/i)).toBeTruthy();
    const retryBtn = screen.getByRole("button", { name: "Retry durations" });
    expect(retryBtn).toBeTruthy();
    expect(screen.getAllByText(/1h/).length).toBeGreaterThan(0);
  });

  it("stacks four expanded Walk-in guests, reveals additions, and enforces the server limit", () => {
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
      />
    );

    const guestArea = document.querySelector(
      '[aria-label="Expanded guest booking cards"]'
    ) as HTMLDivElement;
    Object.defineProperty(guestArea, "scrollHeight", { configurable: true, value: 900 });
    expect(guestArea.className).toContain("overflow-x-hidden");
    expect(guestArea.className).toContain("lg:overflow-y-auto");
    expect(guestArea.children).toHaveLength(1);

    for (let count = 2; count <= 4; count += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));
      expect(guestArea.children).toHaveLength(count);
      expect(screen.getByRole("region", { name: `Guest ${count} booking details` })).toBeTruthy();
      expect(guestArea.scrollTop).toBe(900);
    }

    expect(screen.getByRole("button", { name: "Add Guest" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Current CRM booking contract supports up to 4 guests.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save Booking" })).toBeTruthy();
  });

  it("keeps duration quotes separate for two services on one Walk-in guest", async () => {
    const aroma: QuickBookingServiceOption = {
      ...massage,
      id: "44444444-4444-4444-8444-444444444444",
      name: "Aromatherapy",
      price: 700,
      quoteVersion: "b".repeat(64),
    };
    const fetcher = setupQuotesFetch(
      new Map([
        [massage.id, massageQuotes],
        [aroma.id, [quote(aroma, 60, 700, 0), quote(aroma, 90, 1000, 1)]],
      ])
    );
    render(
      <QuickBookingForm
        branchId={branchId}
        branchName="Main Branch"
        services={[massage, aroma]}
        staff={[]}
        resources={[]}
        bookingRules={defaultBookingRules}
        initialMode="walkin"
        initialDate="2026-10-17"
        initialTime="12:00"
      />
    );

    const guest = within(screen.getByRole("region", { name: "Guest 1 booking details" }));
    fireEvent.click(guest.getByRole("button", { name: /Swedish Massage.*₱600/ }));
    fireEvent.click(guest.getByRole("button", { name: /Aromatherapy.*₱700/ }));
    const editor = guest.getByRole("combobox", { name: "Service to adjust for Guest 1" });
    fireEvent.change(editor, { target: { value: aroma.id } });
    const aromaDurations = guest.getByRole("group", { name: "Duration options for Aromatherapy" });
    const longerAroma = await within(aromaDurations).findByRole("button", { name: "1h 30m" });
    fireEvent.click(longerAroma);
    await waitFor(() => expect(longerAroma.getAttribute("aria-pressed")).toBe("true"));

    fireEvent.change(editor, { target: { value: massage.id } });
    const massageDurations = guest.getByRole("group", {
      name: "Duration options for Swedish Massage",
    });
    expect(
      (await within(massageDurations).findByRole("button", { name: "1h" })).getAttribute(
        "aria-pressed"
      )
    ).toBe("true");
    expect((editor as HTMLSelectElement).selectedOptions[0]?.textContent).toContain("₱600");
    fireEvent.change(editor, { target: { value: aroma.id } });
    expect((editor as HTMLSelectElement).selectedOptions[0]?.textContent).toContain("₱1,000");
    expect(
      fetcher.mock.calls.filter(([url]) => String(url).includes("/api/booking/service-line-quotes"))
        .length
    ).toBeGreaterThanOrEqual(3);
  });
});
