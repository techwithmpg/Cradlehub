"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AdminDialog,
  AdminOverlayBody,
  AdminOverlayFooter,
  AdminOverlayHeader,
} from "@/components/shared/overlays";
import { Button } from "@/components/ui/button";
import { markBookingConfirmedAction, recordBookingFollowupAction } from "@/app/(dashboard)/crm/bookings/actions";
import { updateBookingStatusAction } from "@/app/(dashboard)/manager/bookings/actions";
import { formatTime } from "@/lib/utils";
import type { WorkspaceBookingRow } from "./bookings-workspace";

type OneOrMany<T> = T | T[] | null | undefined;
export type BookingFollowupResult = "confirmed" | "no_answer" | "reschedule" | "cancel";
type BookingFollowupSaveResult = BookingFollowupResult | "confirm_later";
type ActionFn = (input: unknown) => Promise<{ success: boolean; error?: string }>;

type BookingFollowupModalProps = {
  open: boolean;
  booking: WorkspaceBookingRow | null;
  initialResult?: BookingFollowupResult;
  cancelBookingAction?: ActionFn;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

const RESULT_OPTIONS: Array<{ value: BookingFollowupResult; label: string; description: string }> = [
  { value: "confirmed", label: "Confirmed", description: "Customer agreed to the appointment." },
  { value: "no_answer", label: "No Answer", description: "Keep this booking in follow-up." },
  { value: "reschedule", label: "Reschedule", description: "Record that the booking needs a new time." },
  { value: "cancel", label: "Cancel", description: "Cancel this booking after recording the reason." },
];

function first<T>(value: OneOrMany<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "long",
    day: "numeric",
  });
}

function sourceLabel(booking: WorkspaceBookingRow): string {
  if (booking.delivery_type === "home_service" || booking.type === "home_service") return "Home Service";
  if (booking.type === "online") return "Online";
  if (booking.type === "walkin") return "Walk-in";
  return booking.type ?? "Booking";
}

export function BookingFollowupModal({
  open,
  booking,
  initialResult = "confirmed",
  cancelBookingAction,
  onOpenChange,
  onSuccess,
}: BookingFollowupModalProps) {
  const [result, setResult] = useState<BookingFollowupResult>(initialResult);
  const [note, setNote] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!booking) return null;
  const currentBooking = booking;

  const customer = first(currentBooking.customers);
  const service = first(currentBooking.services);
  const branch = first(currentBooking.branches);

  function closeAfterSuccess(message: string) {
    toast.success(message);
    onSuccess();
    onOpenChange(false);
  }

  function handleSave(nextResult: BookingFollowupSaveResult = result) {
    setFeedback(null);
    if (nextResult === "cancel" && !note.trim()) {
      setFeedback({ ok: false, message: "Please add a cancellation reason." });
      return;
    }

    startTransition(async () => {
      if (nextResult === "confirmed") {
        const confirmed = await markBookingConfirmedAction({
          bookingId: currentBooking.id,
          note: note.trim() || undefined,
        });
        if (!confirmed.success) {
          setFeedback({ ok: false, message: confirmed.error ?? "Could not confirm booking." });
          return;
        }
        closeAfterSuccess("Booking confirmed.");
        return;
      }

      if (nextResult === "cancel") {
        const cancelAction = cancelBookingAction ?? updateBookingStatusAction;
        const cancelled = await cancelAction({
          bookingId: currentBooking.id,
          status: "cancelled",
          notes: note.trim(),
        });
        if (!cancelled.success) {
          setFeedback({ ok: false, message: cancelled.error ?? "Could not cancel booking." });
          return;
        }
        closeAfterSuccess("Booking cancelled.");
        return;
      }

      const followup = await recordBookingFollowupAction({
        bookingId: currentBooking.id,
        result: nextResult,
        note: note.trim() || undefined,
        followUpAt: followUpAt.trim() || undefined,
      });
      if (!followup.success) {
        setFeedback({ ok: false, message: followup.error ?? "Could not save follow-up." });
        return;
      }
      closeAfterSuccess(nextResult === "no_answer" ? "No-answer follow-up saved." : "Follow-up note saved.");
    });
  }

  return (
    <AdminDialog open={open} onOpenChange={onOpenChange} size="md" placement="center">
      <AdminOverlayHeader
        title="Booking Follow-up"
        description="Call customer, record the result, and move the booking forward."
      />
      <AdminOverlayBody className="bg-[var(--cs-surface-warm)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryItem label="Customer" value={customer?.full_name ?? "Customer"} />
              <SummaryItem label="Service" value={service?.name ?? "Service"} />
              <SummaryItem label="Date / Time" value={`${formatDate(currentBooking.booking_date)} at ${formatTime(currentBooking.start_time)}`} />
              <SummaryItem label="Branch" value={branch?.name ?? "Branch"} />
              <SummaryItem label="Source" value={sourceLabel(currentBooking)} />
              {customer?.phone ? <SummaryItem label="Phone" value={customer.phone} /> : null}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {RESULT_OPTIONS.map((option) => {
              const selected = result === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={isPending}
                  onClick={() => setResult(option.value)}
                  className={[
                    "rounded-xl border p-3 text-left transition-colors",
                    selected
                      ? "border-[var(--cs-sand)] bg-[var(--cs-sand-mist)]"
                      : "border-[var(--cs-border)] bg-[var(--cs-surface)] hover:border-[var(--cs-border-strong)]",
                  ].join(" ")}
                >
                  <div className="text-sm font-semibold text-[var(--cs-text)]">{option.label}</div>
                  <div className="mt-1 text-xs leading-5 text-[var(--cs-text-muted)]">{option.description}</div>
                </button>
              );
            })}
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
            CRM note
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={isPending}
              rows={3}
              className="mt-2 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--cs-text)] outline-none focus:border-[var(--cs-sand)]"
              placeholder={result === "cancel" ? "Cancellation reason" : "Optional internal note"}
            />
          </label>

          {result === "no_answer" ? (
            <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
              Follow-up time
              <input
                type="datetime-local"
                value={followUpAt}
                onChange={(event) => setFollowUpAt(event.target.value)}
                disabled={isPending}
                className="mt-2 h-10 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm normal-case tracking-normal text-[var(--cs-text)] outline-none focus:border-[var(--cs-sand)]"
              />
            </label>
          ) : null}

          {result === "reschedule" ? (
            <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs leading-5 text-[var(--cs-text-muted)]">
              The dedicated reschedule flow is not available from this modal yet. Saving will keep the follow-up note attached to the booking.
            </div>
          ) : null}

          {feedback ? (
            <div className={feedback.ok ? "text-sm font-medium text-emerald-700" : "text-sm font-medium text-red-700"}>
              {feedback.message}
            </div>
          ) : null}
        </div>
      </AdminOverlayBody>
      <AdminOverlayFooter className="flex flex-col gap-2 bg-[var(--cs-surface)] sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="secondary" disabled={isPending} onClick={() => handleSave("confirm_later")}>
            {isPending ? "Saving..." : "Confirm Later"}
          </Button>
          <Button type="button" disabled={isPending} onClick={() => handleSave()}>
            {isPending ? "Saving..." : "Save Result"}
          </Button>
        </div>
      </AdminOverlayFooter>
    </AdminDialog>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-[var(--cs-text)]" title={value}>
        {value}
      </div>
    </div>
  );
}
