// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

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

import {
  QuickBookingForm,
  type QuickBookingMode,
} from "@/components/features/bookings/quick-booking-form";
import { BOOKINGS_CHANGED_EVENT } from "@/lib/bookings/bookings-client-events";

const props = {
  branchId: "sm",
  branchName: "SM Branch",
  initialDate: "2026-10-20",
  initialTime: "14:00",
  initialName: "Maria Santos",
  initialPhone: "09171234567",
  initialServiceId: "svc-1",
  bookingRules: {
    inSpaStartTime: "00:00",
    inSpaEndTime: "23:59",
    homeServiceEnabled: true,
    homeServiceStartTime: "00:00",
    homeServiceEndTime: "23:59",
    maxAdvanceBookingDays: 30,
  },
  services: [
    {
      id: "svc-1",
      name: "Massage",
      price: 800,
      durationMinutes: 60,
      availableInSpa: true,
      availableHomeService: true,
    },
  ],
  staff: [],
  resources: [],
  successBehavior: "stay" as const,
};

function renderMode(initialMode: QuickBookingMode) {
  return render(<QuickBookingForm {...props} initialMode={initialMode} />);
}

function modeButton(label: string) {
  return screen.getByRole("button", { name: new RegExp(`^${label}`, "i") });
}

function paymentCheckbox() {
  return screen.getByRole("checkbox", {
    name: "Full advance payment received",
  }) as HTMLInputElement;
}

function expectUnpaid() {
  expect(paymentCheckbox().checked).toBe(false);
  expect(screen.queryByRole("combobox", { name: "Payment method" })).toBeNull();
  expect(screen.getAllByText(/Unpaid|Settle after service/).length).toBeGreaterThan(0);
}

beforeEach(() => {
  mocks.createBooking.mockReset().mockResolvedValue({ ok: true, bookingId: "booking-sm" });
  mocks.fetch.mockReset().mockImplementation(async (url: string) => {
    if (url === "/api/booking/crm-availability")
      return {
        ok: true,
        json: async () => ({ available: true, providers: [], availableStaffIds: [] }),
      };
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Quick Booking payment intent", () => {
  it.each(["walkin", "phone", "standard_future", "home_service"] as QuickBookingMode[])(
    "starts %s without received payment or an assumed tender",
    (initialMode: QuickBookingMode) => {
      renderMode(initialMode);
      expectUnpaid();
    }
  );

  it.each(["phone", "standard_future", "home_service"] as QuickBookingMode[])(
    "switches %s to Walk-in without creating payment intent",
    (initialMode: QuickBookingMode) => {
      renderMode(initialMode);
      fireEvent.click(modeButton("Walk-in"));
      expectUnpaid();
    }
  );

  it("clears payment intent through repeated mode changes and submits an unpaid Walk-in", async () => {
    renderMode("phone");
    fireEvent.click(paymentCheckbox());
    fireEvent.change(screen.getByRole("combobox", { name: "Payment method" }), {
      target: { value: "cash" },
    });
    for (const label of [
      "Walk-in",
      "Phone / Future",
      "Home Service",
      "Phone / Future",
      "Walk-in",
    ]) {
      fireEvent.click(modeButton(label));
      expectUnpaid();
    }
    fireEvent.click(screen.getByRole("button", { name: /Save Booking/i }));
    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalledOnce());
    expect(mocks.createBooking.mock.calls[0]?.[0]).toMatchObject({
      crmBookingMode: "walkin",
      paymentReceived: false,
      paymentMethod: undefined,
      fullName: "Maria Santos",
      phone: "09171234567",
      serviceIds: ["svc-1"],
    });
  });

  it("selects Phone / Future in one click and submits a later-today booking without arrival", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-26T02:00:00.000Z"));
    render(<QuickBookingForm {...props} initialMode="walkin" initialDate="2026-10-26" initialTime="14:00" />);
    expect(screen.getAllByRole("button", { name: /^(Walk-in|Phone \/ Future|Home Service)/i })).toHaveLength(3);
    fireEvent.click(modeButton("Phone / Future"));
    expect(modeButton("Phone / Future").getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("group", { name: "Booking source" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Call or message" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Scheduled in advance" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));
    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalledOnce());
    expect(mocks.createBooking.mock.calls[0]?.[0]).toMatchObject({
      crmBookingMode: "phone",
      date: "2026-10-26",
      startTime: "14:00:00",
      markArrived: false,
      paymentReceived: false,
      paymentMethod: undefined,
    });
  });

  it("uses the same Phone / Future flow for a future-date booking", async () => {
    render(<QuickBookingForm {...props} initialMode="walkin" initialDate="2026-10-27" initialTime="14:00" />);
    fireEvent.click(modeButton("Phone / Future"));
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));
    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalledOnce());
    expect(mocks.createBooking.mock.calls[0]?.[0]).toMatchObject({
      crmBookingMode: "phone", date: "2026-10-27", markArrived: false,
    });
  });

  it("notifies the workspace and the modal owner after a mocked Phone / Future save", async () => {
    const onSuccess = vi.fn();
    const onBookingsChanged = vi.fn();
    window.addEventListener(BOOKINGS_CHANGED_EVENT, onBookingsChanged);
    try {
      render(<QuickBookingForm {...props} initialMode="phone" onSuccess={onSuccess} />);
      fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));
      await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
        bookingId: "booking-sm", mode: "phone", isHomeService: false,
      }));
      expect(onBookingsChanged).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener(BOOKINGS_CHANGED_EVENT, onBookingsChanged);
    }
  });

  it("preserves a programmatic standard_future request after switching through another mode", async () => {
    renderMode("standard_future");
    fireEvent.click(modeButton("Home Service"));
    fireEvent.click(modeButton("Phone / Future"));
    expect(modeButton("Phone / Future").getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("group", { name: "Booking source" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));
    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalledOnce());
    expect(mocks.createBooking.mock.calls[0]?.[0]).toMatchObject({
      crmBookingMode: "standard_future", markArrived: false,
    });
  });

  it("still rejects incomplete Phone / Future details", () => {
    render(<QuickBookingForm {...props} initialMode="walkin" initialPhone="" />);
    fireEvent.click(modeButton("Phone / Future"));
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));
    expect(screen.getByText("Enter the customer's phone number.")).toBeTruthy();
    expect(mocks.createBooking).not.toHaveBeenCalled();
  });

  it("still blocks a Phone / Future slot rejected by exact availability", async () => {
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url === "/api/booking/crm-availability")
        return { ok: true, json: async () => ({ available: false, message: "Selected time is unavailable." }) };
      throw new Error(`Unexpected request ${url}`);
    });
    renderMode("walkin");
    fireEvent.click(modeButton("Phone / Future"));
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));
    await waitFor(() =>
      expect(screen.getAllByText("Selected time is unavailable.").length).toBeGreaterThan(0)
    );
    expect(mocks.createBooking).not.toHaveBeenCalled();
  });

  it("requires an explicit tender after payment is marked received and retains the atomic submit path", async () => {
    renderMode("walkin");
    fireEvent.click(paymentCheckbox());
    expect(
      (screen.getByRole("combobox", { name: "Payment method" }) as HTMLSelectElement).value
    ).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /Save Booking/i }));
    expect(screen.getByText("Please select a payment method.")).toBeTruthy();
    expect(mocks.createBooking).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("combobox", { name: "Payment method" }), {
      target: { value: "cash" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Booking/i }));
    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalledOnce());
    expect(mocks.createBooking.mock.calls[0]?.[0]).toMatchObject({
      paymentReceived: true,
      paymentMethod: "cash",
      idempotencyKey: expect.any(String),
    });
  });

  it("does not retain a selected tender when payment received is cleared", async () => {
    renderMode("walkin");
    fireEvent.click(paymentCheckbox());
    fireEvent.change(screen.getByRole("combobox", { name: "Payment method" }), {
      target: { value: "gcash" },
    });
    fireEvent.click(paymentCheckbox());
    expectUnpaid();
    fireEvent.click(screen.getByRole("button", { name: /Save Booking/i }));
    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalledOnce());
    expect(mocks.createBooking.mock.calls[0]?.[0]).toMatchObject({
      paymentReceived: false,
      paymentMethod: undefined,
    });
  });
});
