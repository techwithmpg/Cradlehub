// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SelectedBookingPaymentRow } from "@/components/features/bookings/selected-booking-payment-row";
import { SelectedBookingPaymentConfirmation } from "@/components/features/bookings/selected-booking-payment-confirmation";
import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";

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

function makeBooking(overrides: Partial<WorkspaceBookingRow> = {}): WorkspaceBookingRow {
  return {
    id: "booking-sel-1",
    order_id: "ORD-SEL-1",
    branch_id: "branch-1",
    customer_id: "cust-1",
    service_id: "svc-1",
    staff_id: "staff-1",
    resource_id: "room-1",
    booking_date: "2026-10-29",
    start_time: "14:00:00",
    end_time: "15:00:00",
    status: "pending",
    booking_progress_status: "pending",
    type: "walkin",
    delivery_type: "in_spa",
    price: 1200,
    pricing_status: "locked",
    order_total_amount: 1200,
    order_amount_paid: 0,
    order_payment_status: "unpaid",
    payment_status: "unpaid",
    payment_method: "pay_on_site",
    payment_intent_status: "requires_payment_method",
    metadata: {
      price_paid: 1200,
      duration_minutes: 60,
    },
    customers: {
      id: "cust-1",
      full_name: "Elena Navarro",
      phone: "09171112233",
      email: "elena@example.com",
    },
    services: {
      id: "svc-1",
      name: "Signature Deep Tissue",
      duration_minutes: 60,
      price: 1200,
      category: "Massage",
    },
    ...overrides,
  } as WorkspaceBookingRow;
}

describe("SelectedBookingPaymentRow — Safety Gate & Dynamic Confirmation Isolation", () => {
  afterEach(() => {
    cleanup();
  });

  it("when expanded=true and isPaymentReview=true, suppresses confirmation form and renders read-only explanation without unverified balance", () => {
    const mockConfirmAction = vi.fn().mockResolvedValue({ success: true });
    const mockPaymentAction = vi.fn().mockResolvedValue({ success: true });

    // Incomplete order evidence -> isPaymentReview is true
    const unverifiedBooking = makeBooking({
      id: "booking-unverified-1",
      order_id: "ORD-INCOMPLETE",
      order_total_amount: null,
      order_amount_paid: null,
      order_payment_status: null,
      metadata: {
        price_paid: 9999, // Unverified legacy price snapshot
      },
    });

    render(
      <SelectedBookingPaymentRow
        booking={unverifiedBooking}
        confirmPaymentAction={mockConfirmAction}
        paymentAction={mockPaymentAction}
        expanded={true}
      />
    );

    // 1. Summary displays read-only Payment Review explanation and DOES NOT present unverified legacy balances
    const summary = screen.getByTestId("selected-payment-review-summary");
    expect(summary).toBeTruthy();
    expect(summary.textContent).toContain("Payment Review");
    expect(summary.textContent).toContain("Evidence requires review before collecting");
    expect(screen.queryByText(/due/i)).toBeNull();
    expect(screen.queryByText(/9,999/)).toBeNull();

    // 2. Read-only review explanation panel is rendered instead of actionable form
    const explanation = screen.getByTestId("selected-payment-review-explanation");
    expect(explanation).toBeTruthy();
    expect(explanation.textContent).toContain("Payment Evidence Requires Review");
    expect(explanation.textContent).toContain("Payment confirmation is locked");

    // 3. Authorized workflow links are present
    const recLink = screen.getByRole("link", { name: "Open Reconciliation" });
    expect(recLink.getAttribute("href")).toBe("/crm/reconciliation");
    const cashFlowLink = screen.getByRole("link", { name: "View Cash Flow Ledger" });
    expect(cashFlowLink.getAttribute("href")).toBe("/crm/cash-flow");

    // 4. Actionable payment confirmation form controls are strictly NOT rendered
    expect(screen.queryByRole("button", { name: /Confirm payment & finalize booking/i })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Payment method" })).toBeNull();
    expect(screen.queryByPlaceholderText("Reference (optional)")).toBeNull();

    // 5. Action trigger button is Review ▾, not Manage ▾
    expect(screen.getByRole("button", { name: "Review ▾" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Manage ▾" })).toBeNull();

    // 6. Confirm action was never called
    expect(mockConfirmAction).not.toHaveBeenCalled();
  });

  it("switching bookings while expanded replaces actionable confirmation form with read-only review explanation", () => {
    const mockConfirmAction = vi.fn().mockResolvedValue({ success: true });

    // Initial booking: Verified unpaid booking
    const verifiedBooking = makeBooking({
      id: "booking-verified-init",
      order_id: "ORD-VERIFIED-1",
      order_total_amount: 1200,
      order_amount_paid: 0,
      order_payment_status: "unpaid",
      status: "pending",
    });

    const { rerender } = render(
      <SelectedBookingPaymentRow
        booking={verifiedBooking}
        confirmPaymentAction={mockConfirmAction}
        expanded={true}
      />
    );

    // Initial verified booking exposes the actionable confirmation form
    expect(screen.getByRole("button", { name: "Confirm payment & finalize booking" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Payment method" })).toBeTruthy();
    expect(screen.queryByTestId("selected-payment-review-explanation")).toBeNull();

    // Switch to Booking B with unverified evidence while keeping expanded={true}
    const unverifiedBooking = makeBooking({
      id: "booking-unverified-switched",
      order_id: "ORD-UNVERIFIED-2",
      order_total_amount: null,
      order_amount_paid: null,
      order_payment_status: null,
      status: "pending",
    });

    rerender(
      <SelectedBookingPaymentRow
        booking={unverifiedBooking}
        confirmPaymentAction={mockConfirmAction}
        expanded={true}
      />
    );

    // Actionable confirmation form controls MUST immediately disappear
    expect(screen.queryByRole("button", { name: "Confirm payment & finalize booking" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Payment method" })).toBeNull();

    // Read-only Payment Review explanation is rendered instead
    const explanation = screen.getByTestId("selected-payment-review-explanation");
    expect(explanation).toBeTruthy();
    expect(explanation.textContent).toContain("Payment Evidence Requires Review");
    expect(mockConfirmAction).not.toHaveBeenCalled();
  });

  it("restores legitimate payment confirmation once authoritative order evidence refreshes", () => {
    const mockConfirmAction = vi.fn().mockResolvedValue({ success: true });

    // Step 1: Start with unverified evidence
    const unverifiedBooking = makeBooking({
      id: "booking-refresh-cycle",
      order_id: "ORD-REFRESH-1",
      order_total_amount: null,
      order_amount_paid: null,
      order_payment_status: null,
      status: "pending",
    });

    const { rerender } = render(
      <SelectedBookingPaymentRow
        booking={unverifiedBooking}
        confirmPaymentAction={mockConfirmAction}
        expanded={true}
      />
    );

    // In unverified state, confirmation form is suppressed
    expect(screen.queryByRole("button", { name: "Confirm payment & finalize booking" })).toBeNull();
    expect(screen.getByTestId("selected-payment-review-explanation")).toBeTruthy();

    // Step 2: Authoritative evidence refreshes with verified order financials
    const refreshedBooking = makeBooking({
      id: "booking-refresh-cycle",
      order_id: "ORD-REFRESH-1",
      order_total_amount: 1500,
      order_amount_paid: 0,
      order_payment_status: "unpaid",
      status: "pending",
    });

    rerender(
      <SelectedBookingPaymentRow
        booking={refreshedBooking}
        confirmPaymentAction={mockConfirmAction}
        expanded={true}
      />
    );

    // Explanation is removed and legitimate payment confirmation form is restored!
    expect(screen.queryByTestId("selected-payment-review-explanation")).toBeNull();
    const confirmBtn = screen.getByRole("button", { name: "Confirm payment & finalize booking" });
    expect(confirmBtn).toBeTruthy();

    // Fill details and submit confirmation
    fireEvent.change(screen.getByPlaceholderText("Reference (optional)"), {
      target: { value: "REF-12345" },
    });
    fireEvent.click(confirmBtn);

    expect(mockConfirmAction).toHaveBeenCalledWith({
      bookingId: "booking-refresh-cycle",
      paymentMethod: "cash",
      paymentReference: "REF-12345",
      note: undefined,
    });
  });

  it("SelectedBookingPaymentConfirmation directly blocks mutation when booking is under payment review", () => {
    const mockConfirmAction = vi.fn().mockResolvedValue({ success: true });
    const unverifiedBooking = makeBooking({
      id: "booking-direct-locked",
      order_id: "ORD-DIRECT-LOCKED",
      order_total_amount: null,
      order_payment_status: null,
    });

    render(
      <SelectedBookingPaymentConfirmation
        booking={unverifiedBooking}
        confirmPaymentAction={mockConfirmAction}
      />
    );

    // Renders locked notification instead of input controls
    expect(screen.getByTestId("payment-confirmation-review-locked")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirm payment & finalize booking" })).toBeNull();
    expect(mockConfirmAction).not.toHaveBeenCalled();
  });
});

