import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  StaffAvatar,
  StatusPill,
  humanizeAttendanceValue,
} from "@/components/features/attendance/attendance-ui";
import { getAttendanceOverviewStatus } from "@/lib/attendance/overview-summary";
import type { AttendanceDayStaffState } from "@/lib/attendance/day-model";
import type { AttendanceScanEvent, AttendanceTab } from "@/lib/attendance/types";

function formatTime(value: string | null | undefined, timezone: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function shiftLabel(row: AttendanceDayStaffState): string {
  const window = row.currentShiftWindow ?? row.nextShiftWindow ?? row.shiftWindows[0];
  if (!window) return row.scheduleState === "day_off" ? "Day off" : "No schedule";
  return `${formatTime(window.scheduledStartAt, row.timezone)} – ${formatTime(
    window.scheduledEndAt,
    row.timezone
  )}`;
}

function scanDotClass(outcome: AttendanceScanEvent["outcome"]): string {
  if (outcome === "success") return "bg-[var(--cs-success)]";
  if (outcome === "blocked" || outcome === "error") return "bg-[var(--cs-error)]";
  return "bg-[var(--cs-warning)]";
}

export function StaffStatusRow({
  row,
  lastScan,
  onTabChange,
}: {
  row: AttendanceDayStaffState;
  lastScan?: AttendanceScanEvent;
  onTabChange: (tab: AttendanceTab) => void;
}) {
  const status = getAttendanceOverviewStatus(row);
  const targetTab: AttendanceTab = status.key === "needs_review" ? "exceptions" : "records";

  return (
    <tr className="border-t border-[var(--cs-border-soft)] transition-colors hover:bg-[var(--cs-surface-warm)]">
      <td className="px-3 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <StaffAvatar name={row.staffName} />
          <div className="min-w-0">
            <div className="truncate font-semibold text-[var(--cs-text)]">{row.staffName}</div>
            <div className="truncate text-xs capitalize text-[var(--cs-text-muted)]">
              {humanizeAttendanceValue(row.staffType ?? "staff")}
            </div>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-[var(--cs-text-secondary)]">
        {shiftLabel(row)}
      </td>
      <td className="px-3 py-3">
        <StatusPill value={status.label} tone={status.tone} />
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-[var(--cs-text-secondary)]">
        {formatTime(row.clockInAt, row.timezone)}
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-[var(--cs-text-secondary)]">
        {formatTime(row.clockOutAt, row.timezone)}
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        <span className="inline-flex items-center gap-2 text-[var(--cs-text-secondary)]">
          {lastScan ? formatTime(lastScan.created_at, row.timezone) : "—"}
          {lastScan ? (
            <span className={`size-1.5 rounded-full ${scanDotClass(lastScan.outcome)}`} />
          ) : null}
        </span>
      </td>
      <td className="px-3 py-3 text-right">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Open ${status.key === "needs_review" ? "review" : "attendance record"} for ${row.staffName}`}
          title={status.key === "needs_review" ? "Open review queue" : "Open records"}
          onClick={() => onTabChange(targetTab)}
          className="size-8 border-[var(--cs-border)]"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </td>
    </tr>
  );
}
