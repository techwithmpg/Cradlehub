// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PaymentActionMenu } from "@/components/features/dashboard/payment-action-menu";

vi.mock("server-only", () => ({}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/bookings/bookings-client-events", () => ({
  notifyBookingsChanged: vi.fn(),
}));

describe("PaymentActionMenu — Safety Gate & Mutation Isolation", () => {
  afterEach(() => {
    cleanup();
  });
  it("when reviewRequired is true, does NOT expose mutation controls and directs to reconciliation workflows", () => {
    const mockPaymentAction = vi.fn().mockResolvedValue({ success: true });

    render(
      <PaymentActionMenu
        bookingId="b-review-1"
        paymentStatus="unpaid"
        paymentMethod="pay_on_site"
        amountPaid={0}
        pricePaid={1500}
        paymentAction={mockPaymentAction}
        triggerLabel="Review"
        reviewRequired={true}
      />
    );

    // Initial button shows Review ▾
    const trigger = screen.getByRole("button", { name: "Review ▾" });
    expect(trigger).toBeTruthy();

    // Open the dropdown
    fireEvent.click(trigger);

    // 1. Shows warning banner
    const warning = screen.getByTestId("payment-review-warning");
    expect(warning).toBeTruthy();
    expect(warning.textContent).toContain(
      "Order evidence requires review. Reconcile details before collecting."
    );

    // 2. Shows read-only payment info
    const details = screen.getByTestId("payment-review-details");
    expect(details).toBeTruthy();
    expect(details.textContent).toContain("₱1,500.00");
    expect(details.textContent).toContain("unpaid");

    // 3. Directs to authorized reconciliation & ledger workflows
    const recLink = screen.getByTestId("link-reconciliation");
    expect(recLink).toBeTruthy();
    expect(recLink.getAttribute("href")).toBe("/crm/reconciliation");

    const cashFlowLink = screen.getByTestId("link-cash-flow");
    expect(cashFlowLink).toBeTruthy();
    expect(cashFlowLink.getAttribute("href")).toBe("/crm/cash-flow");

    // 4. Mutation controls are completely ABSENT
    expect(screen.queryByText("Quick Mark Paid")).toBeNull();
    expect(screen.queryByText("Reconcile / Mark Paid")).toBeNull();
    expect(screen.queryByRole("button", { name: "Cash" })).toBeNull();
    expect(screen.queryByRole("button", { name: "GCash" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Maya" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Card" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark Unpaid" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit Details…" })).toBeNull();

    // 5. Payment action was never called
    expect(mockPaymentAction).not.toHaveBeenCalled();
  });

  it("when reviewRequired is false, standard payment menu is preserved for Unpaid booking", () => {
    const mockPaymentAction = vi.fn().mockResolvedValue({ success: true });

    render(
      <PaymentActionMenu
        bookingId="b-unpaid-1"
        paymentStatus="unpaid"
        paymentMethod="pay_on_site"
        amountPaid={0}
        pricePaid={1200}
        paymentAction={mockPaymentAction}
        triggerLabel="Pay"
        reviewRequired={false}
      />
    );

    const trigger = screen.getByRole("button", { name: "Pay ▾" });
    fireEvent.click(trigger);

    // Standard Quick Mark Paid section is visible
    expect(screen.getByText("Quick Mark Paid")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cash" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "GCash" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Maya" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Card" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit Details…" })).toBeTruthy();

    // Warnings and reconciliation links are NOT present
    expect(screen.queryByTestId("payment-review-warning")).toBeNull();
    expect(screen.queryByTestId("link-reconciliation")).toBeNull();

    // Clicking a quick method invokes the payment mutation
    fireEvent.click(screen.getByRole("button", { name: "Cash" }));
    expect(mockPaymentAction).toHaveBeenCalledWith({
      bookingId: "b-unpaid-1",
      paymentMethod: "cash",
      paymentStatus: "paid",
      amountPaid: 1200,
      paymentReference: undefined,
    });
  });

  it("when reviewRequired is false, standard payment menu is preserved for Paid booking", () => {
    const mockPaymentAction = vi.fn().mockResolvedValue({ success: true });

    render(
      <PaymentActionMenu
        bookingId="b-paid-1"
        paymentStatus="paid"
        paymentMethod="cash"
        amountPaid={1200}
        pricePaid={1200}
        paymentAction={mockPaymentAction}
        triggerLabel="Manage"
        reviewRequired={false}
      />
    );

    const trigger = screen.getByRole("button", { name: "Manage ▾" });
    fireEvent.click(trigger);

    // Mark Unpaid is available for already paid bookings
    expect(screen.getByText("Quick Mark Paid")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark Unpaid" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit Details…" })).toBeTruthy();
    expect(screen.queryByTestId("payment-review-warning")).toBeNull();
  });
});
