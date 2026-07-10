"use client";

import { CalendarOff, Clock3, Moon, Sun } from "lucide-react";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import {
  buildTimelineRange,
  getCurrentTimePercent,
  getTimelineHourMarks,
  isToday,
} from "@/lib/utils/schedule-timeline";
import type { LiveScheduleConflict } from "@/lib/schedule/live-schedule-conflict-types";
import {
  getShiftGroup,
  getStaffTypeLabel,
  type ShiftGroupKey,
} from "./daily-timeline-operations";
import { DailyTimelineStaffRow } from "./daily-timeline-staff-row";

const SHIFT_GROUPS: Array<{
  key: ShiftGroupKey;
  label: string;
  icon: typeof Sun;
  className: string;
}> = [
  { key: "opening", label: "Opening Shift", icon: Sun, className: "bg-amber-50 text-amber-950" },
  { key: "regular", label: "Regular Shift", icon: Clock3, className: "bg-stone-50 text-stone-800" },
  { key: "closing", label: "Closing Shift", icon: Moon, className: "bg-sky-50 text-sky-950" },
  { key: "off", label: "Day Off", icon: CalendarOff, className: "bg-stone-100 text-stone-700" },
];

type Props = {
  rows: DailyScheduleStaffRow[];
  date: string;
  now: Date | null;
  staffTypeById: Map<string, string | null>;
  conflicts: LiveScheduleConflict[];
  selectedStaffId: string | null;
  onStaffSelect: (staffId: string) => void;
  onBookingSelect: (staffId: string, bookingId: string) => void;
};

export function DailyTimelineBoard({
  rows,
  date,
  now,
  staffTypeById,
  conflicts,
  selectedStaffId,
  onStaffSelect,
  onBookingSelect,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-lg border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface)] px-6 text-center">
        <div>
          <UsersEmptyIcon />
          <p className="mt-3 text-sm font-semibold text-[var(--cs-text)]">No staff match these filters</p>
          <p className="mt-1 text-xs text-[var(--cs-text-muted)]">Adjust the staff group, shift, status, or search.</p>
        </div>
      </div>
    );
  }

  const range = buildTimelineRange(rows);
  const hourMarks = getTimelineHourMarks(range);
  const timelineMinWidth = Math.max(760, range.hourCount * 76);
  const currentTimePercent = now && isToday(date, now) ? getCurrentTimePercent(range, now) : null;

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--cs-border)] bg-white shadow-sm">
      <div className="max-h-[660px] overflow-auto">
        <div style={{ minWidth: 210 + timelineMinWidth }}>
          <div
            className="sticky top-0 z-30 grid h-14 bg-white"
            style={{ gridTemplateColumns: `210px minmax(${timelineMinWidth}px, 1fr)` }}
          >
            <div className="sticky left-0 z-40 flex items-center border-b border-r border-[var(--cs-border)] bg-white px-3">
              <div>
                <p className="text-xs font-bold text-[var(--cs-text)]">Staff</p>
                <p className="text-[10px] text-[var(--cs-text-muted)]">{rows.length} in view</p>
              </div>
            </div>
            <div className="relative border-b border-[var(--cs-border)]" style={{ minWidth: timelineMinWidth }}>
              {hourMarks.map((mark) => {
                const isStart = mark.minutes === range.startMinutes;
                const isEnd = mark.minutes === range.endMinutes;
                return (
                  <span
                    key={mark.minutes}
                    className="absolute bottom-2 text-[10px] font-medium text-[var(--cs-text-muted)]"
                    style={{
                      left: isStart ? 8 : isEnd ? undefined : `${((mark.minutes - range.startMinutes) / range.totalMinutes) * 100}%`,
                      right: isEnd ? 8 : undefined,
                      transform: isStart || isEnd ? undefined : "translateX(-50%)",
                    }}
                  >
                    {mark.label}
                  </span>
                );
              })}
              {currentTimePercent !== null ? (
                <span
                  className="absolute bottom-0 top-0 z-10 w-px bg-emerald-600"
                  style={{ left: `${currentTimePercent}%` }}
                >
                  <span className="absolute left-1/2 top-1 -translate-x-1/2 rounded bg-emerald-700 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    Now
                  </span>
                </span>
              ) : null}
            </div>
          </div>

          {SHIFT_GROUPS.map((group) => {
            const groupRows = rows.filter((row) => getShiftGroup(row) === group.key);
            if (groupRows.length === 0) return null;
            const Icon = group.icon;
            return (
              <section key={group.key} aria-label={group.label}>
                <div
                  className={`sticky top-14 z-20 grid h-9 ${group.className}`}
                  style={{ gridTemplateColumns: `210px minmax(${timelineMinWidth}px, 1fr)` }}
                >
                  <div className="sticky left-0 z-30 flex items-center gap-2 border-b border-r border-black/5 bg-inherit px-3 text-xs font-bold">
                    <Icon className="size-3.5" />
                    {group.label}
                  </div>
                  <div className="flex items-center justify-end border-b border-black/5 px-3 text-[10px] font-semibold">
                    {groupRows.length} staff
                  </div>
                </div>
                {groupRows.map((row) => (
                  <DailyTimelineStaffRow
                    key={row.staff_id}
                    row={row}
                    date={date}
                    now={now}
                    staffTypeLabel={getStaffTypeLabel(staffTypeById.get(row.staff_id))}
                    range={range}
                    hourMarks={hourMarks}
                    timelineMinWidth={timelineMinWidth}
                    selected={selectedStaffId === row.staff_id}
                    currentTimePercent={currentTimePercent}
                    conflicts={conflicts.filter((conflict) => conflict.affected_staff_ids.includes(row.staff_id))}
                    onStaffSelect={onStaffSelect}
                    onBookingSelect={onBookingSelect}
                  />
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function UsersEmptyIcon() {
  return (
    <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-stone-100 text-lg text-stone-500" aria-hidden="true">
      0
    </span>
  );
}
