"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Moon,
  X,
} from "lucide-react";
import {
  AdminDialog,
  AdminOverlayBody,
} from "@/components/shared/overlays";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatShiftTimeRange, formatTime12h } from "@/lib/utils/time-format";
import { getStaffAdminName } from "@/lib/staff/display-name";
import {
  addDaysToYmd,
  formatBranchYmd,
  getBranchBusinessDate,
  getDayOfWeekFromYmd,
  getMondayOfWeekYmd,
} from "@/lib/engine/slot-time";
import {
  getStaffFullScheduleAction,
  type StaffFullScheduleData,
} from "@/app/(dashboard)/crm/schedule/actions";

type CalendarView = "day" | "week" | "month";
type ShiftType = "opening" | "closing" | "regular";

export type StaffScheduleCalendarModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: {
    id: string;
    full_name: string;
    nickname?: string | null;
    avatar_url?: string | null;
    staff_type?: string | null;
    system_role?: string | null;
    branch_name?: string | null;
  } | null;
  initialDate: string;
  branchName?: string | null;
};

type ShiftBlock = {
  id: string;
  date: string;
  type: ShiftType;
  label: string;
  start_time: string;
  end_time: string;
  source: "individual" | "group" | "override";
  isOvernight: boolean;
};

type DayModel = {
  date: string;
  isDayOff: boolean;
  dayOffReason: string | null;
  shifts: ShiftBlock[];
  bookings: StaffFullScheduleData["bookings"];
  blockedTimes: StaffFullScheduleData["blocked_times"];
};

const WEEKDAYS = [
  { dow: 1, label: "Monday", short: "Mon" },
  { dow: 2, label: "Tuesday", short: "Tue" },
  { dow: 3, label: "Wednesday", short: "Wed" },
  { dow: 4, label: "Thursday", short: "Thu" },
  { dow: 5, label: "Friday", short: "Fri" },
  { dow: 6, label: "Saturday", short: "Sat" },
  { dow: 0, label: "Sunday", short: "Sun" },
] as const;

const TIMELINE_START = 6 * 60;
const TIMELINE_END = 26 * 60;
const TIMELINE_MINUTES = TIMELINE_END - TIMELINE_START;
const TIME_LABELS = [
  { minutes: 6 * 60, label: "6 AM" },
  { minutes: 8 * 60, label: "8 AM" },
  { minutes: 10 * 60, label: "10 AM" },
  { minutes: 12 * 60, label: "12 PM" },
  { minutes: 14 * 60, label: "2 PM" },
  { minutes: 16 * 60, label: "4 PM" },
  { minutes: 18 * 60, label: "6 PM" },
  { minutes: 20 * 60, label: "8 PM" },
  { minutes: 22 * 60, label: "10 PM" },
  { minutes: 24 * 60, label: "12 AM" },
  { minutes: 26 * 60, label: "2 AM" },
];

const VIEW_TABS: Array<{ value: CalendarView; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const SHIFT_META: Record<ShiftType, { label: string; chip: string; block: string; dot: string }> = {
  opening: {
    label: "Opening Shift",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
    block: "border-emerald-200 bg-emerald-50 text-emerald-900",
    dot: "bg-emerald-500",
  },
  closing: {
    label: "Closing Shift",
    chip: "border-blue-200 bg-blue-50 text-blue-800",
    block: "border-blue-200 bg-blue-50 text-blue-900",
    dot: "bg-blue-500",
  },
  regular: {
    label: "Regular Shift",
    chip: "border-[var(--cs-sand-mist)] bg-[var(--cs-sand-tint)] text-[var(--cs-sand-dark)]",
    block: "border-[var(--cs-sand-mist)] bg-[var(--cs-sand-tint)] text-[var(--cs-sand-dark)]",
    dot: "bg-[var(--cs-sand)]",
  },
};

const LEGEND_ITEMS = [
  { label: "Opening Shift", className: "bg-emerald-500" },
  { label: "Closing Shift", className: "bg-blue-500" },
  { label: "Regular Shift", className: "bg-[var(--cs-sand)]" },
  { label: "Appointment", className: "bg-[var(--cs-crm-text)]" },
  { label: "Day Off", className: "bg-slate-300" },
  { label: "Blocked Time", className: "bg-rose-400" },
];

function ymdParts(date: string): { year: number; month: number; day: number } {
  const [yearRaw = "", monthRaw = "", dayRaw = ""] = date.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    const branchDate = getBranchBusinessDate();
    const [fallbackYear = "1970", fallbackMonth = "01", fallbackDay = "01"] =
      branchDate.split("-");
    return {
      year: Number(fallbackYear),
      month: Number(fallbackMonth),
      day: Number(fallbackDay),
    };
  }
  return { year, month, day };
}

function ymdFromParts(year: number, month: number, day: number): string {
  const normalized = new Date(Date.UTC(year, month - 1, day, 12));
  return [
    String(normalized.getUTCFullYear()),
    String(normalized.getUTCMonth() + 1).padStart(2, "0"),
    String(normalized.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function startOfMonthYmd(date: string): string {
  const { year, month } = ymdParts(date);
  return ymdFromParts(year, month, 1);
}

function endOfMonthYmd(date: string): string {
  const { year, month } = ymdParts(date);
  return ymdFromParts(year, month + 1, 0);
}

function addMonthsToMonthStartYmd(date: string, months: number): string {
  const { year, month } = ymdParts(date);
  return ymdFromParts(year, month + months, 1);
}

function formatDateLabel(date: string): string {
  return formatBranchYmd(date, {
    month: "short",
    day: "numeric",
  });
}

function formatLongDateLabel(date: string): string {
  return formatBranchYmd(date, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatRangeLabel(startDate: string, endDate: string, view: CalendarView): string {
  if (view === "month") {
    return formatBranchYmd(startDate, { month: "long", year: "numeric" });
  }
  if (startDate === endDate) return formatLongDateLabel(startDate);
  const startYear = ymdParts(startDate).year;
  const endYear = ymdParts(endDate).year;
  const sameYear = startYear === endYear;
  const startLabel = formatBranchYmd(startDate, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  const endLabel = formatBranchYmd(endDate, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  return sameYear ? `${startLabel} - ${endLabel}, ${endYear}` : `${startLabel} - ${endLabel}`;
}

function getDateRange(anchorDate: string, view: CalendarView): { startDate: string; endDate: string } {
  if (view === "day") {
    return { startDate: anchorDate, endDate: anchorDate };
  }
  if (view === "month") {
    return {
      startDate: startOfMonthYmd(anchorDate),
      endDate: endOfMonthYmd(anchorDate),
    };
  }
  const start = getMondayOfWeekYmd(anchorDate);
  return {
    startDate: start,
    endDate: addDaysToYmd(start, 6),
  };
}

function getWeekDays(anchorDate: string): string[] {
  const start = getMondayOfWeekYmd(anchorDate);
  return Array.from({ length: 7 }, (_, index) => addDaysToYmd(start, index));
}

function getMonthGridDays(anchorDate: string): string[] {
  const monthStart = startOfMonthYmd(anchorDate);
  const gridStart = getMondayOfWeekYmd(monthStart);
  return Array.from({ length: 42 }, (_, index) => addDaysToYmd(gridStart, index));
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function isOvernight(start: string, end: string): boolean {
  return toMinutes(end) <= toMinutes(start);
}

function normalizeTimelineEnd(start: string, end: string): number {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  return endMinutes <= startMinutes ? endMinutes + 1440 : endMinutes;
}

function timelineStyle(start: string, end: string): CSSProperties {
  const startMinutes = toMinutes(start);
  const endMinutes = normalizeTimelineEnd(start, end);
  const clampedStart = Math.max(TIMELINE_START, startMinutes);
  const clampedEnd = Math.min(TIMELINE_END, endMinutes);
  const top = ((clampedStart - TIMELINE_START) / TIMELINE_MINUTES) * 100;
  const height = Math.max(((clampedEnd - clampedStart) / TIMELINE_MINUTES) * 100, 5);

  return {
    top: `${top}%`,
    height: `max(${height}%, 34px)`,
  };
}

function shiftTypeFromRaw(raw: string | null | undefined): ShiftType {
  if (raw === "opening" || raw === "closing") return raw;
  return "regular";
}

function shiftLabel(type: ShiftType): string {
  return SHIFT_META[type].label;
}

function staffInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CH";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase() || "CH";
}

function humanize(value: string | null | undefined): string {
  if (!value) return "Staff";
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildDayModel(date: string, data: StaffFullScheduleData): DayModel {
  const dayOfWeek = getDayOfWeekFromYmd(date);
  const override = data.custom_overrides.find((item) => item.date === date);
  const bookings = data.bookings.filter((item) => item.date === date);
  const blockedTimes = data.blocked_times.filter((item) => item.date === date);

  if (override?.shift_type === "day_off") {
    return {
      date,
      isDayOff: true,
      dayOffReason: override.reason,
      shifts: [],
      bookings,
      blockedTimes,
    };
  }

  if (override?.start_time && override.end_time) {
    const type = shiftTypeFromRaw(override.shift_type);

    return {
      date,
      isDayOff: false,
      dayOffReason: null,
      shifts: [
        {
          id: `override-${override.id}`,
          date,
          type,
          label: `${shiftLabel(type)} Override`,
          start_time: override.start_time,
          end_time: override.end_time,
          source: "override",
          isOvernight: isOvernight(override.start_time, override.end_time),
        },
      ],
      bookings,
      blockedTimes,
    };
  }

  const hasIndividualSchedule = data.schedules.some((row) => row.is_active);
  const individualRowsForDay = data.schedules.filter((row) => row.day_of_week === dayOfWeek);

  if (hasIndividualSchedule) {
    const activeRows = individualRowsForDay.filter((row) => row.is_active);
    const isDayOff = individualRowsForDay.length > 0 && activeRows.length === 0;
    return {
      date,
      isDayOff,
      dayOffReason: isDayOff ? "Personal day off" : null,
      shifts: activeRows.map((row) => {
        const type = shiftTypeFromRaw(row.shift_type);
        return {
          id: `staff-${row.id}`,
          date,
          type,
          label: shiftLabel(type),
          start_time: row.start_time,
          end_time: row.end_time,
          source: "individual" as const,
          isOvernight: isOvernight(row.start_time, row.end_time),
        };
      }),
      bookings,
      blockedTimes,
    };
  }

  const groupRows = data.groupRules.filter((row) => row.day_of_week === dayOfWeek && row.is_active);
  const isGroupDayOff = groupRows.some((row) => row.is_day_off);
  const activeGroupRows = groupRows.filter((row) => !row.is_day_off && row.start_time && row.end_time);

  return {
    date,
    isDayOff: isGroupDayOff,
    dayOffReason: isGroupDayOff ? "Group day off" : null,
    shifts: isGroupDayOff
      ? []
      : activeGroupRows.map((row) => {
          const type = shiftTypeFromRaw(row.shift_type);
          const startTime = row.start_time ?? "09:00";
          const endTime = row.end_time ?? "18:00";
          return {
            id: `group-${row.id}`,
            date,
            type,
            label: shiftLabel(type),
            start_time: startTime,
            end_time: endTime,
            source: "group" as const,
            isOvernight: isOvernight(startTime, endTime),
          };
        }),
    bookings,
    blockedTimes,
  };
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-3 shadow-[var(--cs-shadow-xs)]">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold leading-none text-[var(--cs-text)] tabular-nums">
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-[var(--cs-text-muted)]">
        {helper}
      </div>
    </div>
  );
}

function Legend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-2 text-[11px] font-medium text-[var(--cs-text-secondary)]", className)}>
      {LEGEND_ITEMS.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-2.5 py-1"
        >
          <span className={cn("h-2 w-2 rounded-full", item.className)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function TimelineLabels() {
  return (
    <div className="relative min-h-[720px] border-r border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]">
      {TIME_LABELS.map((slot) => (
        <div
          key={slot.minutes}
          className="absolute right-2 -translate-y-1/2 text-[10px] font-semibold text-[var(--cs-text-muted)]"
          style={{ top: `${((slot.minutes - TIMELINE_START) / TIMELINE_MINUTES) * 100}%` }}
        >
          {slot.label}
        </div>
      ))}
    </div>
  );
}

function DayColumn({
  day,
  showShifts,
  showBookings,
  showBlocks,
}: {
  day: DayModel;
  showShifts: boolean;
  showBookings: boolean;
  showBlocks: boolean;
}) {
  return (
    <div className="relative min-h-[720px] border-r border-[var(--cs-border-soft)] bg-[var(--cs-surface)] last:border-r-0">
      {TIME_LABELS.map((slot) => (
        <div
          key={slot.minutes}
          className="absolute inset-x-0 border-t border-[var(--cs-border-soft)]"
          style={{ top: `${((slot.minutes - TIMELINE_START) / TIMELINE_MINUTES) * 100}%` }}
        />
      ))}

      {day.isDayOff ? (
        <div className="absolute inset-x-2 top-3 rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
          Day Off
          {day.dayOffReason ? (
            <div className="mt-1 text-[10px] font-medium text-slate-500">{day.dayOffReason}</div>
          ) : null}
        </div>
      ) : null}

      {!day.isDayOff && day.shifts.length === 0 ? (
        <div className="absolute inset-x-2 top-3 rounded-2xl border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-3 py-2 text-xs font-medium text-[var(--cs-text-muted)]">
          No shift scheduled
        </div>
      ) : null}

      {showShifts
        ? day.shifts.map((shift) => (
            <div
              key={shift.id}
              className={cn(
                "absolute inset-x-2 overflow-hidden rounded-2xl border px-2 py-1 text-[11px] shadow-[var(--cs-shadow-xs)]",
                SHIFT_META[shift.type].block
              )}
              style={timelineStyle(shift.start_time, shift.end_time)}
            >
              <div className="flex items-center gap-1 font-bold">
                {shift.isOvernight ? <Moon className="size-3 shrink-0" /> : null}
                <span className="truncate">{shift.label}</span>
              </div>
              <div className="mt-0.5 truncate text-[10px] font-medium">
                {formatShiftTimeRange(shift.start_time, shift.end_time)}
                {shift.isOvernight ? " overnight" : ""}
              </div>
            </div>
          ))
        : null}

      {showBookings
        ? day.bookings.map((booking) => (
            <div
              key={booking.id}
              className="absolute left-4 right-3 overflow-hidden rounded-xl border border-[var(--cs-crm-text)]/20 bg-[var(--cs-crm-text)] px-2 py-1 text-[11px] text-[var(--cs-text-inverse)] shadow-[var(--cs-shadow-xs)]"
              style={timelineStyle(booking.start_time, booking.end_time)}
              title={`${booking.service_name} - ${booking.customer_name ?? "Customer"}`}
            >
              <div className="truncate font-bold">{booking.service_name}</div>
              <div className="truncate text-[10px] opacity-90">
                {formatTime12h(booking.start_time)} - {formatTime12h(booking.end_time)}
                {booking.customer_name ? `, ${booking.customer_name}` : ""}
              </div>
            </div>
          ))
        : null}

      {showBlocks
        ? day.blockedTimes.map((block) => (
            <div
              key={block.id}
              className="absolute left-6 right-4 overflow-hidden rounded-xl border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-800 shadow-[var(--cs-shadow-xs)]"
              style={timelineStyle(block.start_time, block.end_time)}
            >
              <div className="truncate font-bold">Blocked Time</div>
              <div className="truncate text-[10px]">
                {formatShiftTimeRange(block.start_time, block.end_time)}
                {block.reason ? `, ${block.reason}` : ""}
              </div>
            </div>
          ))
        : null}
    </div>
  );
}

function WeekView({
  days,
  showShifts,
  showBookings,
  showBlocks,
}: {
  days: DayModel[];
  showShifts: boolean;
  showBookings: boolean;
  showBlocks: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-xs)]">
      <div className="min-w-[980px]">
        <div className="grid grid-cols-[72px_repeat(7,minmax(120px,1fr))] border-b border-[var(--cs-border-soft)]">
          <div className="bg-[var(--cs-surface-warm)] px-2 py-3 text-[10px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            Time
          </div>
          {days.map((day) => {
            const weekday = WEEKDAYS.find(
              (item) => item.dow === getDayOfWeekFromYmd(day.date)
            );
            return (
              <div key={day.date} className="border-r border-[var(--cs-border-soft)] px-3 py-3 last:border-r-0">
                <div className="text-xs font-bold text-[var(--cs-text)]">{weekday?.short ?? ""}</div>
                <div className="mt-0.5 text-[11px] text-[var(--cs-text-muted)]">{formatDateLabel(day.date)}</div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[72px_repeat(7,minmax(120px,1fr))]">
          <TimelineLabels />
          {days.map((day) => (
            <DayColumn
              key={day.date}
              day={day}
              showShifts={showShifts}
              showBookings={showBookings}
              showBlocks={showBlocks}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayView({
  day,
  showShifts,
  showBookings,
  showBlocks,
}: {
  day: DayModel;
  showShifts: boolean;
  showBookings: boolean;
  showBlocks: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-xs)]">
      <div className="min-w-[520px]">
        <div className="grid grid-cols-[72px_minmax(0,1fr)] border-b border-[var(--cs-border-soft)]">
          <div className="bg-[var(--cs-surface-warm)] px-2 py-3 text-[10px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            Time
          </div>
          <div className="px-3 py-3">
            <div className="text-sm font-bold text-[var(--cs-text)]">{formatLongDateLabel(day.date)}</div>
          </div>
        </div>
        <div className="grid grid-cols-[72px_minmax(0,1fr)]">
          <TimelineLabels />
          <DayColumn day={day} showShifts={showShifts} showBookings={showBookings} showBlocks={showBlocks} />
        </div>
      </div>
    </div>
  );
}

function MonthChip({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span className={cn("inline-flex max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] font-semibold", className)}>
      {children}
    </span>
  );
}

function MonthView({
  days,
  anchorDate,
  showShifts,
  showBookings,
  showBlocks,
}: {
  days: DayModel[];
  anchorDate: string;
  showShifts: boolean;
  showBookings: boolean;
  showBlocks: boolean;
}) {
  const anchorMonth = ymdParts(anchorDate).month;
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-xs)]">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]">
          {WEEKDAYS.map((day) => (
            <div key={day.dow} className="px-3 py-2 text-xs font-bold text-[var(--cs-text-muted)]">
              {day.short}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const { month, day: dayOfMonth } = ymdParts(day.date);
            const isMuted = month !== anchorMonth;
            return (
              <div
                key={day.date}
                className={cn(
                  "min-h-[128px] border-r border-b border-[var(--cs-border-soft)] p-2 last:border-r-0",
                  isMuted ? "bg-[var(--cs-surface-warm)]/60" : "bg-[var(--cs-surface)]"
                )}
              >
                <div className={cn("text-xs font-bold", isMuted ? "text-[var(--cs-text-muted)]" : "text-[var(--cs-text)]")}>
                  {dayOfMonth}
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  {day.isDayOff ? (
                    <MonthChip className="border-slate-200 bg-slate-100 text-slate-600">Day Off</MonthChip>
                  ) : null}
                  {showShifts
                    ? day.shifts.map((shift) => (
                        <MonthChip key={shift.id} className={SHIFT_META[shift.type].chip}>
                          {shift.type === "regular" ? "Regular" : shift.type === "opening" ? "Opening" : "Closing"}
                          {shift.isOvernight ? " +1" : ""}
                        </MonthChip>
                      ))
                    : null}
                  {showBookings && day.bookings.length > 0 ? (
                    <MonthChip className="border-[var(--cs-crm-text)]/20 bg-[var(--cs-crm-text)] text-[var(--cs-text-inverse)]">
                      {day.bookings.length} booking{day.bookings.length === 1 ? "" : "s"}
                    </MonthChip>
                  ) : null}
                  {showBlocks && day.blockedTimes.length > 0 ? (
                    <MonthChip className="border-rose-200 bg-rose-50 text-rose-800">
                      {day.blockedTimes.length} blocked
                    </MonthChip>
                  ) : null}
                  {!day.isDayOff && day.shifts.length === 0 && day.bookings.length === 0 && day.blockedTimes.length === 0 ? (
                    <span className="text-[10px] font-medium text-[var(--cs-text-muted)]">No shift scheduled</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function StaffScheduleCalendarModal({
  open,
  onOpenChange,
  staff,
  initialDate,
  branchName,
}: StaffScheduleCalendarModalProps) {
  if (!staff) return null;

  return (
    <StaffScheduleCalendarModalContent
      key={`${staff.id}-${initialDate}`}
      open={open}
      onOpenChange={onOpenChange}
      staff={staff}
      initialDate={initialDate}
      branchName={branchName}
    />
  );
}

function StaffScheduleCalendarModalContent({
  open,
  onOpenChange,
  staff,
  initialDate,
  branchName,
}: Omit<StaffScheduleCalendarModalProps, "staff"> & {
  staff: NonNullable<StaffScheduleCalendarModalProps["staff"]>;
}) {
  const [activeView, setActiveView] = useState<CalendarView>("week");
  const [anchorDate, setAnchorDate] = useState(initialDate);
  const [data, setData] = useState<StaffFullScheduleData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showShifts, setShowShifts] = useState(true);
  const [showBookings, setShowBookings] = useState(true);
  const [showBlocks, setShowBlocks] = useState(true);

  const range = useMemo(() => getDateRange(anchorDate, activeView), [anchorDate, activeView]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const loadSchedule = async () => {
      setIsLoading(true);
      setError(null);

      const result = await getStaffFullScheduleAction({
        staffId: staff.id,
        startDate: range.startDate,
        endDate: range.endDate,
      });

      if (!cancelled) {
        if (result.ok) {
          setData(result.data);
        } else {
          setError(result.error);
        }
        setIsLoading(false);
      }
    };

    void loadSchedule();

    return () => {
      cancelled = true;
    };
  }, [open, staff.id, range.startDate, range.endDate]);

  const staffDisplay = data?.staff ?? staff;
  const displayName = staffDisplay ? getStaffAdminName(staffDisplay) : "Staff member";
  const effectiveBranchName = data?.staff.branch_name ?? staff?.branch_name ?? branchName ?? "Assigned branch";

  const visibleDates = useMemo(() => {
    if (activeView === "month") return getMonthGridDays(anchorDate);
    if (activeView === "week") return getWeekDays(anchorDate);
    return [anchorDate];
  }, [activeView, anchorDate]);

  const dayModels = useMemo(() => {
    if (!data) return [];
    return visibleDates.map((date) => buildDayModel(date, data));
  }, [data, visibleDates]);

  const rangeLabel = formatRangeLabel(range.startDate, range.endDate, activeView);
  const summary = useMemo(() => {
    return dayModels.reduce(
      (acc, day) => {
        if (day.isDayOff) acc.dayOff += 1;
        for (const shift of day.shifts) {
          acc[shift.type] += 1;
        }
        return acc;
      },
      { dayOff: 0, opening: 0, closing: 0, regular: 0 }
    );
  }, [dayModels]);

  function move(direction: "previous" | "next") {
    const delta = direction === "previous" ? -1 : 1;
    if (activeView === "day") {
      setAnchorDate(addDaysToYmd(anchorDate, delta));
      return;
    }
    if (activeView === "week") {
      setAnchorDate(addDaysToYmd(anchorDate, delta * 7));
      return;
    }
    setAnchorDate(addMonthsToMonthStartYmd(anchorDate, delta));
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      size="full"
      placement="center"
      showCloseButton={false}
      className="h-[100dvh] max-h-[100dvh] rounded-none border-0 bg-[var(--cs-surface-warm)] sm:h-auto sm:max-h-[min(92vh,920px)] sm:max-w-[1180px] sm:rounded-2xl sm:border sm:border-[var(--cs-border-soft)]"
    >
      <div className="shrink-0 border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[var(--cs-sand-dark)]">
              <CalendarDays className="size-3.5" />
              Full Schedule
            </div>
            <h2 className="mt-1 text-xl font-semibold leading-tight text-[var(--cs-text)] sm:text-2xl">
              Full Schedule
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-[var(--cs-text-secondary)]">
              View complete schedule, shifts and appointments for this staff member.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] text-[var(--cs-text-muted)] transition-colors hover:text-[var(--cs-text)]"
            aria-label="Close full schedule"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.85fr)]">
          <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3">
            {staffDisplay?.avatar_url ? (
              <Image
                src={staffDisplay.avatar_url}
                alt=""
                width={48}
                height={48}
                unoptimized
                className="h-12 w-12 shrink-0 rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--cs-sand-mist)] text-sm font-bold text-[var(--cs-sand-dark)]">
                {staffInitials(displayName)}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-[var(--cs-text)]">
                {displayName}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-semibold text-[var(--cs-text-secondary)]">
                <span className="rounded-full bg-[var(--cs-surface)] px-2 py-0.5">
                  {humanize(staffDisplay?.staff_type)}
                </span>
                <span className="rounded-full bg-[var(--cs-surface)] px-2 py-0.5">
                  {humanize(staffDisplay?.system_role)}
                </span>
                <span className="rounded-full bg-[var(--cs-surface)] px-2 py-0.5">
                  {effectiveBranchName}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryCard label="Day off" value={summary.dayOff} helper="visible dates" />
            <SummaryCard label="Opening shift" value={summary.opening} helper="visible blocks" />
            <SummaryCard label="Closing shift" value={summary.closing} helper="visible blocks" />
            <SummaryCard label="Regular shift" value={summary.regular} helper="visible blocks" />
          </div>
        </div>
      </div>

      <AdminOverlayBody padded={false} className="bg-[var(--cs-surface-warm)]">
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-3 shadow-[var(--cs-shadow-xs)] lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="flex rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-1">
                {VIEW_TABS.map((tab) => {
                  const selected = activeView === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setActiveView(tab.value)}
                      className={cn(
                        "h-8 rounded-lg px-3 text-xs font-semibold transition-colors",
                        selected
                          ? "bg-[var(--cs-crm-text)] text-[var(--cs-text-inverse)]"
                          : "text-[var(--cs-text-muted)] hover:bg-[var(--cs-surface)] hover:text-[var(--cs-text)]"
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon-sm" onClick={() => move("previous")} aria-label="Previous range">
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="outline" size="icon-sm" onClick={() => move("next")} aria-label="Next range">
                  <ChevronRight className="size-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAnchorDate(getBranchBusinessDate())}>
                  Today
                </Button>
              </div>

              <div className="min-w-0 rounded-xl bg-[var(--cs-surface-warm)] px-3 py-2 text-sm font-semibold text-[var(--cs-text)]">
                {rangeLabel}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowFilters((value) => !value)}>
                <Filter className="size-4" />
                Filter
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowLegend((value) => !value)}>
                Legend
              </Button>
            </div>
          </div>

          {showFilters ? (
            <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-3 text-xs font-semibold text-[var(--cs-text-secondary)] shadow-[var(--cs-shadow-xs)]">
              {[
                { label: "Shifts", checked: showShifts, onChange: setShowShifts },
                { label: "Appointments", checked: showBookings, onChange: setShowBookings },
                { label: "Blocked time", checked: showBlocks, onChange: setShowBlocks },
              ].map((item) => (
                <label key={item.label} className="inline-flex items-center gap-2 rounded-full border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-3 py-1.5">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(event) => item.onChange(event.target.checked)}
                    className="size-3.5 accent-[var(--cs-crm-text)]"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          ) : null}

          {showLegend ? <Legend /> : null}

          {error ? (
            <div className="rounded-2xl border border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)] px-4 py-3 text-sm font-semibold text-[var(--cs-error-text)]">
              {error}
            </div>
          ) : null}

          {isLoading && !data ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] text-sm font-semibold text-[var(--cs-text-muted)]">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading full schedule...
            </div>
          ) : null}

          {data && dayModels.length > 0 ? (
            <div className={cn(isLoading ? "opacity-70" : "opacity-100", "transition-opacity")}>
              {activeView === "day" ? (
                <DayView
                  day={dayModels[0]!}
                  showShifts={showShifts}
                  showBookings={showBookings}
                  showBlocks={showBlocks}
                />
              ) : null}

              {activeView === "week" ? (
                <WeekView
                  days={dayModels}
                  showShifts={showShifts}
                  showBookings={showBookings}
                  showBlocks={showBlocks}
                />
              ) : null}

              {activeView === "month" ? (
                <MonthView
                  days={dayModels}
                  anchorDate={anchorDate}
                  showShifts={showShifts}
                  showBookings={showBookings}
                  showBlocks={showBlocks}
                />
              ) : null}
            </div>
          ) : null}

          {isLoading && data ? (
            <div className="fixed bottom-4 right-4 z-10 rounded-full border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-3 py-2 text-xs font-semibold text-[var(--cs-text-muted)] shadow-[var(--cs-shadow-sm)]">
              <Loader2 className="mr-1 inline size-3 animate-spin" />
              Refreshing
            </div>
          ) : null}
        </div>
      </AdminOverlayBody>
    </AdminDialog>
  );
}
