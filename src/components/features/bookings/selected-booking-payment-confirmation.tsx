"use client";

import { useState, useTransition } from "react";
import type { BookingActionFn, WorkspaceBookingRow } from "./booking-workspace-types";
import { cn } from "@/lib/utils";
import { getBookingPaymentDisplayState } from "@/lib/bookings/crm-booking-groups";

const METHODS = [
  ["cash", "Cash"],
  ["gcash", "GCash"],
  ["maya", "Maya"],
  ["card", "Card"],
  ["other", "Other"],
] as const;

const controlClass = "h-9 rounded-lg border border-[var(--cs-border)] bg-white px-3 text-sm text-[var(--cs-text)] outline-none focus:border-emerald-800";

export function SelectedBookingPaymentConfirmation({
  booking,
  confirmPaymentAction,
  onConfirmed,
}: {
  booking: WorkspaceBookingRow;
  confirmPaymentAction?: BookingActionFn;
  onConfirmed?: () => void;
}) {
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

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

  function confirm() {
    if (isPaymentReview || !confirmPaymentAction) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await confirmPaymentAction({
        bookingId: booking.id,
        paymentMethod: method,
        paymentReference: reference.trim() || undefined,
        note: note.trim() || undefined,
      });
      if (!result.success) {
        setFeedback({ ok: false, message: result.error ?? "Failed to confirm payment." });
        return;
      }
      setFeedback({ ok: true, message: "Payment confirmed. Booking is now active." });
      onConfirmed?.();
    });
  }

  if (isPaymentReview) {
    return (
      <div
        data-testid="payment-confirmation-review-locked"
        className="col-span-2 rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-purple-900"
      >
        <div className="font-semibold text-purple-950">Payment Confirmation Locked</div>
        <p className="mt-1 leading-relaxed text-purple-800/90">
          Order financial evidence requires review. Reconcile details before confirming payment.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <select value={method} onChange={(event) => setMethod(event.target.value)} disabled={isPending} aria-label="Payment method" className={controlClass}>
        {METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <input value={reference} onChange={(event) => setReference(event.target.value)} disabled={isPending} placeholder="Reference (optional)" aria-label="Payment reference" className={controlClass} />
      <input value={note} onChange={(event) => setNote(event.target.value)} disabled={isPending} placeholder="Internal note (optional)" aria-label="Payment note" className={cn(controlClass, "col-span-2")} />
      {feedback ? <p className={cn("col-span-2 rounded-lg px-3 py-2 text-xs font-semibold", feedback.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}>{feedback.message}</p> : null}
      <button type="button" onClick={confirm} disabled={isPending || !confirmPaymentAction || feedback?.ok === true} className="col-span-2 h-9 rounded-lg bg-emerald-900 text-sm font-semibold text-white disabled:opacity-50">
        {isPending ? "Confirming…" : "Confirm payment & finalize booking"}
      </button>
    </div>
  );
}
