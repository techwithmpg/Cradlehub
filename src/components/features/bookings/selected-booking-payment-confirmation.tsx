"use client";

import { useState, useTransition } from "react";
import type { BookingActionFn, WorkspaceBookingRow } from "./booking-workspace-types";
import { cn } from "@/lib/utils";

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

  function confirm() {
    if (!confirmPaymentAction) return;
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
