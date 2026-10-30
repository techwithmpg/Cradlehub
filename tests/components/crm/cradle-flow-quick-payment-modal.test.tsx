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

vi.mock("@/lib/cash-flow/receipt-printer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cash-flow/receipt-printer")>();
  return {
    ...actual,
    printThermalReceipt: mocks.printReceipt,
  };
});

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
    {
      id: "booking-legacy-1",
      sourceKind: "legacy_booking",
      orderNumber: "BKG-LEGACY-01",
      customerName: "ROSE FLORES",
      customerPhone: "09181112233",
      serviceDescription: "Foot Spa & Reflexology",
      totalAmount: 900,
      amountPaid: 0,
      remainingBalance: 900,
      bookingDate: "2026-10-30",
      serviceTime: "1:00 PM",
      visitType: "in_spa",
      bookingStatus: "pending_payment",
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
  mocks.printReceipt.mockReturnValue(true);
  mocks.recordOrder.mockResolvedValue({
    ok: true,
    data: {
      success: true,
      transaction_id: "c5cc08fd-9912-4f32-8ea3-289b41dc6801",
      order_id: "ORDER-c5cc08fd",
      branch_id: "branch-main",
      total_paid: 1086,
      total_payable: 1086,
      net_allocated: 1086,
      remaining_balance: 0,
      is_idempotent_replay: false,
      movements: [
        {
          amount: 1086,
          payment_method: "cash",
          account_id: "drawer",
          reference: null,
        },
      ],
      allocations: [],
    },
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
    expect(receiptCall.transactionId).toBe("c5cc08fd-9912-4f32-8ea3-289b41dc6801");

    // Success banner should show
    expect(screen.getByText(/Payment of ₱1,086.00 recorded successfully!/i)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Print Again/i }).length).toBeGreaterThan(0);
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
    fireEvent.click(screen.getAllByRole("button", { name: /Print Again/i })[0]!);

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

  it("displays verification warning and suppresses printing when server response lacks a valid transaction ID", async () => {
    mocks.recordOrder.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        transaction_id: "",
        order_id: "ORDER-c5cc08fd",
        branch_id: "branch-main",
        total_paid: 1086,
        total_payable: 1086,
        net_allocated: 1086,
        remaining_balance: 0,
        movements: [{ amount: 1086, payment_method: "cash", account_id: "drawer" }],
      },
    });

    render(
      <CradleFlowQuickPaymentModal
        data={data}
        loading={false}
        requestedOrderId="order-dawn"
        {...callbacks}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Tender 1 amount")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.recordOrder).toHaveBeenCalledTimes(1));
    expect(callbacks.onSuccess).not.toHaveBeenCalled();
    expect(mocks.printReceipt).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Payment Verification Required");
    expect(screen.getByRole("alert").textContent).toContain("Payment status requires verification");
    expect(screen.getByRole("alert").textContent).toContain("check the Cash Flow ledger");
    expect(screen.getByRole("link", { name: "View Ledger" })).toBeTruthy();
  });

  it("displays verification warning and suppresses printing when server response indicates success: false", async () => {
    mocks.recordOrder.mockResolvedValueOnce({
      ok: true,
      data: {
        success: false,
        transaction_id: "c5cc08fd-9912-4f32-8ea3-289b41dc6802",
        order_id: "ORDER-c5cc08fd",
        branch_id: "branch-main",
        total_paid: 0,
        total_payable: 1086,
        net_allocated: 0,
        remaining_balance: 1086,
        movements: [],
      },
    });

    render(
      <CradleFlowQuickPaymentModal
        data={data}
        loading={false}
        requestedOrderId="order-dawn"
        {...callbacks}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Tender 1 amount")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.recordOrder).toHaveBeenCalledTimes(1));
    expect(callbacks.onSuccess).not.toHaveBeenCalled();
    expect(mocks.printReceipt).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Payment Verification Required");
    expect(screen.getByRole("alert").textContent).toContain("Payment status requires verification");
  });

  it("displays verification warning and suppresses printing when transaction ID is stringified null or fabricated", async () => {
    mocks.recordOrder.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        transaction_id: "null",
        order_id: "ORDER-c5cc08fd",
        branch_id: "branch-main",
        total_paid: 1086,
        total_payable: 1086,
        net_allocated: 1086,
        remaining_balance: 0,
        movements: [{ amount: 1086, payment_method: "cash", account_id: "drawer" }],
      },
    });

    render(
      <CradleFlowQuickPaymentModal
        data={data}
        loading={false}
        requestedOrderId="order-dawn"
        {...callbacks}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Tender 1 amount")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.recordOrder).toHaveBeenCalledTimes(1));
    expect(callbacks.onSuccess).not.toHaveBeenCalled();
    expect(mocks.printReceipt).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Missing, malformed, or fabricated transaction reference");
  });

  it("refuses to substitute cashier-entered amounts when server tender movements are missing", async () => {
    mocks.recordOrder.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        transaction_id: "c5cc08fd-9912-4f32-8ea3-289b41dc6803",
        order_id: "ORDER-c5cc08fd",
        branch_id: "branch-main",
        total_paid: 1086,
        total_payable: 1086,
        net_allocated: 1086,
        remaining_balance: 0,
        movements: [], // Empty movements from server
      },
    });

    render(
      <CradleFlowQuickPaymentModal
        data={data}
        loading={false}
        requestedOrderId="order-dawn"
        {...callbacks}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Tender 1 amount")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.recordOrder).toHaveBeenCalledTimes(1));
    expect(callbacks.onSuccess).not.toHaveBeenCalled();
    expect(mocks.printReceipt).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Authoritative payment tender movements are missing");
  });

  it("displays verification warning when server net_allocated mismatches the payment tender amount", async () => {
    mocks.recordOrder.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        transaction_id: "c5cc08fd-9912-4f32-8ea3-289b41dc6804",
        order_id: "ORDER-c5cc08fd",
        branch_id: "branch-main",
        total_paid: 500,
        total_payable: 1086,
        net_allocated: 500,
        remaining_balance: 586,
        movements: [{ amount: 500, payment_method: "cash", account_id: "drawer" }],
      },
    });

    render(
      <CradleFlowQuickPaymentModal
        data={data}
        loading={false}
        requestedOrderId="order-dawn"
        {...callbacks}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Tender 1 amount")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.recordOrder).toHaveBeenCalledTimes(1));
    expect(callbacks.onSuccess).not.toHaveBeenCalled();
    expect(mocks.printReceipt).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Posting amount mismatch");
  });

  it("handles idempotent replay safely with replay indicators and without duplicate payment submission", async () => {
    mocks.recordOrder.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        transaction_id: "c5cc08fd-9912-4f32-8ea3-289b41dc6805",
        order_id: "ORDER-c5cc08fd",
        branch_id: "branch-main",
        total_paid: 1086,
        total_payable: 1086,
        net_allocated: 1086,
        remaining_balance: 0,
        is_idempotent_replay: true,
        movements: [{ amount: 1086, payment_method: "cash", account_id: "drawer" }],
      },
    });

    render(
      <CradleFlowQuickPaymentModal
        data={data}
        loading={false}
        requestedOrderId="order-dawn"
        {...callbacks}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Tender 1 amount")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.printReceipt).toHaveBeenCalledTimes(1));
    const receiptData = mocks.printReceipt.mock.calls[0]?.[0];
    expect(receiptData.isIdempotentReplay).toBe(true);

    expect(screen.getByText("REPLAY")).toBeTruthy();
    expect(screen.getByText(/Idempotent Replay/i)).toBeTruthy();
  });

  it("handles blocked browser print dialog gracefully while keeping payment confirmed", async () => {
    mocks.printReceipt.mockReturnValueOnce(false);

    render(
      <CradleFlowQuickPaymentModal
        data={data}
        loading={false}
        requestedOrderId="order-dawn"
        {...callbacks}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Tender 1 amount")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.recordOrder).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.printReceipt).toHaveBeenCalledTimes(1));

    expect(screen.getByText(/Payment of ₱1,086.00 recorded successfully!/i)).toBeTruthy();
    expect(screen.getByText(/Automatic printing could not be opened/i)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Print Again/i }).length).toBeGreaterThan(0);
  });

  it("displays 'Print command initiated' and allows Print Again without reposting transaction", async () => {
    render(
      <CradleFlowQuickPaymentModal
        data={data}
        loading={false}
        requestedOrderId="order-dawn"
        {...callbacks}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Tender 1 amount")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.recordOrder).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.printReceipt).toHaveBeenCalledTimes(1));

    // Validates distinction: Print command initiated (not physical printing confirmed)
    expect(screen.getByText(/Print command initiated/i)).toBeTruthy();

    // Verify Print Again functionality
    const printAgainBtns = screen.getAllByRole("button", { name: /Print Again/i });
    expect(printAgainBtns.length).toBeGreaterThan(0);

    fireEvent.click(printAgainBtns[0]!);
    expect(mocks.printReceipt).toHaveBeenCalledTimes(2);
    // Reprint must pass isReprint: true
    expect(mocks.printReceipt.mock.calls[1]?.[0]?.isReprint).toBe(true);
    // MUST NEVER post a second payment to server
    expect(mocks.recordOrder).toHaveBeenCalledTimes(1);
  });

  it("successfully records and prints split payment (Cash + GCash)", async () => {
    mocks.recordOrder.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        transaction_id: "c5cc08fd-9912-4f32-8ea3-289b41dc6806",
        order_id: "ORDER-c5cc08fd",
        branch_id: "branch-main",
        total_paid: 1086,
        total_payable: 1086,
        net_allocated: 1086,
        remaining_balance: 0,
        is_idempotent_replay: false,
        movements: [
          { amount: 500, payment_method: "cash", account_id: "drawer" },
          { amount: 586, payment_method: "gcash", account_id: "gcash", external_reference: "GC-SPLIT-99" },
        ],
      },
    });

    render(
      <CradleFlowQuickPaymentModal
        data={data}
        loading={false}
        requestedOrderId="order-dawn"
        {...callbacks}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Tender 1 amount")).toBeTruthy());
    // Split payment: set tender 1 to 500, then add tender 2 for remaining 586
    fireEvent.change(screen.getByLabelText("Tender 1 amount"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Split +" }));
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.recordOrder).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.printReceipt).toHaveBeenCalledTimes(1));

    const receiptData = mocks.printReceipt.mock.calls[0]?.[0];
    expect(receiptData.transactionId).toBe("c5cc08fd-9912-4f32-8ea3-289b41dc6806");
    expect(receiptData.payments).toHaveLength(2);
    expect(receiptData.payments[0].method).toBe("Cash");
    expect(receiptData.payments[0].amount).toBe(500);
    expect(receiptData.payments[1].method).toBe("GCash");
    expect(receiptData.payments[1].amount).toBe(586);
  });

  it("displays verification warning and suppresses printing when server response contains invalid or non-finite total payable", async () => {
    mocks.recordOrder.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        transaction_id: "c5cc08fd-9912-4f32-8ea3-289b41dc6807",
        order_id: "ORDER-c5cc08fd",
        branch_id: "branch-main",
        total_paid: 1086,
        total_payable: NaN, // Invalid non-finite total payable
        net_allocated: 1086,
        remaining_balance: 0,
        movements: [{ amount: 1086, payment_method: "cash", account_id: "drawer" }],
      },
    });

    render(
      <CradleFlowQuickPaymentModal
        data={data}
        loading={false}
        requestedOrderId="order-dawn"
        {...callbacks}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Tender 1 amount")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.recordOrder).toHaveBeenCalledTimes(1));
    expect(callbacks.onSuccess).not.toHaveBeenCalled();
    expect(mocks.printReceipt).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Authoritative total payable amount is missing or invalid");
  });

  it("authoritatively records legacy booking payment and prints receipt with server balances", async () => {
    mocks.recordLegacy.mockResolvedValueOnce({
      ok: true,
      data: {
        transactionId: "c5cc08fd-9912-4f32-8ea3-289b41dc6808",
        paymentDelta: 900,
        isIdempotentReplay: false,
        branchId: "branch-main",
        totalPayable: 900,
        totalPaid: 900,
        alreadyPaid: 0,
        remainingBalance: 0,
        movements: [
          {
            id: "mov-1",
            amount: 900,
            paymentMethod: "cash",
            externalReference: null,
          },
        ],
      },
    });

    render(
      <CradleFlowQuickPaymentModal
        data={data}
        loading={false}
        requestedOrderId="booking-legacy-1"
        {...callbacks}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Tender 1 amount")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.recordLegacy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.printReceipt).toHaveBeenCalledTimes(1));

    const receiptData = mocks.printReceipt.mock.calls[0]?.[0];
    expect(receiptData.transactionId).toBe("c5cc08fd-9912-4f32-8ea3-289b41dc6808");
    expect(receiptData.totalPayable).toBe(900);
    expect(receiptData.amountPaid).toBe(900);
    expect(receiptData.remainingBalance).toBe(0);
    expect(receiptData.payments).toHaveLength(1);
    expect(receiptData.payments[0].method).toBe("Cash");
    expect(callbacks.onSuccess).toHaveBeenCalledTimes(1);
  });

  it("suppresses printing and displays warning when legacy booking payment response lacks valid balances", async () => {
    mocks.recordLegacy.mockResolvedValueOnce({
      ok: true,
      data: {
        transactionId: "c5cc08fd-9912-4f32-8ea3-289b41dc6809",
        paymentDelta: 900,
        isIdempotentReplay: false,
        branchId: "branch-main",
        totalPayable: NaN, // non-finite
        totalPaid: 900,
        alreadyPaid: 0,
        remainingBalance: 0,
        movements: [
          {
            id: "mov-1",
            amount: 900,
            paymentMethod: "cash",
            externalReference: null,
          },
        ],
      },
    });

    render(
      <CradleFlowQuickPaymentModal
        data={data}
        loading={false}
        requestedOrderId="booking-legacy-1"
        {...callbacks}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Tender 1 amount")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.recordLegacy).toHaveBeenCalledTimes(1));
    expect(callbacks.onSuccess).not.toHaveBeenCalled();
    expect(mocks.printReceipt).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Authoritative total payable amount is missing or invalid");
  });
});
