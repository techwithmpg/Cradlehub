// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  prefill: vi.fn(),
  createBooking: vi.fn(),
  fetch: vi.fn(),
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

const props = {
  branchId: "sm",
  branchName: "SM Branch",
  initialMode: "standard_future" as const,
  initialDate: "2026-10-20",
  initialTime: "14:00",
  initialServiceId: "svc-1",
  bookingRules: {
    inSpaStartTime: "10:00",
    inSpaEndTime: "22:00",
    homeServiceEnabled: false,
    homeServiceStartTime: "10:00",
    homeServiceEndTime: "22:00",
    maxAdvanceBookingDays: 30,
  },
  services: [
    {
      id: "svc-1",
      name: "Massage",
      price: 800,
      durationMinutes: 60,
      availableInSpa: true,
      availableHomeService: false,
    },
  ],
  staff: [],
  resources: [],
  successBehavior: "stay" as const,
};

function response(body: object, ok = true) {
  return { ok, json: async () => body };
}

beforeEach(() => {
  mocks.prefill.mockReset().mockResolvedValue({
    ok: true,
    customer: {
      id: "customer-main",
      fullName: "Anna Reyes",
      phone: "09123454821",
      email: "anna@example.test",
    },
  });
  mocks.createBooking.mockReset().mockResolvedValue({ ok: true, bookingId: "booking-sm" });
  mocks.routerPush.mockReset();
  mocks.fetch.mockReset().mockImplementation(async (url: string) => {
    if (url.startsWith("/api/customers/search")) {
      return response({
        customers: [{ id: "customer-main", full_name: "Anna Reyes", phone_suffix: "4821" }],
      });
    }
    if (url === "/api/booking/crm-availability")
      return response({ available: true, providers: [], availableStaffIds: [] });
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Quick Booking customer name autocomplete", () => {
  it("searches under the single name field, masks matches, and reuses the global ID at SM", async () => {
    render(<QuickBookingForm {...props} />);
    const name = screen.getByRole("combobox", { name: "Customer name" }) as HTMLInputElement;
    expect(screen.queryByPlaceholderText("Customer name")).toBeNull();
    fireEvent.change(name, { target: { value: "Ann" } });
    expect(name.value).toBe("Ann");
    expect(screen.getByText("Searching customers…")).toBeTruthy();
    const match = await screen.findByRole("option", { name: /Anna Reyes/ });
    expect(match.textContent).toContain("•••• 4821");
    expect(match.textContent).not.toContain("09123454821");
    fireEvent.click(match);
    await waitFor(() => expect(screen.getByText("Existing customer selected")).toBeTruthy());
    expect(name.value).toBe("Anna Reyes");
    expect(mocks.prefill).toHaveBeenCalledWith({ customerId: "customer-main" });
    expect(mocks.routerPush).not.toHaveBeenCalled();
    expect(
      mocks.fetch.mock.calls.filter(([url]) => String(url).startsWith("/api/customers/search"))
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /schedule booking/i }));
    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalled());
    expect(mocks.createBooking.mock.calls[0]?.[0]).toMatchObject({
      branchId: "sm",
      customerId: "customer-main",
      fullName: "Anna Reyes",
      phone: "09123454821",
    });
  });

  it("clears the selected ID and old contact details when the name is edited", async () => {
    render(<QuickBookingForm {...props} />);
    const name = screen.getByRole("combobox", { name: "Customer name" }) as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Ann" } });
    fireEvent.click(await screen.findByRole("option", { name: /Anna Reyes/ }));
    await waitFor(() => expect(screen.getByText("Existing customer selected")).toBeTruthy());
    fireEvent.change(name, { target: { value: "Maria Santos" } });
    expect(screen.queryByText("Existing customer selected")).toBeNull();
    const phone = screen.getByPlaceholderText("Phone number") as HTMLInputElement;
    expect(phone.value).toBe("");
    fireEvent.change(phone, { target: { value: "09123456789" } });
    fireEvent.click(screen.getByRole("button", { name: /schedule booking/i }));
    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalled());
    expect(mocks.createBooking.mock.calls[0]?.[0]).toMatchObject({
      branchId: "sm",
      fullName: "Maria Santos",
      phone: "09123456789",
    });
    expect(mocks.createBooking.mock.calls[0]?.[0].customerId).toBeUndefined();
  });

  it("keeps free text through no results and search failure, with retry and keyboard selection", async () => {
    let failureCount = 0;
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url.startsWith("/api/customers/search")) {
        if (url.includes("Failure") && failureCount++ === 0) return response({}, false);
        if (url.includes("Anna"))
          return response({
            customers: [{ id: "customer-main", full_name: "Anna Reyes", phone_suffix: "4821" }],
          });
        return response({ customers: [] });
      }
      return response({ available: true, providers: [], availableStaffIds: [] });
    });
    render(<QuickBookingForm {...props} />);
    const name = screen.getByRole("combobox", { name: "Customer name" }) as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Maria Santos" } });
    expect(await screen.findByText("No matching customer found.")).toBeTruthy();
    expect(screen.getByRole("option", { name: /Use new customer/ })).toBeTruthy();
    fireEvent.change(name, { target: { value: "Failure" } });
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(name.value).toBe("Failure");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No matching customer found.")).toBeTruthy();
    expect(name.value).toBe("Failure");
    fireEvent.change(name, { target: { value: "Anna" } });
    await screen.findByRole("option", { name: /Anna Reyes/ });
    fireEvent.keyDown(name, { key: "ArrowDown" });
    fireEvent.keyDown(name, { key: "Enter" });
    await waitFor(() => expect(screen.getByText("Existing customer selected")).toBeTruthy());
  });

  it("submits a new customer after a no-result search without a separate search action", async () => {
    mocks.fetch.mockImplementation(async (url: string) =>
      url.startsWith("/api/customers/search")
        ? response({ customers: [] })
        : response({ available: true, providers: [], availableStaffIds: [] })
    );
    render(<QuickBookingForm {...props} />);
    const name = screen.getByRole("combobox", { name: "Customer name" }) as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Maria Santos" } });
    expect(await screen.findByText("No matching customer found.")).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: /Use new customer/ }));
    fireEvent.change(screen.getByPlaceholderText("Phone number"), {
      target: { value: "09123456789" },
    });
    fireEvent.click(screen.getByRole("button", { name: /schedule booking/i }));
    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalled());
    expect(mocks.createBooking.mock.calls[0]?.[0]).toMatchObject({
      branchId: "sm",
      fullName: "Maria Santos",
      phone: "09123456789",
    });
    expect(mocks.createBooking.mock.calls[0]?.[0].customerId).toBeUndefined();
  });

  it("ignores an older response after staff types a newer name", async () => {
    let resolveOlder!: (value: unknown) => void;
    let resolveNewer!: (value: unknown) => void;
    mocks.fetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/customers/search?q=Ann")) {
        return new Promise((resolve) => {
          resolveOlder = resolve;
        });
      }
      if (url.startsWith("/api/customers/search?q=Maria")) {
        return new Promise((resolve) => {
          resolveNewer = resolve;
        });
      }
      return Promise.resolve(response({ available: true, providers: [], availableStaffIds: [] }));
    });
    render(<QuickBookingForm {...props} />);
    const name = screen.getByRole("combobox", { name: "Customer name" }) as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Ann" } });
    await waitFor(() => expect(typeof resolveOlder).toBe("function"));
    fireEvent.change(name, { target: { value: "Maria" } });
    await waitFor(() => expect(typeof resolveNewer).toBe("function"));
    resolveNewer(
      response({ customers: [{ id: "maria", full_name: "Maria Santos", phone_suffix: "1234" }] })
    );
    expect(await screen.findByRole("option", { name: /Maria Santos/ })).toBeTruthy();
    resolveOlder(
      response({ customers: [{ id: "anna", full_name: "Anna Reyes", phone_suffix: "4821" }] })
    );
    await waitFor(() => expect(screen.queryByRole("option", { name: /Anna Reyes/ })).toBeNull());
    expect(name.value).toBe("Maria");
  });
});
