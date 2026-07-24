"use client";

import { useTransition } from "react";
import { CheckCircle2, Clock3 } from "lucide-react";
import { toast } from "sonner";
import {
  AdminDialog,
  AdminOverlayBody,
  AdminOverlayFooter,
  AdminOverlayHeader,
} from "@/components/shared/overlays";
import { crmCompleteServiceAction } from "@/app/(dashboard)/crm/bookings/actions";
import type { CradleFlowBooking } from "@/lib/crm/cradle-flow";

function time(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isFinite(parsed.getTime())) {
    return parsed.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
  }
  return value.slice(0, 5);
}

export function CradleFlowCompleteDialog({
  booking,
  open,
  onOpenChange,
  onCompleted,
}: {
  booking: CradleFlowBooking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: (booking: CradleFlowBooking, completedAt: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  if (!booking) return null;
  const currentBooking = booking;

  function complete() {
    startTransition(async () => {
      const result = await crmCompleteServiceAction({ bookingId: currentBooking.id });
      if (!result.success) {
        toast.error(result.error ?? "Could not complete service.");
        return;
      }
      const completedAt = new Date().toISOString();
      onCompleted(currentBooking, completedAt);
      onOpenChange(false);
      toast.success("Service completed", {
        description: "The booking is now ready for payment.",
      });
    });
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      placement="center"
      size="md"
      ariaLabel="Complete service"
    >
      <AdminOverlayHeader
        title="Complete Service"
        description="Confirm the service is finished. Payment remains separate."
      />
      <AdminOverlayBody className="grid gap-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="text-lg font-extrabold text-emerald-950">
            {booking.customer_name ?? "Customer"}
          </div>
          <div className="mt-1 text-sm text-emerald-900/75">
            {booking.service_name ?? "Service"} · {booking.staff_name ?? "Therapist"}
          </div>
        </div>
        <dl className="grid gap-3 sm:grid-cols-3">
          {[
            ["Actual start", time(booking.session_started_at)],
            ["Expected end", time(booking.session_due_at ?? booking.end_time)],
            ["Completing now", time(new Date().toISOString())],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-[var(--cs-border-soft)] p-3">
              <dt className="flex items-center gap-1 text-[10px] font-bold uppercase text-[var(--cs-text-muted)]">
                <Clock3 className="size-3" /> {label}
              </dt>
              <dd className="mt-1 text-sm font-bold text-[var(--cs-text)]">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-3 text-xs leading-5 text-[var(--cs-text-secondary)]">
          Additional services, duration corrections, price overrides, Home Service travel changes,
          and commission review remain available from the full booking record.
        </div>
      </AdminOverlayBody>
      <AdminOverlayFooter className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
          className="cs-btn cs-btn-secondary h-10 rounded-lg px-4"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={complete}
          disabled={isPending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#164b36] px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          <CheckCircle2 className="size-4" />
          {isPending ? "Completing…" : "Mark Service Complete"}
        </button>
      </AdminOverlayFooter>
    </AdminDialog>
  );
}
