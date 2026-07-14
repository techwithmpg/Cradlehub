"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { recordBookingFollowupAction } from "@/app/(dashboard)/crm/bookings/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  BOOKING_CANCELLATION_REASONS,
  type BookingCancellationReason,
} from "@/lib/bookings/cancellation-reasons";
import { firstBookingRelation } from "@/lib/bookings/booking-display";
import { formatTime } from "@/lib/utils";
import type { WorkspaceBookingRow } from "./booking-workspace-types";

function formatBookingDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CancelBookingDialog({
  booking,
  open,
  onOpenChange,
  onChanged,
}: {
  booking: WorkspaceBookingRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [reason, setReason] = useState<BookingCancellationReason | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const customer = firstBookingRelation(booking.customers);
  const service = firstBookingRelation(booking.services);

  function resetForm() {
    setReason(null);
    setNote("");
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (isPending) return;
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }

  function cancelBooking() {
    if (!reason) {
      setError("Select a cancellation reason.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await recordBookingFollowupAction({
        bookingId: booking.id,
        result: "cancel",
        cancellationReason: reason,
        note: note.trim() || undefined,
      });
      if (!result.success) {
        const message = result.error ?? "Booking update failed. Please try again.";
        setError(message);
        toast.error(message);
        return;
      }

      onChanged?.();
      resetForm();
      onOpenChange(false);
      toast.success("Booking cancelled.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>Cancel booking?</DialogTitle>
          <DialogDescription>
            This keeps the existing cancellation workflow and records the reason in the booking history.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3 text-sm">
          <dt className="text-[var(--cs-text-muted)]">Customer</dt>
          <dd className="truncate font-semibold text-[var(--cs-text)]">{customer?.full_name ?? "Customer"}</dd>
          <dt className="text-[var(--cs-text-muted)]">Service</dt>
          <dd className="truncate text-[var(--cs-text)]">{service?.name ?? "Service"}</dd>
          <dt className="text-[var(--cs-text-muted)]">Date</dt>
          <dd className="text-[var(--cs-text)]">{formatBookingDate(booking.booking_date)}</dd>
          <dt className="text-[var(--cs-text-muted)]">Time</dt>
          <dd className="text-[var(--cs-text)]">{formatTime(booking.start_time)}</dd>
        </dl>

        <div className="grid gap-2">
          <label id="cancellation-reason-label" className="text-sm font-semibold text-[var(--cs-text)]">
            Reason <span aria-hidden="true" className="text-red-700">*</span>
          </label>
          <select
            id="cancellation-reason"
            aria-labelledby="cancellation-reason-label"
            aria-invalid={Boolean(error && !reason)}
            value={reason ?? ""}
            onChange={(event) => {
              const value = event.target.value as BookingCancellationReason | "";
              setReason(value || null);
              if (value) setError(null);
            }}
            disabled={isPending}
            className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
          >
            <option value="">Select a reason</option>
            {BOOKING_CANCELLATION_REASONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label htmlFor="cancellation-note" className="text-sm font-semibold text-[var(--cs-text)]">
            Note <span className="font-normal text-[var(--cs-text-muted)]">(optional)</span>
          </label>
          <Textarea
            id="cancellation-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={isPending}
            maxLength={500}
            rows={3}
            placeholder="Add internal context"
          />
        </div>

        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={isPending} onClick={() => handleOpenChange(false)}>
            Keep Booking
          </Button>
          <Button type="button" variant="destructive" disabled={isPending} onClick={cancelBooking}>
            {isPending ? "Cancelling…" : "Cancel Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
