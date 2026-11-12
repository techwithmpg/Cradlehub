"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { recordBookingFollowupAction } from "@/app/(dashboard)/crm/bookings/actions";
import {
  convertWaitlistToBookingSlotAction,
  findMatchingWaitlistForSlotAction,
  type MatchingWaitlistCandidate,
} from "@/app/(dashboard)/crm/waitlist/actions";
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
  const [waitlistCandidates, setWaitlistCandidates] = useState<MatchingWaitlistCandidate[]>([]);
  const [selectedWaitlistId, setSelectedWaitlistId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const customer = firstBookingRelation(booking.customers);
  const service = firstBookingRelation(booking.services);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    findMatchingWaitlistForSlotAction({
      bookingDate: booking.booking_date,
      serviceId: service?.id ?? null,
    })
      .then((res) => {
        if (!cancelled && res.ok) {
          setWaitlistCandidates(res.candidates);
          setSelectedWaitlistId(res.candidates[0]?.id ?? null);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, booking.booking_date, service?.id]);

  function resetForm() {
    setReason(null);
    setNote("");
    setError(null);
    setSelectedWaitlistId(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (isPending) return;
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }

  function cancelBooking(fillWithWaitlistId?: string | null) {
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

      if (fillWithWaitlistId && service?.id) {
        const fillRes = await convertWaitlistToBookingSlotAction({
          waitlistId: fillWithWaitlistId,
          date: booking.booking_date,
          startTime: booking.start_time,
          serviceId: service.id,
          staffId: booking.staff_id,
          resourceId: booking.resource_id,
        });
        if (fillRes.ok) {
          toast.success(fillRes.message);
        } else {
          toast.warning(`Booking cancelled, but waitlist auto-fill needed review: ${fillRes.message}`);
        }
      } else {
        toast.success("Booking cancelled.");
      }

      onChanged?.();
      resetForm();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>Cancel booking?</DialogTitle>
          <DialogDescription>
            Records the cancellation reason and frees the therapist and room slot.
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
            className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
            rows={2}
            placeholder="Add internal context"
          />
        </div>

        {waitlistCandidates.length > 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-emerald-950">
              <Sparkles className="size-3.5 text-emerald-700" />
              Smart Slot Recovery ({waitlistCandidates.length} on Waitlist)
            </div>
            <p className="mt-0.5 text-emerald-800">
              Fill this freed {formatTime(booking.start_time)} slot immediately with a waiting guest:
            </p>
            <div className="mt-2 space-y-1.5">
              {waitlistCandidates.map((cand) => (
                <label
                  key={cand.id}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border p-2 transition ${
                    selectedWaitlistId === cand.id
                      ? "border-emerald-600 bg-white font-semibold text-emerald-950"
                      : "border-emerald-200/80 bg-white/60 text-neutral-700"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="waitlist-fill"
                      checked={selectedWaitlistId === cand.id}
                      onChange={() => setSelectedWaitlistId(cand.id)}
                    />
                    <span>
                      {cand.customer_name} ({cand.customer_phone})
                      {cand.service_name ? ` · ${cand.service_name}` : ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}

        <DialogFooter className="flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={isPending} onClick={() => handleOpenChange(false)}>
            Keep Booking
          </Button>
          {waitlistCandidates.length > 0 && selectedWaitlistId ? (
            <Button
              type="button"
              disabled={isPending}
              onClick={() => cancelBooking(selectedWaitlistId)}
              className="bg-emerald-700 text-white hover:bg-emerald-800"
            >
              <UserCheck className="mr-1.5 size-4" />
              {isPending ? "Swapping…" : "Cancel & Fill from Waitlist"}
            </Button>
          ) : null}
          <Button type="button" variant="destructive" disabled={isPending} onClick={() => cancelBooking(null)}>
            {isPending ? "Cancelling…" : "Cancel Only"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
