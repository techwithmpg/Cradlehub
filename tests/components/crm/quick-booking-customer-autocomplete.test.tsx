// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

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
  it("keeps two Walk-in guest cards expanded with independent service choices and a shared start", () => {
    render(
      <QuickBookingForm
        {...props}
        initialMode="walkin"
        initialName="Test Guest"
        initialPhone="09171234567"
        services={[
          ...props.services,
          {
            id: "svc-2",
            name: "Facial",
            price: 700,
            durationMinutes: 90,
            availableInSpa: true,
            availableHomeService: false,
          },
        ]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));
    const first = screen.getByRole("region", { name: "Guest 1 booking details" });
    const second = screen.getByRole("region", { name: "Guest 2 booking details" });
    expect(within(first).getByRole("searchbox", { name: "Service" })).toBeTruthy();
    expect(within(second).getByRole("searchbox", { name: "Service" })).toBeTruthy();
    expect(within(first).getByLabelText("Guest 1 shared start time")).toBeTruthy();
    expect(within(second).getByLabelText("Guest 2 shared start time")).toBeTruthy();
    fireEvent.click(within(second).getByRole("button", { name: /Facial.*₱/ }));
    expect(
      within(second)
        .getByRole("button", { name: /Facial.*₱/ })
        .getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      within(first)
        .getByRole("button", { name: /Facial.*₱/ })
        .getAttribute("aria-pressed")
    ).toBe("false");
    fireEvent.change(within(second).getByLabelText("Guest 2 shared start time"), {
      target: { value: "15:00" },
    });
    expect(
      (within(first).getByLabelText("Guest 1 shared start time") as HTMLInputElement).value
    ).toBe("15:00");
    expect(screen.queryByRole("tablist", { name: "Guest sessions" })).toBeNull();
    expect(screen.queryByRole("dialog", { name: /services/i })).toBeNull();
  });

  it("does not submit a customer-requested single therapist as a soft group preference", async () => {
    render(
      <QuickBookingForm
        {...props}
        initialMode="walkin"
        initialDate="2026-10-22"
        initialName="Test Guest"
        initialPhone="09171234567"
        initialStaffId="staff-1"
        staff={[{ id: "staff-1", name: "Test Therapist", serviceIds: ["svc-1"] }]}
      />
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Customer requested this therapist" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Guest 2 name" }), {
      target: { value: "Second Guest" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Copy to Guest 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));
    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalledOnce());
    expect(mocks.createBooking.mock.calls[0]?.[0].staffId).toBeUndefined();
    expect(mocks.createBooking.mock.calls[0]?.[0].customerRequestedTherapist).toBe(false);
  });
  it("keeps Phone/Future guests expanded and submits attendee service associations", async () => {
    render(
      <QuickBookingForm
        {...props}
        initialName="Malcolm Owner"
        initialPhone="09171234567"
        services={[
          ...props.services,
          {
            id: "svc-2",
            name: "Facial",
            price: 700,
            durationMinutes: 90,
            availableInSpa: true,
            availableHomeService: false,
          },
        ]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));
    const first = within(screen.getByRole("region", { name: "Guest 1 booking details" }));
    const second = within(screen.getByRole("region", { name: "Guest 2 booking details" }));
    fireEvent.change(second.getByRole("textbox", { name: "Guest 2 name" }), {
      target: { value: "Anna Guest" },
    });
    fireEvent.change(second.getByRole("searchbox", { name: "Service" }), {
      target: { value: "Facial" },
    });
    fireEvent.click(second.getByRole("button", { name: /Facial.*₱/ }));
    expect(first.getByRole("searchbox", { name: "Service" })).toBeTruthy();
    expect((second.getByRole("textbox", { name: "Guest 2 name" }) as HTMLInputElement).value).toBe(
      "Anna Guest"
    );
    expect(screen.queryByRole("tablist", { name: "Guest sessions" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Room" })).toBeNull();
    expect(second.getAllByText(/Assigned automatically/).length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));
    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalledOnce());
    expect(mocks.createBooking.mock.calls[0]?.[0]).toMatchObject({
      bookingFor: "me_and_others",
      serviceIds: ["svc-1", "svc-2"],
      resourceId: undefined,
      attendees: [
        { name: "Malcolm Owner", isOrganizer: true, serviceIds: ["svc-1"] },
        { name: "Anna Guest", isOrganizer: false, serviceIds: ["svc-2"] },
      ],
    });
  });

  it("keeps four Phone/Future guest cards expanded with one vertical scroll area", () => {
    render(<QuickBookingForm {...props} initialName="Malcolm Owner" initialPhone="09171234567" />);
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Guest" }));

    expect(screen.getAllByRole("region", { name: /Guest [1-4] booking details/ })).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Add Guest" }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("tablist", { name: "Guest sessions" })).toBeNull();

    fireEvent.click(
      within(screen.getByRole("region", { name: "Guest 4 booking details" })).getByRole("button", {
        name: "Remove",
      })
    );
    expect(screen.getAllByRole("region", { name: /Guest [1-4] booking details/ })).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Add Guest" }).hasAttribute("disabled")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Add email" }));
    expect(screen.getByText("Email")).toBeTruthy();
  });

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
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Save Booking" }));
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
