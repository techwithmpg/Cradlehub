"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { PaymentActionMenu } from "@/components/features/dashboard/payment-action-menu";
import { PaymentMethodBadge } from "@/components/features/dashboard/payment-method-badge";
import type { BookingActionFn, WorkspaceBookingRow } from "./booking-workspace-types";
import { SelectedBookingOverviewRow, overviewActionClass } from "./selected-booking-overview-row";
import { SelectedBookingPaymentConfirmation } from "./selected-booking-payment-confirmation";
import { readBookingPrice } from "@/lib/bookings/booking-display";
import { isCrmPendingBookingStatus } from "@/lib/bookings/crm-booking-status";
import { formatCurrency } from "@/lib/utils";
import { getBookingPaymentDisplayState } from "@/lib/bookings/crm-booking-groups";

export function SelectedBookingPaymentRow({
  booking,
  paymentAction,
  confirmPaymentAction,
  expanded,
  onExpandedChange,
  onChanged,
}: {
  booking: WorkspaceBookingRow;
  paymentAction?: BookingActionFn;
  confirmPaymentAction?: BookingActionFn;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onChanged?: () => void;
}) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const isExpanded = expanded ?? localExpanded;
  const setExpanded = onExpandedChange ?? setLocalExpanded;
  const price = readBookingPrice(booking.metadata);
  const balance = Math.max(0, price - Number(booking.amount_paid ?? 0));
  const isPaymentReview = Boolean(
    booking.order_id &&
      getBookingPaymentDisplayState(
        {
          total: booking.order_total_amount ?? null,
          paid: booking.order_amount_paid ?? null,
          due:
            booking.order_total_amount != null && booking.order_amount_paid != null
              ? Math.max(0, booking.order_total_amount - booking.order_amount_paid)
              : null,
          status: booking.order_payment_status ?? null,
        },
        booking
      ).isPaymentReview
  );

  const summary = isPaymentReview ? (
    <span
      data-testid="selected-payment-review-summary"
      className="inline-flex items-center gap-1.5 font-medium text-purple-700"
    >
      <span>Payment Review</span>
      <span>·</span>
      <span>Evidence requires review before collecting</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5">
      <span className="capitalize">{booking.payment_status.replaceAll("_", " ")}</span>
      <span>·</span>
      <PaymentMethodBadge method={booking.payment_method} />
      <span>· {formatCurrency(booking.amount_paid)} paid</span>
      <span className="font-semibold text-red-700">· {formatCurrency(balance)} due</span>
    </span>
  );

  return (
    <SelectedBookingOverviewRow
      icon={<CreditCard className="size-4" />}
      label="Payment"
      summary={summary}
      action={
        <div className="flex items-center gap-2">
          {isCrmPendingBookingStatus(booking.status) && confirmPaymentAction && !isPaymentReview ? (
            <button
              type="button"
              onClick={() => setExpanded(!isExpanded)}
              className={overviewActionClass}
            >
              {isExpanded ? "Close" : "Review"}
            </button>
          ) : isExpanded ? (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className={overviewActionClass}
            >
              Close
            </button>
          ) : null}
          <PaymentActionMenu
            bookingId={booking.id}
            paymentStatus={booking.payment_status}
            paymentMethod={booking.payment_method}
            amountPaid={booking.amount_paid}
            pricePaid={price}
            paymentAction={paymentAction}
            triggerLabel={isPaymentReview ? "Review" : "Manage"}
            triggerVariant="panelSecondary"
            reviewRequired={isPaymentReview}
          />
        </div>
      }
    >
      {isExpanded ? (
        isPaymentReview ? (
          <div
            data-testid="selected-payment-review-explanation"
            className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-purple-900"
          >
            <div className="font-semibold text-purple-950">
              Payment Evidence Requires Review
            </div>
            <p className="mt-1 leading-relaxed text-purple-800/90">
              Authoritative order financial evidence is missing or inconsistent. Payment confirmation is locked until the discrepancy is resolved in reconciliation.
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <Link
                href="/crm/reconciliation"
                className="inline-flex items-center justify-center rounded-md border border-purple-300 bg-white px-2.5 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-50"
              >
                Open Reconciliation
              </Link>
              <Link
                href="/crm/cash-flow"
                className="inline-flex items-center justify-center rounded-md border border-purple-200 bg-white px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50"
              >
                View Cash Flow Ledger
              </Link>
            </div>
          </div>
        ) : (
          <SelectedBookingPaymentConfirmation
            booking={booking}
            confirmPaymentAction={confirmPaymentAction}
            onConfirmed={onChanged}
          />
        )
      ) : null}
    </SelectedBookingOverviewRow>
  );
}
