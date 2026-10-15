// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  loadOptions: vi.fn(),
  loadCustomer: vi.fn(),
}));

vi.mock("@/lib/actions/administrative-booking", () => ({
  getAdministrativeBookingOptionsAction: mocks.loadOptions,
  getAdministrativeBookingCustomerPrefillAction: mocks.loadCustomer,
}));
vi.mock("@/components/features/bookings/quick-booking-form", () => ({
  QuickBookingForm: ({ branchId }: { branchId: string }) => <div>Booking form for {branchId}</div>,
}));
vi.mock("@/components/shared/overlays", () => ({
  AdminDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  AdminOverlayBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConfirmUnsavedChangesDialog: () => null,
}));

import {
  AdministrativeBookingModalProvider,
  useAdministrativeBookingModal,
} from "@/components/features/bookings/administrative-booking-modal-provider";

function Entry() {
  const { openBookingModal } = useAdministrativeBookingModal();
  return (
    <>
      <p>Today ready</p>
      <button onClick={() => openBookingModal()}>New booking</button>
    </>
  );
}

beforeEach(() => {
  mocks.loadOptions.mockReset();
  mocks.loadCustomer.mockReset();
});
afterEach(cleanup);

describe("deferred Quick Booking options", () => {
  it("renders Today before options settle and waits inside the booking modal", async () => {
    let resolveOptions!: (value: unknown) => void;
    mocks.loadOptions.mockReturnValue(
      new Promise((resolve) => {
        resolveOptions = resolve;
      })
    );
    render(
      <AdministrativeBookingModalProvider branchId="sm" branchName="SM Branch">
        <Entry />
      </AdministrativeBookingModalProvider>
    );
    expect(screen.getByText("Today ready")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "New booking" }));
    expect(screen.getByText("Loading booking options…")).toBeTruthy();

    resolveOptions({
      branchId: "sm",
      options: { bookingRules: {}, services: [], staff: [], resources: [] },
    });
    expect(await screen.findByText("Booking form for sm")).toBeTruthy();
  });

  it("rejects a stale branch response and offers a retry", async () => {
    mocks.loadOptions.mockResolvedValue({
      branchId: "main",
      options: { bookingRules: {}, services: [], staff: [], resources: [] },
    });
    render(
      <AdministrativeBookingModalProvider branchId="sm" branchName="SM Branch">
        <Entry />
      </AdministrativeBookingModalProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "New booking" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("branch changed"));
    expect(screen.queryByText("Booking form for sm")).toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("does not reuse SM booking options while switching to Main", async () => {
    let resolveMain!: (value: unknown) => void;
    mocks.loadOptions
      .mockResolvedValueOnce({ branchId: "sm", options: { bookingRules: {}, services: [], staff: [], resources: [] } })
      .mockReturnValueOnce(new Promise((resolve) => { resolveMain = resolve; }));
    const view = render(
      <AdministrativeBookingModalProvider branchId="sm" branchName="SM Branch"><Entry /></AdministrativeBookingModalProvider>
    );
    await waitFor(() => expect(mocks.loadOptions).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "New booking" }));
    expect(await screen.findByText("Booking form for sm")).toBeTruthy();

    view.rerender(
      <AdministrativeBookingModalProvider branchId="main" branchName="Main Spa"><Entry /></AdministrativeBookingModalProvider>
    );
    expect(screen.queryByText("Booking form for sm")).toBeNull();
    expect(screen.getByText("Loading booking options…")).toBeTruthy();
    resolveMain({ branchId: "main", options: { bookingRules: {}, services: [], staff: [], resources: [] } });
    expect(await screen.findByText("Booking form for main")).toBeTruthy();
  });
});
