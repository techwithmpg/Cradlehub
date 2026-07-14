"use client";

import { BedDouble, Clock3, Timer, UserRound } from "lucide-react";
import { HybridSelectedBookingCountdown } from "./hybrid-selected-booking-countdown";
import { cn, formatTime } from "@/lib/utils";
import { useServiceSessionCountdown } from "@/hooks/use-service-session-countdown";

// ── Types ─────────────────────────────────────────────────────────────────────

export type HybridBookingViewModel = {
  id: string;
  booking_code?: string | null;
  customer_name?: string | null;
  service_name?: string | null;
  staff_name?: string | null;
  resource_name?: string | null;
  booking_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status: string;
  booking_progress_status?: string | null;
  session_started_at?: string | null;
  session_completed_at?: string | null;
  service_duration?: number | null;
  duration_minutes?: number | null;
  type?: string | null;
};

export type HybridSelectedBookingCardProps = {
  booking: HybridBookingViewModel;
  /** Called once when the service countdown reaches zero (server must re-validate). */
  onAutoComplete?: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function customerInitials(name: string | null | undefined): string {
  if (!name) return "CH";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first  = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${second}`.toUpperCase() || "CH";
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function fmtDateLabel(date: string | null | undefined): string | null {
  if (!date) return null;
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function SummaryStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 border-t border-[var(--cs-border-soft)] px-3 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--cs-surface)] text-[var(--cs-text-secondary)]">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
          {label}
        </div>
        <div className="mt-0.5 truncate text-sm font-semibold leading-5 text-[var(--cs-text)]" title={value}>
          {value}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function HybridSelectedBookingCard({
  booking,
  onAutoComplete,
}: HybridSelectedBookingCardProps) {
  const durationMins = booking.service_duration ?? booking.duration_minutes ?? 60;
  const countdown = useServiceSessionCountdown({
    status: booking.status,
    progressStatus: booking.booking_progress_status,
    sessionStartedAt: booking.session_started_at,
    durationMinutes: durationMins,
    onDue: onAutoComplete,
  });
  const isServiceActive = countdown.active;
  const shouldShowCountdown = countdown.ready;
  const dateLabel = fmtDateLabel(booking.booking_date);
  const timeLabel = booking.start_time
    ? `${formatTime(booking.start_time)}${booking.end_time ? ` - ${formatTime(booking.end_time)}` : ""}`
    : "Time TBD";

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border shadow-[var(--cs-shadow-xs)]",
        isServiceActive
          ? "border-[var(--cs-success-bg)] bg-[var(--cs-surface)]"
          : "border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]"
      )}
    >
      <div className="flex items-center gap-3 p-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--cs-sand-mist)] text-lg font-bold text-[var(--cs-sand-dark)]">
          {customerInitials(booking.customer_name)}
        </div>
        <div className="min-w-0 flex-1">
          <h2
            className="truncate text-lg font-semibold leading-tight text-[var(--cs-text)]"
            title={booking.customer_name ?? undefined}
          >
            {booking.customer_name ?? "Customer"}
          </h2>
          <div className="mt-1 truncate text-sm leading-5 text-[var(--cs-text-secondary)]">
            {booking.service_name ?? "Service"}
            {dateLabel ? ` · ${dateLabel}` : ""}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2">
        <SummaryStat icon={<Clock3 size={16} />} label="Time" value={timeLabel} />
        <SummaryStat icon={<UserRound size={16} />} label="Staff" value={booking.staff_name ?? "Unassigned"} />
        <SummaryStat icon={<BedDouble size={16} />} label="Room" value={booking.resource_name ?? "Room TBD"} />
        <SummaryStat icon={<Timer size={16} />} label="Duration" value={`${durationMins} min`} />
      </div>

      {shouldShowCountdown && booking.session_started_at ? (
        <HybridSelectedBookingCountdown
          elapsedSeconds={countdown.elapsedSeconds}
          remainingSeconds={countdown.remainingSeconds}
          progressPercent={countdown.progressPercent}
          durationMinutes={durationMins}
          sessionStartedAt={booking.session_started_at}
          staffName={booking.staff_name}
          resourceName={booking.resource_name}
        />
      ) : null}
    </div>
  );
}
