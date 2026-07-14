import { CheckCircle2, Clock3, TriangleAlert } from "lucide-react";
import type { WorkspaceBookingRow } from "./booking-workspace-types";
import { deriveSelectedBookingActivity } from "@/lib/bookings/selected-booking-activity";
import { cn } from "@/lib/utils";

function formatActivityTime(value: string): string {
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
export function SelectedBookingActivity({ booking }: { booking: WorkspaceBookingRow }) {
  const events = deriveSelectedBookingActivity(booking);
  if (events.length === 0) {
    return <p className="px-1 py-6 text-sm text-[var(--cs-text-muted)]">No timestamped activity is available for this booking yet.</p>;
}
  return (
    <ol className="relative ml-2 border-l border-[var(--cs-border)]">
      {events.map((event) => {
        const Icon = event.tone === "success" ? CheckCircle2 : event.tone === "warning" ? TriangleAlert : Clock3;
        return (
          <li key={event.id} className="relative pb-5 pl-7 last:pb-0">
            <span className={cn("absolute -left-3 top-0 flex size-6 items-center justify-center rounded-full border bg-white", event.tone === "success" ? "border-emerald-200 text-emerald-700" : event.tone === "warning" ? "border-amber-200 text-amber-700" : "border-[var(--cs-border)] text-[var(--cs-text-muted)]")}>
              <Icon className="size-3.5" />
            </span>
            <p className="text-sm font-semibold text-[var(--cs-text)]">{event.label}</p>
            <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">{formatActivityTime(event.occurredAt)}</p>
            {event.detail ? <p className="mt-1 text-xs text-[var(--cs-text-secondary)]">{event.detail}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
