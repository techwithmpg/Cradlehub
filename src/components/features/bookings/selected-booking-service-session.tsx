"use client";

import { useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { WorkspaceBookingRow } from "./booking-workspace-types";
import { crmCompleteServiceAction } from "@/app/(dashboard)/crm/bookings/actions";
import { autoCompleteDueSessionAction } from "@/app/(dashboard)/staff-portal/actions";
import {
  getBookingDurationMinutes,
  getBookingRoomLabel,
  getBookingStaffName,
} from "@/lib/bookings/booking-display";
import { useServiceSessionCountdown } from "@/hooks/use-service-session-countdown";

function countdownLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
function startedTime(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
}
export function SelectedBookingServiceSession({
  booking,
  onChanged,
}: {
  booking: WorkspaceBookingRow;
  onChanged?: () => void;
}) {
  const [isCompleting, startTransition] = useTransition();
  const duration = getBookingDurationMinutes(booking) || 60;

  function handleAutoComplete() {
    startTransition(async () => {
      const result = await autoCompleteDueSessionAction(booking.id);
      if (result.ok) toast.success("Service auto-completed.");
      else if (result.code !== "ALREADY_COMPLETED") toast.error(result.message ?? "Auto-complete failed.");
      onChanged?.();
    });
  }

  const countdown = useServiceSessionCountdown({
    status: booking.status,
    progressStatus: booking.booking_progress_status,
    sessionStartedAt: booking.session_started_at,
    durationMinutes: duration,
    onDue: handleAutoComplete,
  });

  function handleComplete() {
    startTransition(async () => {
      const result = await crmCompleteServiceAction({ bookingId: booking.id });
      if (!result.success) {
        toast.error(result.error ?? "Could not complete service.");
        return;
      }
      toast.success("Service completed.");
      onChanged?.();
    });
  }

  if (!countdown.active) return null;
  const startLabel = startedTime(booking.session_started_at);
  const minutesRemaining = Math.ceil(countdown.remainingSeconds / 60);

  return (
    <section className="mx-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-800">In service</p>
          <p className="mt-1 text-xs text-emerald-900/75">
            {startLabel ? `Started ${startLabel}` : "Service started"} · {countdown.overtime ? "Ready to complete" : `${minutesRemaining} min remaining`}
          </p>
        </div>
        <span className="text-2xl font-bold tabular-nums text-emerald-900">
          {countdown.ready ? countdownLabel(countdown.overtime ? countdown.elapsedSeconds - duration * 60 : countdown.remainingSeconds) : "--:--"}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-900/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(countdown.progressPercent)}>
        <div className="h-full rounded-full bg-emerald-700 transition-[width] duration-700" style={{ width: `${countdown.progressPercent}%` }} />
      </div>
      <p className="mt-2 truncate text-xs text-emerald-900/70">{getBookingStaffName(booking)} · {getBookingRoomLabel(booking)}</p>
      <button type="button" onClick={handleComplete} disabled={isCompleting} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60">
        <CheckCircle2 className="size-4" />
        {isCompleting ? "Completing…" : "Complete Service"}
      </button>
    </section>
  );
}
