"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Home, Phone } from "lucide-react";
import { toast } from "sonner";
import type { WorkspaceBookingRow } from "./booking-workspace-types";
import { crmStartServiceAction, markBookingConfirmedAction } from "@/app/(dashboard)/crm/bookings/actions";
import { firstBookingRelation } from "@/lib/bookings/booking-display";
import { getSelectedBookingActionPlan, type SelectedBookingActionId } from "@/lib/bookings/selected-booking-panel";

export function SelectedBookingPrimaryAction({
  booking,
  dispatchHref,
  onOpenArrival,
  onOpenRoom,
  onSessionStarted,
  onChanged,
}: {
  booking: WorkspaceBookingRow;
  dispatchHref?: string;
  onOpenArrival: () => void;
  onOpenRoom: () => void;
  onSessionStarted: (startedAt: string) => void;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const plan = getSelectedBookingActionPlan({
    status: booking.status,
    bookingProgressStatus: booking.booking_progress_status,
    type: booking.type,
    deliveryType: booking.delivery_type,
    resourceId: booking.resource_id,
    hasStaff: Boolean(firstBookingRelation(booking.staff)),
    hasDriver: false,
    hasDispatchHref: Boolean(dispatchHref),
  });

  function run(actionId: SelectedBookingActionId) {
    setFeedback(null);
    if (actionId === "confirm") {
      startTransition(async () => {
        const result = await markBookingConfirmedAction({ bookingId: booking.id });
        if (!result.success) {
          toast.error(result.error ?? "Booking update failed. Please try again.");
          return;
        }
        toast.success("Booking confirmed.");
        onChanged?.();
      });
      return;
    }
    if (actionId === "call") {
      const phone = firstBookingRelation(booking.customers)?.phone?.trim();
      if (!phone) {
        toast.error("No customer phone number is available.");
        return;
      }
      window.location.href = `tel:${phone}`;
      return;
    }
    if (actionId === "mark_arrived") return onOpenArrival();
    if (actionId === "assign_room" || actionId === "change_room") return onOpenRoom();
    if (actionId === "open_dispatch" || actionId === "track_dispatch") {
      if (dispatchHref) router.push(dispatchHref);
      return;
    }
    if (actionId === "review_record") {
      setFeedback("The completed booking record is open below.");
      return;
    }
    if (actionId !== "start_service") return;

    startTransition(async () => {
      const result = await crmStartServiceAction({ bookingId: booking.id });
      if (!result.success) {
        toast.error(result.error ?? "Could not start service.");
        return;
      }
      const startedAt = new Date().toISOString();
      onSessionStarted(startedAt);
      toast.success("Service started.");
      onChanged?.();
    });
  }

  if (plan.mode === "active_service" || !plan.primary) return null;
  const Icon = plan.primary.id === "open_dispatch" || plan.primary.id === "track_dispatch" ? Home : plan.primary.id === "call" ? Phone : CheckCircle2;
  const pendingLabel = plan.primary.id === "confirm" ? "Confirming…" : "Working…";

  return (
    <div className="mx-5">
      <button type="button" disabled={isPending} onClick={() => run(plan.primary!.id)} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">
        <Icon className="size-5" />
        {isPending ? pendingLabel : plan.primary.label}
      </button>
      {feedback ? <p className="mt-2 text-center text-xs text-[var(--cs-text-muted)]">{feedback}</p> : null}
    </div>
  );
}
