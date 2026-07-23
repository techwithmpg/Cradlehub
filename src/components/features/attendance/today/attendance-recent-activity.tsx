import { AlertTriangle, CheckCircle2, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  formatAttendanceDateTime,
} from "@/components/features/attendance/attendance-ui";
import { presentAttendanceScanEvent } from "@/lib/attendance/scan-event-presentation";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

export function AttendanceRecentActivity({
  data,
  onViewHistory,
}: {
  data: AttendanceWorkspaceData;
  onViewHistory: () => void;
}) {
  const events = data.scanEvents.slice(0, 8);
  return (
    <section
      className="overflow-hidden rounded-2xl border border-[var(--cs-border)] bg-white shadow-sm"
      aria-labelledby="recent-scan-heading"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--cs-border-soft)] px-4 py-3">
        <div>
          <h2 id="recent-scan-heading" className="text-base font-bold">
            Recent Scan Activity
          </h2>
          <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
            Latest successful and blocked Attendance scans.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onViewHistory}>
          View all activity
        </Button>
      </div>
      {events.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No scans yet" detail="Today’s Attendance scans will appear here." />
        </div>
      ) : (
        <div className="divide-y divide-[var(--cs-border-soft)]">
          {events.map((event) => {
            const presentation = presentAttendanceScanEvent(event);
            const Icon =
              presentation.tone === "success"
                ? CheckCircle2
                : presentation.tone === "error"
                  ? CircleX
                  : AlertTriangle;
            const tone =
              presentation.tone === "success"
                ? "bg-emerald-50 text-emerald-700"
                : presentation.tone === "error"
                  ? "bg-red-50 text-red-700"
                  : "bg-amber-50 text-amber-700";
            return (
              <div
                key={event.id}
                className="grid gap-2 px-4 py-3 sm:grid-cols-[32px_minmax(150px,1fr)_minmax(130px,.8fr)_120px_minmax(120px,.8fr)] sm:items-center"
              >
                <span className={`flex size-8 items-center justify-center rounded-full ${tone}`}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">
                    {event.staff_name ?? "Unknown phone"}
                  </div>
                  <div className="text-xs text-[var(--cs-text-muted)]">{presentation.label}</div>
                </div>
                <div className="text-xs text-[var(--cs-text-secondary)]">
                  {formatAttendanceDateTime(event.created_at, data.timezone)}
                </div>
                <div className="truncate text-xs text-[var(--cs-text-muted)]">
                  {event.point_label ?? data.branchName}
                </div>
                <details className="text-xs text-[var(--cs-text-muted)]">
                  <summary className="cursor-pointer font-semibold text-[var(--cs-text-secondary)]">
                    System details
                  </summary>
                  <div className="mt-1 break-words">
                    {event.reason_code ?? event.action} · {event.outcome}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
