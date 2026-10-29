/** @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FinancialEntryContext } from "@/lib/cash-flow/financial-entry-context";

const mocks = vi.hoisted(() => ({ recordOrder: vi.fn(), recordLegacy: vi.fn() }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));
vi.mock("@/lib/cash-flow/cash-flow-actions", () => ({
  recordOrderPaymentAction: mocks.recordOrder,
  recordLegacyBookingPaymentAction: mocks.recordLegacy,
}));
import { CradleFlowQuickPaymentModal } from "@/components/features/crm/today/cradle-flow-quick-payment-modal";

const data: FinancialEntryContext = {
  branchId: "branch-main",
  businessDate: "2026-10-26",
  accounts: [
    {
      id: "drawer",
      name: "Drawer",
      branchId: "branch-main",
      accountType: "cash_drawer",
      identifierMask: "***",
    },
    {
      id: "gcash",
      name: "GCash",
      branchId: "branch-main",
      accountType: "gcash",
      identifierMask: "***",
    },
  ],
  expenseCategories: [],
  staffOptions: [],
  cashSessions: { activeSessions: [], availableDrawers: [] },
  payableOrders: [
    {
      id: "order-1",
      sourceKind: "booking_order",
      orderNumber: "ORDER-0001",
      customerName: "Maria Santos",
      serviceDescription: "Signature Massage",
      totalAmount: 1200,
      amountPaid: 0,
      remainingBalance: 1200,
      bookingDate: "2026-10-26",
      bookingStatus: "Active",
      paymentStatus: "unpaid",
      paymentEligible: true,
      readyForCheckout: true,
    },
  ],
};
const callbacks = {
  onClose: vi.fn(),
  onRetry: vi.fn(),
  onSuccess: vi.fn(),
  onLegacyCheckout: vi.fn(),
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.recordOrder.mockResolvedValue({ ok: true, data: { branchId: "branch-main" } });
});

describe("CRM quick payment modal", () => {
  it("opens one payment modal immediately while data is pending", () => {
    render(<CradleFlowQuickPaymentModal data={null} loading {...callbacks} />);
    expect(screen.getByRole("heading", { name: "Record Payment" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Preparing current payable bookings");
    expect(
      (screen.getByRole("button", { name: "Record Payment" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });
  it("posts Cash and GCash together through the existing order action", async () => {
    render(<CradleFlowQuickPaymentModal data={data} loading={false} {...callbacks} />);
    await waitFor(() =>
      expect((screen.getByLabelText("Tender 1 amount") as HTMLInputElement).value).toBe("1200.00")
    );
    fireEvent.change(screen.getByLabelText("Tender 1 amount"), { target: { value: "700" } });
    fireEvent.click(screen.getByRole("button", { name: /Add another payment method/i }));
    expect((screen.getByLabelText("Tender 2 amount") as HTMLInputElement).value).toBe("500.00");
    expect((screen.getByLabelText("Tender 2 method") as HTMLSelectElement).value).toBe("gcash");
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));
    await waitFor(() => expect(mocks.recordOrder).toHaveBeenCalledTimes(1));
    const input = mocks.recordOrder.mock.calls[0]?.[0];
    expect(input.orderId).toBe("order-1");
    expect(input.payments).toEqual([
      { amount: 700, paymentMethod: "cash", financialAccountId: "drawer", externalReference: null },
      { amount: 500, paymentMethod: "gcash", financialAccountId: "gcash", externalReference: null },
    ]);
    expect(mocks.recordLegacy).not.toHaveBeenCalled();
  });
  it("never falls back to another customer when the requested order is ineligible", () => {
    const requested = { ...data.payableOrders[0]!, id: "blocked", customerName: "Blocked Guest", paymentEligible: false };
    const other = { ...data.payableOrders[0]!, id: "other", customerName: "Other Guest" };
    render(
      <CradleFlowQuickPaymentModal
        data={{ ...data, payableOrders: [requested, other] }}
        loading={false}
        requestedOrderId="blocked"
        {...callbacks}
      />
    );
    expect((screen.getByRole("button", { name: "Record Payment" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Select an eligible booking to see its payment details/i)).toBeTruthy();
    expect(mocks.recordOrder).not.toHaveBeenCalled();
  });

  it("does not post when split tender exceeds the remaining balance", async () => {
    render(<CradleFlowQuickPaymentModal data={data} loading={false} {...callbacks} />);
    await waitFor(() => expect(screen.getByLabelText("Tender 1 amount")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Tender 1 amount"), { target: { value: "1201" } });
    expect(
      (screen.getByRole("button", { name: "Record Payment" }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(mocks.recordOrder).not.toHaveBeenCalled();
  });

  it("initializes with initialPaymentMethod and compatible account when provided", async () => {
    render(
      <CradleFlowQuickPaymentModal
        data={data}
        loading={false}
        requestedOrderId="order-1"
        initialPaymentMethod="gcash"
        {...callbacks}
      />
    );
    await waitFor(() => expect(screen.getByLabelText("Tender 1 amount")).toBeTruthy());
    expect((screen.getByLabelText("Tender 1 method") as HTMLSelectElement).value).toBe("gcash");
    expect((screen.getByLabelText("Tender 1 amount") as HTMLInputElement).value).toBe("1200.00");

    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));
    await waitFor(() => expect(mocks.recordOrder).toHaveBeenCalledTimes(1));
    const input = mocks.recordOrder.mock.calls[0]?.[0];
    expect(input.orderId).toBe("order-1");
    expect(input.payments).toEqual([
      { amount: 1200, paymentMethod: "gcash", financialAccountId: "gcash", externalReference: null },
    ]);
  });
});
