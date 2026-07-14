import type { WorkspaceBookingRow } from "./booking-workspace-types";
import { getBookingOperationalStatus } from "@/lib/bookings/booking-display";
import { cn } from "@/lib/utils";

const TONE_CLASS = {
  pending: "border-amber-300 bg-amber-50 text-amber-800",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  waiting: "border-amber-200 bg-[var(--cs-sand-tint)] text-[var(--cs-sand-dark)]",
  service: "border-emerald-200 bg-emerald-50 text-emerald-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  neutral: "border-[var(--cs-border)] bg-[var(--cs-surface-warm)] text-[var(--cs-text-secondary)]",
  danger: "border-red-200 bg-red-50 text-red-700",
} as const;

export function BookingStatusPill({ booking }: { booking: WorkspaceBookingRow }) {
  const status = getBookingOperationalStatus(booking);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize whitespace-nowrap",
        TONE_CLASS[status.tone]
      )}
    >
      {status.label}
    </span>
  );
}
