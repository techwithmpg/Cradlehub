"use client";

import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import {
  formatScheduleTime,
  getTimelineBlockPercent,
  type TimelineHourMark,
  type TimelineRange,
} from "@/lib/utils/schedule-timeline";
import type { DailyTimelineAlert } from "./daily-timeline-alerts";
import { getTimelineStatus, type TimelineStatusFilter } from "./daily-timeline-operations";

type Props = {
  row: DailyScheduleStaffRow;
  date: string;
  now: Date | null;
  staffTypeLabel: string;
  range: TimelineRange;
  hourMarks: TimelineHourMark[];
  timelineMinWidth: number;
  selected: boolean;
  currentTimePercent: number | null;
  alerts: DailyTimelineAlert[];
  onStaffSelect: (staffId: string) => void;
  onBookingSelect: (staffId: string, bookingId: string) => void;
};

const STATUS_COLORS: Record<Exclude<TimelineStatusFilter, "all">, string> = {
  available: "bg-emerald-500",
  busy: "bg-amber-500",
  scheduled: "bg-sky-500",
  off: "bg-stone-400",
};

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function getBookingClass(status: string, type: string | null, conflict: boolean): string {
  if (conflict) return "border-red-300 bg-red-100 text-red-800";
  if (status === "in_progress") return "border-emerald-400 bg-emerald-600 text-white";
  if (type === "home_service") return "border-sky-300 bg-sky-100 text-sky-900";
  return "border-amber-300 bg-amber-50 text-amber-950";
}

export function DailyTimelineStaffRow({
  row,
  date,
  now,
  staffTypeLabel,
  range,
  hourMarks,
  timelineMinWidth,
  selected,
  currentTimePercent,
  alerts,
  onStaffSelect,
  onBookingSelect,
}: Props) {
  const status = getTimelineStatus(row, date, now);
  const conflictIds = new Set(alerts.flatMap((alert) => alert.bookingIds));

  return (
    <div
      className={selected ? "grid min-h-[72px] bg-emerald-50/40" : "grid min-h-[72px] bg-white hover:bg-stone-50/70"}
      style={{ gridTemplateColumns: `210px minmax(${timelineMinWidth}px, 1fr)` }}
    >
      <button
        type="button"
        onClick={() => onStaffSelect(row.staff_id)}
        className="sticky left-0 z-20 flex min-w-0 items-center gap-2 border-b border-r border-[var(--cs-border-soft)] bg-inherit px-3 text-left"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[11px] font-bold text-stone-700">
          {getInitials(row.staff_name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-[var(--cs-text)]">{row.staff_name}</span>
          <span className="block truncate text-[10px] text-[var(--cs-text-muted)]">{staffTypeLabel}</span>
        </span>
        <span className={`size-2 shrink-0 rounded-full ${STATUS_COLORS[status]}`} aria-label={status} />
      </button>

      <div
        className="relative min-h-[72px] overflow-hidden border-b border-[var(--cs-border-soft)]"
        style={{ minWidth: timelineMinWidth }}
        onClick={() => onStaffSelect(row.staff_id)}
      >
        {hourMarks.slice(0, -1).map((mark) => (
          <span
            key={mark.minutes}
            className="absolute inset-y-0 border-l border-stone-100"
            style={{ left: `${((mark.minutes - range.startMinutes) / range.totalMinutes) * 100}%` }}
          />
        ))}

        {row.schedule_windows.map((window) => {
          const position = getTimelineBlockPercent(window.startTime, window.endTime, range);
          const closing = window.shiftType === "closing";
          return (
            <button
              key={`${window.shiftType}-${window.startTime}-${window.endTime}`}
              type="button"
              onClick={() => onStaffSelect(row.staff_id)}
              className={
                closing
                  ? "absolute top-2 h-14 overflow-hidden rounded-md border border-sky-200 bg-sky-50/90 px-2 text-left text-sky-900"
                  : "absolute top-2 h-14 overflow-hidden rounded-md border border-emerald-200 bg-emerald-50/90 px-2 text-left text-emerald-900"
              }
              style={{ left: `${position.leftPercent}%`, width: `${position.widthPercent}%`, minWidth: 36 }}
              title={`${formatScheduleTime(window.startTime)} - ${formatScheduleTime(window.endTime)}`}
            >
              <span className="block truncate text-[10px] font-semibold">
                {formatScheduleTime(window.startTime)} - {formatScheduleTime(window.endTime)}
              </span>
              <span className="block truncate text-[9px] capitalize opacity-70">{window.shiftType} shift</span>
            </button>
          );
        })}

        {row.bookings.map((booking) => {
          const position = getTimelineBlockPercent(booking.start_time, booking.end_time, range);
          return (
            <button
              key={booking.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onBookingSelect(row.staff_id, booking.id);
              }}
              className={`absolute top-2 z-10 h-7 overflow-hidden rounded border px-1.5 text-left text-[9px] font-semibold shadow-sm ${getBookingClass(booking.status, booking.type, conflictIds.has(booking.id))}`}
              style={{ left: `${position.leftPercent}%`, width: `${position.widthPercent}%`, minWidth: 42 }}
              title={`${booking.service} - ${booking.customer}`}
            >
              <span className="block truncate">{booking.service}</span>
            </button>
          );
        })}

        {row.blocks.map((block) => {
          const position = getTimelineBlockPercent(block.start_time, block.end_time, range);
          return (
            <span
              key={block.id}
              className="absolute bottom-2 z-10 h-6 overflow-hidden rounded border border-orange-200 bg-orange-50 px-1.5 text-[9px] font-medium leading-6 text-orange-900"
              style={{ left: `${position.leftPercent}%`, width: `${position.widthPercent}%`, minWidth: 38 }}
              title={block.reason ?? "Blocked time"}
            >
              <span className="block truncate">{block.reason ?? "Blocked"}</span>
            </span>
          );
        })}

        {row.schedule_windows.length === 0 ? (
          <span className="absolute inset-y-0 left-3 flex items-center text-[11px] font-medium text-stone-500">Day off</span>
        ) : null}

        {currentTimePercent !== null ? (
          <span className="pointer-events-none absolute inset-y-0 z-20 w-px bg-emerald-600" style={{ left: `${currentTimePercent}%` }} />
        ) : null}
      </div>
    </div>
  );
}
