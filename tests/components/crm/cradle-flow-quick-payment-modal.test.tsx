/** @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FinancialEntryContext } from "@/lib/cash-flow/financial-entry-context";

const mocks = vi.hoisted(() => ({
  recordOrder: vi.fn(),
  recordLegacy: vi.fn(),
  printReceipt: vi.fn(),
}));

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

vi.mock("@/lib/cash-flow/receipt-printer", () => ({
  printThermalReceipt: mocks.printReceipt,
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
      payableItems: [{ id: "item-1", description: "Signature Massage", amount: 1200 }],
    },
    {
      id: "order-dawn",
      sourceKind: "booking_order",
      orderNumber: "ORDER-c5cc08fd",
      customerName: "DAWN NAVARRO",
      customerPhone: "09171234567",
      serviceDescription: "Post Natal Massage",
      totalAmount: 1086,
      amountPaid: 0,
      remainingBalance: 1086,
      bookingDate: "2026-10-30",
      serviceTime: "3:00 PM",
      visitType: "home_service",
      bookingStatus: "in_progress",
      paymentEligible: true,
      readyForCheckout: false,
      payableItems: [
        { id: "p-1", description: "Post Natal Massage", amount: 800 },
        { id: "p-2", description: "Home Service travel", amount: 286 },
      ],
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
  mocks.recordOrder.mockResolvedValue({
    ok: true,
    data: { transactionId: "TXN-TEST-1234", branchId: "branch-main" },
  });
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

  it("displays the approved notice banner for automatic printing", () => {
    render(<CradleFlowQuickPaymentModal data={data} loading={false} {...callbacks} />);
    expect(
      screen.getByText("After you click Record Payment, the receipt will print automatically.")
    ).toBeTruthy();
  });

  it("calculates change automatically when cash received is entered (Example A)", async () => {
    render(
      <CradleFlowQuickPaymentModal
        data={data}
        loading={false}
        requestedOrderId="order-dawn"
        {...callbacks}
      />
    );

    await waitFor(() =>
      expect((screen.getByLabelText("Tender 1 amount") as HTMLInputElement).value).toBe("1086.00")
    );

    const cashReceivedInput = screen.getByLabelText("Tender 1 cash received");
    expect(cashReceivedInput).toBeTruthy();

    // Cashier enters 1500
    fireEvent.change(cashReceivedInput, { target: { value: "1500" } });

    // Change should be 1500 - 1086 = 414.00
    expect(screen.getByText("₱414.00")).toBeTruthy();
    expect(screen.getByText("Total to record")).toBeTruthy();
    expect(screen.getAllByText("₱1,086.00").length).toBeGreaterThan(0);
  });

  it("validates insufficient cash received and disables Record Payment", async () => {
    render(
      <CradleFlowQuickPaymentModal
        data={data}
        loading={false}
        requestedOrderId="order-dawn"
        {...callbacks}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Tender 1 cash received")).toBeTruthy());

    // Enter less than 1086.00
    fireEvent.change(screen.getByLabelText("Tender 1 cash received"), {
      target: { value: "1000" },
    });

    expect(screen.getByRole("alert").textContent).toContain("Insufficient cash received");
    expect(
      (screen.getByRole("button", { name: "Record Payment" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("resets cash received when switching selected orders", async () => {
    render(<CradleFlowQuickPaymentModal data={data} loading={false} {...callbacks} />);

    await waitFor(() => expect(screen.getByLabelText("Tender 1 cash received")).toBeTruthy());

    // Enter 1500 for order-1
    fireEvent.change(screen.getByLabelText("Tender 1 cash received"), {
      target: { value: "1500" },
    });
    expect((screen.getByLabelText("Tender 1 cash received") as HTMLInputElement).value).toBe("1500");

    // Switch to All Eligible tab to see Dawn Navarro
    fireEvent.click(screen.getByRole("button", { name: /All Eligible/i }));

    // Click Dawn Navarro in the list
    fireEvent.click(screen.getByRole("button", { name: /DAWN NAVARRO/i }));

    // Cash received should be reset
    await waitFor(() => {
      const input = screen.getByLabelText("Tender 1 cash received") as HTMLInputElement;
      expect(input.value).toBe("");
    });
  });

  it("does not display change in footer when payment method is non-cash", async () => {
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

    expect(screen.queryByText("Change")).toBeNull();
    expect(screen.getByText("Total to record")).toBeTruthy();
  });

  it("automatically initiates receipt printing following confirmed payment posting", async () => {
    render(
      <CradleFlowQuickPaymentModal
        data={data}
        loading={false}
        requestedOrderId="order-dawn"
        {...callbacks}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Tender 1 cash received")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("Tender 1 cash received"), {
      target: { value: "1500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.recordOrder).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.printReceipt).toHaveBeenCalledTimes(1));

    const receiptCall = mocks.printReceipt.mock.calls[0]?.[0];
    expect(receiptCall.customerName).toBe("DAWN NAVARRO");
    expect(receiptCall.orderNumber).toBe("ORDER-c5cc08fd");
    expect(receiptCall.amountPaid).toBe(1086);
    expect(receiptCall.totalCashReceived).toBe(1500);
    expect(receiptCall.changeGiven).toBe(414);
    expect(receiptCall.transactionId).toBe("TXN-TEST-1234");

    // Success banner should show
    expect(screen.getByText(/Payment of ₱1,086.00 recorded successfully!/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Print Again" })).toBeTruthy();
  });

  it("reprints receipt on Print Again without creating a second payment", async () => {
    render(
      <CradleFlowQuickPaymentModal
        data={data}
        loading={false}
        requestedOrderId="order-dawn"
        {...callbacks}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Tender 1 cash received")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.printReceipt).toHaveBeenCalledTimes(1));

    // Click Print Again
    fireEvent.click(screen.getByRole("button", { name: "Print Again" }));

    expect(mocks.printReceipt).toHaveBeenCalledTimes(2);
    // Server action must strictly NOT be called again
    expect(mocks.recordOrder).toHaveBeenCalledTimes(1);
  });

  it("does not print receipt if payment fails", async () => {
    mocks.recordOrder.mockResolvedValueOnce({
      ok: false,
      error: "Cash drawer balance mismatch.",
    });

    render(<CradleFlowQuickPaymentModal data={data} loading={false} {...callbacks} />);

    await waitFor(() => expect(screen.getByLabelText("Tender 1 amount")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.recordOrder).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alert").textContent).toContain("Cash drawer balance mismatch.");
    expect(mocks.printReceipt).not.toHaveBeenCalled();
  });
});
