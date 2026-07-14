"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { PaymentActionMenu } from "@/components/features/dashboard/payment-action-menu";
import { PaymentMethodBadge } from "@/components/features/dashboard/payment-method-badge";
import type { BookingActionFn, WorkspaceBookingRow } from "./booking-workspace-types";
import { SelectedBookingOverviewRow, overviewActionClass } from "./selected-booking-overview-row";
import { SelectedBookingPaymentConfirmation } from "./selected-booking-payment-confirmation";
import { readBookingPrice } from "@/lib/bookings/booking-display";
import { isCrmPendingBookingStatus } from "@/lib/bookings/crm-booking-status";
import { formatCurrency } from "@/lib/utils";

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
  const summary = (
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
          {isCrmPendingBookingStatus(booking.status) && confirmPaymentAction ? (
            <button type="button" onClick={() => setExpanded(!isExpanded)} className={overviewActionClass}>{isExpanded ? "Close" : "Review"}</button>
          ) : null}
          <PaymentActionMenu bookingId={booking.id} paymentStatus={booking.payment_status} paymentMethod={booking.payment_method} amountPaid={booking.amount_paid} pricePaid={price} paymentAction={paymentAction} onUpdate={onChanged} triggerLabel="Manage" triggerVariant="panelSecondary" />
        </div>
      }
    >
      {isExpanded ? <SelectedBookingPaymentConfirmation booking={booking} confirmPaymentAction={confirmPaymentAction} onConfirmed={onChanged} /> : null}
    </SelectedBookingOverviewRow>
  );
}
