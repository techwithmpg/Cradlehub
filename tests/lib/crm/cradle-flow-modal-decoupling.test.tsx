// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { openBookingModal, loadContext, modalProps, quickProps } = vi.hoisted(() => ({
  openBookingModal: vi.fn(),
  loadContext: vi.fn(),
  modalProps: vi.fn(),
  quickProps: vi.fn(),
}));

vi.mock("@/components/features/bookings/administrative-booking-modal-provider", () => ({
  useAdministrativeBookingModal: () => ({ openBookingModal }),
}));
vi.mock("@/lib/cash-flow/financial-entry-context", () => ({
  loadFinancialEntryContextAction: loadContext,
}));
vi.mock("@/components/features/cash-flow/record-financial-entry-modal", () => ({
  RecordFinancialEntryModal: (props: { onSuccess: () => void }) => {
    modalProps(props);
    return <div role="dialog" aria-label="Existing financial entry modal"><button onClick={props.onSuccess}>Complete entry</button></div>;
  },
}));
vi.mock("@/components/features/crm/today/cradle-flow-quick-payment-modal", () => ({
  isQuickPaymentEligible: (order: { remainingBalance: number; sourceKind: string; paymentEligible: boolean }) =>
    order.remainingBalance > 0 && (order.sourceKind !== "booking_order" || order.paymentEligible),
  CradleFlowQuickPaymentModal: (props: {
    data: unknown;
    error?: string | null;
    requestedOrderId?: string;
    allowLegacyCheckout?: boolean;
    onSuccess: () => void;
    onLegacyCheckout: () => void;
  }) => {
    quickProps(props);
    return <div role="dialog" aria-label="Quick payment modal">
      {props.error ? <p role="alert">{props.error}</p> : null}
      <button onClick={props.onSuccess}>Complete entry</button>
      {props.error && props.allowLegacyCheckout ?
        <button onClick={props.onLegacyCheckout}>Open Booking Checkout</button> : null}
    </div>;
  },
}));
vi.mock("@/components/shared/overlays", () => ({
  AdminDialog: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div>,
  AdminOverlayHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
  AdminOverlayBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdminOverlayFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { CradleFlowActions } from "@/components/features/crm/today/cradle-flow-actions";
import { CradleFlowFinancialEntry } from "@/components/features/crm/today/cradle-flow-financial-entry";

const financialContext = {
  ok: true,
  data: {
    branchId: "branch-1",
    businessDate: "2026-09-30",
    accounts: [{ id: "account-1" }],
    expenseCategories: [],
    staffOptions: [],
    payableOrders: [{ id: "order-1", sourceKind: "booking_order", remainingBalance: 100, paymentEligible: true }],
    cashSessions: { activeSessions: [], availableDrawers: [] },
  },
};

describe("Cradle Flow workflow modals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/crm/today");
    loadContext.mockResolvedValue(financialContext);
  });

  afterEach(cleanup);

  it("opens booking and financial workflows without leaving Cradle Flow", () => {
    const onOpenFinancialEntry = vi.fn();
    render(<CradleFlowActions pendingBooking={null} onResumePending={vi.fn()} onOpenFinancialEntry={onOpenFinancialEntry} />);

    fireEvent.click(screen.getByRole("button", { name: /NEW BOOKING/i }));
    fireEvent.click(screen.getByRole("button", { name: /RECORD PAYMENT/i }));
    fireEvent.click(screen.getByRole("button", { name: /RECORD EXPENSES/i }));
    fireEvent.click(screen.getByRole("button", { name: /CASH OPERATIONS/i }));

    expect(openBookingModal).toHaveBeenCalledWith({ mode: "walkin" });
    expect(onOpenFinancialEntry.mock.calls.map(([mode]) => mode)).toEqual([
      "customer_payment", "expense", "other_entry",
    ]);
    expect(window.location.pathname).toBe("/crm/today");
  });

  it("mounts the quick payment workflow for the requested order", async () => {
    const onSuccess = vi.fn();
    render(
      <CradleFlowFinancialEntry
        request={{ mode: "customer_payment", orderId: "order-1" }}
        onClose={vi.fn()}
        onSuccess={onSuccess}
        onLegacyCheckout={vi.fn()}
      />
    );

    await waitFor(() => expect(quickProps.mock.lastCall?.[0].data).toBeTruthy());
    expect(quickProps.mock.lastCall?.[0]).toMatchObject({
      requestedOrderId: "order-1",
      error: null,
    });
    expect(modalProps).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Complete entry" }));
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe("/crm/today");
  });

  it("retains the existing financial entry modal for expenses", async () => {
    render(
      <CradleFlowFinancialEntry
        request={{ mode: "expense" }}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onLegacyCheckout={vi.fn()}
      />
    );
    await waitFor(() => expect(modalProps).toHaveBeenCalled());
    expect(modalProps.mock.lastCall?.[0]).toMatchObject({ initialMode: "expense" });
  });

  it("blocks a stale order instead of selecting a different payable order", async () => {
    render(
      <CradleFlowFinancialEntry
        request={{ mode: "customer_payment", orderId: "missing-order" }}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onLegacyCheckout={vi.fn()}
      />
    );

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("no longer available"));
    expect(modalProps).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/crm/today");
  });

  it("keeps the legacy checkout available when Cash Flow context cannot load", async () => {
    loadContext.mockResolvedValue({ ok: false, error: "Cash Flow options unavailable." });
    const onLegacyCheckout = vi.fn();
    render(
      <CradleFlowFinancialEntry
        request={{ mode: "customer_payment", orderId: "legacy-booking", allowLegacyCheckout: true }}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onLegacyCheckout={onLegacyCheckout}
      />
    );

    expect((await screen.findByRole("alert")).textContent).toContain("Cash Flow options unavailable.");
    fireEvent.click(screen.getByRole("button", { name: "Open Booking Checkout" }));
    expect(onLegacyCheckout).toHaveBeenCalledOnce();
    expect(modalProps).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/crm/today");
  });
});
