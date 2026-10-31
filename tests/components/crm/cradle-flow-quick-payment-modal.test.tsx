/** @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FinancialEntryContext } from "@/lib/cash-flow/financial-entry-context";

const mocks = vi.hoisted(() => ({
  recordOrder: vi.fn(),
  recordLegacy: vi.fn(),
  verifyPayment: vi.fn(),
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
  verifyPaymentTransactionAction: mocks.verifyPayment,
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
    {
      id: "maya",
      name: "Maya",
      branchId: "branch-main",
      accountType: "maya",
      identifierMask: "***",
    },
    {
      id: "card",
      name: "Card Terminal",
      branchId: "branch-main",
      accountType: "card_terminal",
      identifierMask: "***",
    },
    {
      id: "bank",
      name: "Bank Account",
      branchId: "branch-main",
      accountType: "bank_transfer",
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
      readyForCheckout: true,
      payableItems: [
        { id: "item-dawn-1", description: "Post Natal Massage", amount: 800 },
        { id: "item-dawn-2", description: "Home Service travel", amount: 286 },
      ],
    },
    {
      id: "order-partial",
      sourceKind: "booking_order",
      orderNumber: "ORDER-PARTIAL-01",
      customerName: "Juan Partial",
      serviceDescription: "Deep Tissue",
      totalAmount: 1000,
      amountPaid: 600,
      remainingBalance: 400,
      bookingDate: "2026-10-30",
      bookingStatus: "Active",
      paymentStatus: "partially_paid",
      paymentEligible: true,
      readyForCheckout: true,
      payableItems: [{ id: "item-partial-1", description: "Deep Tissue", amount: 1000 }],
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

  it("calculates exact change for cash payments and updates summary", async () => {
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
    expect(callbacks.onSuccess).toHaveBeenCalledTimes(1);
    expect(mocks.printReceipt).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Payment Verification Required");
    expect(screen.getByRole("alert").textContent).toContain("Check the Cash Flow ledger");
    expect(screen.getByRole("link", { name: "View Ledger" })).toBeTruthy();
  });

  it("handles network timeout / exception by entering unresolved state and enabling ledger verification", async () => {
    mocks.recordOrder.mockRejectedValueOnce(new Error("Network timeout: gateway closed"));

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

    // Should enter unresolved state
    await waitFor(() => {
      expect(screen.getByText(/Payment Status Unresolved/i)).toBeTruthy();
      expect(screen.getByRole("button", { name: /Verify Transaction Status/i })).toBeTruthy();
    });

    // Submit button must be disabled / showing unresolved
    expect((screen.getByRole("button", { name: "Payment Unresolved" }) as HTMLButtonElement).disabled).toBe(true);

    // Now cashier clicks "Verify Transaction Status"
    mocks.verifyPayment.mockResolvedValueOnce({
      ok: true,
      status: "committed",
      transaction: {
        id: "c5cc08fd-9912-4f32-8ea3-289b41dc6801",
        branchId: "branch-main",
        transactionType: "customer_payment",
        status: "posted",
        businessDate: "2026-10-26",
        occurredAt: "2026-10-26T10:00:00Z",
        sourceType: "booking_order",
        sourceId: "order-dawn",
        externalReference: null,
        notes: null,
        movements: [
          {
            id: "mov-1",
            financialAccountId: "drawer",
            amount: 1086,
            paymentMethod: "cash",
            externalReference: null,
          },
        ],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /Verify Transaction Status/i }));

    await waitFor(() => expect(mocks.verifyPayment).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.printReceipt).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Payment of ₱1,086.00 recorded successfully!/i)).toBeTruthy();
  });

  it("keeps attempt unresolved when ledger verification returns not_found and allows safe retry with same idempotency key", async () => {
    mocks.recordOrder.mockRejectedValueOnce(new Error("Network timeout: gateway closed"));

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

    // Should enter unresolved state
    await waitFor(() => {
      expect(screen.getByText(/Payment Status Unresolved/i)).toBeTruthy();
      expect(screen.getByRole("button", { name: /Verify Transaction Status/i })).toBeTruthy();
    });

    const initialKey = mocks.recordOrder.mock.calls[0]?.[0]?.idempotencyKey;
    expect(initialKey).toBeTruthy();

    // Now cashier clicks "Verify Transaction Status" which returns not_found
    mocks.verifyPayment.mockResolvedValueOnce({
      ok: true,
      status: "not_found",
    });

    fireEvent.click(screen.getByRole("button", { name: /Verify Transaction Status/i }));

    await waitFor(() => expect(mocks.verifyPayment).toHaveBeenCalledTimes(1));

    // MUST remain unresolved, banner still present, message explains in-flight possibility
    expect(screen.getByText(/Payment Status Unresolved/i)).toBeTruthy();
    expect(screen.getByText(/Transaction not found yet in ledger/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Payment Unresolved" }) as HTMLButtonElement).disabled).toBe(true);

    // Now cashier clicks "Retry Same Attempt"
    mocks.recordOrder.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        transaction_id: "c5cc08fd-9912-4f32-8ea3-289b41dc6809",
        order_id: "order-dawn",
        branch_id: "branch-main",
        total_paid: 1086,
        total_payable: 1086,
        net_allocated: 1086,
        remaining_balance: 0,
        movements: [{ amount: 1086, payment_method: "cash", account_id: "drawer" }],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /Retry Same Attempt/i }));

    await waitFor(() => expect(mocks.recordOrder).toHaveBeenCalledTimes(2));
    const retryKey = mocks.recordOrder.mock.calls[1]?.[0]?.idempotencyKey;
    expect(retryKey).toBe(initialKey); // MUST reuse the exact same idempotency key

    await waitFor(() => expect(mocks.printReceipt).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Payment of ₱1,086.00 recorded successfully!/i)).toBeTruthy();
  });

  it("calculates accurate Previously Paid math on partial payments (₱600 previously paid, ₱400 paid now)", async () => {
    mocks.recordOrder.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        transaction_id: "c5cc08fd-9912-4f32-8ea3-289b41dc6802",
        order_id: "order-partial",
        branch_id: "branch-main",
        total_paid: 400,
        total_payable: 1000,
        net_allocated: 1000, // Now 1000 cumulative allocated
        remaining_balance: 0,
        movements: [{ amount: 400, payment_method: "cash", account_id: "drawer" }],
      },
    });

    render(
      <CradleFlowQuickPaymentModal
        data={data}
        loading={false}
        requestedOrderId="order-partial"
        {...callbacks}
      />
    );

    // Order total 1000, already paid 600 -> default tender amount is 400
    await waitFor(() =>
      expect((screen.getByLabelText("Tender 1 amount") as HTMLInputElement).value).toBe("400.00")
    );

    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.printReceipt).toHaveBeenCalledTimes(1));
    const receiptData = mocks.printReceipt.mock.calls[0]?.[0];
    expect(receiptData.totalPayable).toBe(1000);
    expect(receiptData.alreadyPaid).toBe(600); // 1000 net_allocated - 400 paid now = 600
    expect(receiptData.amountPaid).toBe(400);
    expect(receiptData.remainingBalance).toBe(0);
  });

  it("handles idempotent replay safely with replay indicators", async () => {
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

  it("records payment via GCash with manually entered reference", async () => {
    mocks.recordOrder.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        transaction_id: "c5cc08fd-9912-4f32-8ea3-289b41dc6804",
        order_id: "ORDER-c5cc08fd",
        branch_id: "branch-main",
        total_paid: 1086,
        total_payable: 1086,
        net_allocated: 1086,
        remaining_balance: 0,
        movements: [{ amount: 1086, payment_method: "gcash", account_id: "gcash", external_reference: "GCASH-REF-9988" }],
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

    // Switch tender 1 to GCash
    fireEvent.change(screen.getByLabelText("Tender 1 method"), { target: { value: "gcash" } });

    // Enter reference
    const refInput = screen.getByLabelText("Tender 1 reference");
    fireEvent.change(refInput, { target: { value: "GCASH-REF-9988" } });

    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.recordOrder).toHaveBeenCalledTimes(1));
    const submittedPayload = mocks.recordOrder.mock.calls[0]?.[0];
    expect(submittedPayload.payments).toEqual([
      {
        financialAccountId: "gcash",
        paymentMethod: "gcash",
        amount: 1086,
        externalReference: "GCASH-REF-9988",
      },
    ]);

    await waitFor(() => expect(mocks.printReceipt).toHaveBeenCalledTimes(1));
  });

  it("records payment via Maya with manually entered reference", async () => {
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
        movements: [{ amount: 1086, payment_method: "maya", account_id: "maya", external_reference: "MAYA-REF-5544" }],
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

    // Switch tender 1 to Maya
    fireEvent.change(screen.getByLabelText("Tender 1 method"), { target: { value: "maya" } });

    // Enter reference
    const refInput = screen.getByLabelText("Tender 1 reference");
    fireEvent.change(refInput, { target: { value: "MAYA-REF-5544" } });

    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.recordOrder).toHaveBeenCalledTimes(1));
    const submittedPayload = mocks.recordOrder.mock.calls[0]?.[0];
    expect(submittedPayload.payments).toEqual([
      {
        financialAccountId: "maya",
        paymentMethod: "maya",
        amount: 1086,
        externalReference: "MAYA-REF-5544",
      },
    ]);

    await waitFor(() => expect(mocks.printReceipt).toHaveBeenCalledTimes(1));
  });

  it("records payment via Card with card terminal reference", async () => {
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
        movements: [{ amount: 1086, payment_method: "card", account_id: "card", external_reference: "AUTH-8822" }],
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

    // Switch tender 1 to Card
    fireEvent.change(screen.getByLabelText("Tender 1 method"), { target: { value: "card" } });

    // Enter terminal authorization code
    const refInput = screen.getByLabelText("Tender 1 reference");
    fireEvent.change(refInput, { target: { value: "AUTH-8822" } });

    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.recordOrder).toHaveBeenCalledTimes(1));
    const submittedPayload = mocks.recordOrder.mock.calls[0]?.[0];
    expect(submittedPayload.payments).toEqual([
      {
        financialAccountId: "card",
        paymentMethod: "card",
        amount: 1086,
        externalReference: "AUTH-8822",
      },
    ]);

    await waitFor(() => expect(mocks.printReceipt).toHaveBeenCalledTimes(1));
  });

  it("records payment via Bank Transfer with bank reference", async () => {
    mocks.recordOrder.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        transaction_id: "c5cc08fd-9912-4f32-8ea3-289b41dc6807",
        order_id: "ORDER-c5cc08fd",
        branch_id: "branch-main",
        total_paid: 1086,
        total_payable: 1086,
        net_allocated: 1086,
        remaining_balance: 0,
        movements: [{ amount: 1086, payment_method: "bank_transfer", account_id: "bank", external_reference: "BDO-DEP-1122" }],
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

    // Switch tender 1 to Bank Transfer
    fireEvent.change(screen.getByLabelText("Tender 1 method"), { target: { value: "bank_transfer" } });

    // Enter bank reference
    const refInput = screen.getByLabelText("Tender 1 reference");
    fireEvent.change(refInput, { target: { value: "BDO-DEP-1122" } });

    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.recordOrder).toHaveBeenCalledTimes(1));
    const submittedPayload = mocks.recordOrder.mock.calls[0]?.[0];
    expect(submittedPayload.payments).toEqual([
      {
        financialAccountId: "bank",
        paymentMethod: "bank_transfer",
        amount: 1086,
        externalReference: "BDO-DEP-1122",
      },
    ]);

    await waitFor(() => expect(mocks.printReceipt).toHaveBeenCalledTimes(1));
  });

  it("records a split-tender payment combining Cash and GCash", async () => {
    mocks.recordOrder.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        transaction_id: "c5cc08fd-9912-4f32-8ea3-289b41dc6808",
        order_id: "ORDER-c5cc08fd",
        branch_id: "branch-main",
        total_paid: 1086,
        total_payable: 1086,
        net_allocated: 1086,
        remaining_balance: 0,
        movements: [
          { amount: 500, payment_method: "cash", account_id: "drawer" },
          { amount: 586, payment_method: "gcash", account_id: "gcash", external_reference: "GCASH-SPLIT-1" },
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

    // Tender 1: Cash ₱500
    fireEvent.change(screen.getByLabelText("Tender 1 amount"), { target: { value: "500" } });

    // Add another tender
    fireEvent.click(screen.getByRole("button", { name: /Add another payment method/i }));

    await waitFor(() => expect(screen.getByLabelText("Tender 2 method")).toBeTruthy());

    // Set Tender 2 to GCash, amount ₱586, with reference
    fireEvent.change(screen.getByLabelText("Tender 2 method"), { target: { value: "gcash" } });
    fireEvent.change(screen.getByLabelText("Tender 2 amount"), { target: { value: "586" } });
    fireEvent.change(screen.getByLabelText("Tender 2 reference"), { target: { value: "GCASH-SPLIT-1" } });

    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

    await waitFor(() => expect(mocks.recordOrder).toHaveBeenCalledTimes(1));
    const submittedPayload = mocks.recordOrder.mock.calls[0]?.[0];
    expect(submittedPayload.payments).toEqual([
      {
        financialAccountId: "drawer",
        paymentMethod: "cash",
        amount: 500,
        externalReference: null,
      },
      {
        financialAccountId: "gcash",
        paymentMethod: "gcash",
        amount: 586,
        externalReference: "GCASH-SPLIT-1",
      },
    ]);

    await waitFor(() => expect(mocks.printReceipt).toHaveBeenCalledTimes(1));
  });

  it("produces an honest, actionable error and blocks payment when a selected method lacks a configured account", async () => {
    // Context with only a Cash Drawer (no GCash, Maya, Card, or Bank accounts)
    const cashOnlyData: FinancialEntryContext = {
      ...data,
      accounts: [
        {
          id: "drawer",
          name: "Drawer",
          branchId: "branch-main",
          accountType: "cash_drawer",
          identifierMask: "***",
        },
      ],
    };

    render(
      <CradleFlowQuickPaymentModal
        data={cashOnlyData}
        loading={false}
        requestedOrderId="order-dawn"
        {...callbacks}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Tender 1 amount")).toBeTruthy());

    // Switch tender 1 to GCash (which has no account configured)
    fireEvent.change(screen.getByLabelText("Tender 1 method"), { target: { value: "gcash" } });

    // Expect actionable error message
    expect(screen.getByRole("alert").textContent).toContain("No compatible account");

    // Submit button must be disabled
    expect((screen.getByRole("button", { name: "Record Payment" }) as HTMLButtonElement).disabled).toBe(true);

    // Clicking does not call server
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));
    expect(mocks.recordOrder).not.toHaveBeenCalled();
  });
});
