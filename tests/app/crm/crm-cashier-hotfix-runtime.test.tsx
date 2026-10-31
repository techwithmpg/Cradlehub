// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock server-only and next cache
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/bookings/revalidate-booking-surfaces", () => ({
  revalidateOperationalBookingSurfaces: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

// Import REAL cash-flow-actions module to guarantee zero runtime export violations
import * as cashFlowActions from "@/lib/cash-flow/cash-flow-actions";
import { CradleFlowQuickPaymentModal } from "@/components/features/crm/today/cradle-flow-quick-payment-modal";
import type { FinancialEntryContext } from "@/lib/cash-flow/financial-entry-context";

// Mock receipt printer
const mockPrintReceipt = vi.fn().mockReturnValue(true);
vi.mock("@/lib/cash-flow/receipt-printer", () => ({
  printThermalReceipt: (...args: unknown[]) => mockPrintReceipt(...args),
}));

const mockEntryContext: FinancialEntryContext = {
  branchId: "branch-main-1",
  businessDate: "2026-10-31",
  accounts: [
    {
      id: "drawer-1",
      branchId: "branch-main-1",
      name: "Front Desk Cash Drawer",
      accountType: "cash_drawer",
      identifierMask: "Front Desk",
    },
    {
      id: "gcash-1",
      branchId: "branch-main-1",
      name: "Main Spa GCash (Manual Receipt)",
      accountType: "gcash",
      identifierMask: "Manual Receipt",
    },
  ],
  expenseCategories: [],
  staffOptions: [],
  cashSessions: { activeSessions: [], availableDrawers: [] },
  payableOrders: [
    {
      id: "order-test-1",
      sourceKind: "booking_order",
      orderNumber: "ORD-20261031-001",
      customerName: "Maria Santos",
      customerPhone: "09171234567",
      bookingDate: "2026-10-31",
      serviceTime: "10:00 AM",
      serviceDescription: "Signature Massage",
      visitType: "in_spa",
      branchName: "Main Spa",
      totalAmount: 1000,
      amountPaid: 0,
      remainingBalance: 1000,
      readyForCheckout: true,
      payableItems: [{ id: "item-1", description: "Signature Massage", amount: 1000 }],
    },
  ],
};

describe("CRM Cashier Runtime Hotfix Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. 'use server' Export Boundary Compliance", () => {
    it("ensures ALL exports from cash-flow-actions are async functions and NO object exports exist", () => {
      const exportsList = Object.entries(cashFlowActions);
      expect(exportsList.length).toBeGreaterThan(0);

      for (const [key, value] of exportsList) {
        expect(
          typeof value,
          `Violation: '${key}' in cash-flow-actions is exported as '${typeof value}'. Every export from a 'use server' module must be a function.`
        ).toBe("function");
      }
    });

    it("confirms VerifyPaymentTransactionInputSchema is strictly internal and NOT exported", () => {
      expect("VerifyPaymentTransactionInputSchema" in cashFlowActions).toBe(false);
    });

    it("confirms verifyPaymentTransactionAction is an exported callable function", () => {
      expect(typeof cashFlowActions.verifyPaymentTransactionAction).toBe("function");
    });
  });

  describe("2. Payment Safety & Unresolved Attempt Replay Contract", () => {
    it("preserves unresolvedAttemptKey when ledger returns not_found and allows safe retry with the identical key", async () => {
      // Mock recordOrderPaymentAction to fail with network timeout on attempt 1
      const spyRecordOrder = vi.spyOn(cashFlowActions, "recordOrderPaymentAction")
        .mockRejectedValueOnce(new Error("Network timeout: connection reset by peer"));

      const spyVerify = vi.spyOn(cashFlowActions, "verifyPaymentTransactionAction")
        .mockResolvedValueOnce({
          ok: true,
          status: "not_found",
        });

      render(
        <CradleFlowQuickPaymentModal
          data={mockEntryContext}
          loading={false}
          requestedOrderId="order-test-1"
          onClose={vi.fn()}
          onRetry={vi.fn()}
          onSuccess={vi.fn()}
          onLegacyCheckout={vi.fn()}
        />
      );

      // Verify tender amount is 1000.00
      await waitFor(() =>
        expect((screen.getByLabelText("Tender 1 amount") as HTMLInputElement).value).toBe("1000.00")
      );

      // CSR clicks Record Payment
      fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));

      // Enters unresolved state
      await waitFor(() => {
        expect(screen.getByText(/Payment Status Unresolved:/i)).toBeTruthy();
        expect(screen.getByRole("button", { name: /Verify Transaction Status/i })).toBeTruthy();
      });

      const initialKey = String(spyRecordOrder.mock.calls[0]?.[0]?.idempotencyKey || "");
      expect(initialKey.length).toBeGreaterThan(10);

      // Submit button is disabled in unresolved state
      expect(
        (screen.getByRole("button", { name: "Payment Unresolved" }) as HTMLButtonElement).disabled
      ).toBe(true);

      // CSR clicks "Verify Transaction Status" -> returns not_found
      fireEvent.click(screen.getByRole("button", { name: /Verify Transaction Status/i }));

      await waitFor(() => expect(spyVerify).toHaveBeenCalledTimes(1));

      // CRITICAL SAFETY CHECK:
      // A not_found response MUST NOT clear the unresolved state or claim the attempt is dead!
      expect(screen.getByText(/Payment Status Unresolved:/i)).toBeTruthy();
      expect(screen.getByText(/Transaction not found yet in ledger/i)).toBeTruthy();
      expect(
        (screen.getByRole("button", { name: "Payment Unresolved" }) as HTMLButtonElement).disabled
      ).toBe(true);

      // The modal offers "Retry Same Attempt"
      const retryButton = screen.getByRole("button", { name: /Retry Same Attempt/i });
      expect(retryButton).toBeTruthy();

      // Mock recordOrderPaymentAction to succeed on attempt 2
      spyRecordOrder.mockResolvedValueOnce({
        ok: true,
        data: {
          success: true,
          transactionId: "a1000000-0000-0000-0000-000000000099",
          orderId: "order-test-1",
          branchId: "branch-main-1",
          totalPaid: 1000,
          totalPayable: 1000,
          netAllocated: 1000,
          remainingBalance: 0,
          isIdempotentReplay: false,
          businessDate: "2026-10-31",
          paymentState: "paid",
          allocations: [],
          movements: [
            {
              id: "mov-1",
              financialAccountId: "drawer-1",
              amount: 1000,
              paymentMethod: "cash",
              externalReference: null,
            },
          ],
        },
      });

      // CSR clicks "Retry Same Attempt"
      fireEvent.click(retryButton);

      await waitFor(() => expect(spyRecordOrder).toHaveBeenCalledTimes(2));

      // CRITICAL IDEMPOTENCY CHECK:
      // The second attempt MUST use the exact same idempotency key as the first attempt!
      const retryKey = spyRecordOrder.mock.calls[1]?.[0]?.idempotencyKey;
      expect(retryKey).toBe(initialKey);

      // Confirmed receipt is displayed and print is triggered
      await waitFor(() => expect(mockPrintReceipt).toHaveBeenCalledTimes(1));
      expect(screen.getByText(/Payment of ₱1,000.00 recorded successfully!/i)).toBeTruthy();
    });
  });
});
