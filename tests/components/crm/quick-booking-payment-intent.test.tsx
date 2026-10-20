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
  expect(screen.getByText("Settle after service")).toBeTruthy();
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
});

describe("Quick Booking payment intent", () => {
  it.each(["walkin", "phone", "standard_future", "home_service"] as QuickBookingMode[])(
    "starts %s without received payment or an assumed tender",
    (initialMode) => {
      renderMode(initialMode);
      expectUnpaid();
    }
  );

  it.each(["phone", "standard_future", "home_service"] as QuickBookingMode[])(
    "switches %s to Walk-in without creating payment intent",
    (initialMode) => {
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
    for (const label of ["Walk-in", "Future", "Home Service", "Phone", "Walk-in"]) {
      fireEvent.click(modeButton(label));
      expectUnpaid();
    }
    fireEvent.click(screen.getByRole("button", { name: /Save Walk-in/i }));
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

  it("requires an explicit tender after payment is marked received and retains the atomic submit path", async () => {
    renderMode("walkin");
    fireEvent.click(paymentCheckbox());
    expect(
      (screen.getByRole("combobox", { name: "Payment method" }) as HTMLSelectElement).value
    ).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /Save Walk-in/i }));
    expect(screen.getByText("Please select a payment method.")).toBeTruthy();
    expect(mocks.createBooking).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("combobox", { name: "Payment method" }), {
      target: { value: "cash" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Walk-in/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /Save Walk-in/i }));
    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalledOnce());
    expect(mocks.createBooking.mock.calls[0]?.[0]).toMatchObject({
      paymentReceived: false,
      paymentMethod: undefined,
    });
  });
});
