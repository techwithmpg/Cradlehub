"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  Layers3,
  Loader2,
  Search,
  SlidersHorizontal,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { AdminDialog, AdminOverlayBody, AdminOverlayHeader } from "@/components/shared/overlays";
import { useAdministrativeBookingModal } from "@/components/features/bookings/administrative-booking-modal-provider";
import { CheckAvailabilityModal } from "@/components/features/crm/schedule/check-availability-modal";
import { EditAvailabilityModal } from "@/components/features/crm/schedule/edit-availability-modal";
import { CrmEditStaffProfileModal } from "@/components/features/crm/staff/crm-edit-staff-profile-modal";
import { StaffServiceEditorSheet } from "@/components/features/staff/staff-service-editor-sheet";
import { StaffScheduleCalendarModal } from "@/components/features/staff-schedule/staff-schedule-calendar-modal";
import {
  getCrmScheduleStaffProfileAction,
  getStaffFullScheduleAction,
  type CrmScheduleStaffProfileData,
  type StaffFullScheduleData,
} from "@/app/(dashboard)/crm/schedule/actions";
import { updateStaffServicesFromCrmAction } from "@/lib/actions/crm-staff-services";
import { assignTimelineLanes, formatScheduleTime, timeToMinutes } from "@/lib/utils/schedule-timeline";
import { cn } from "@/lib/utils";
import { getStaffAdminName } from "@/lib/staff/display-name";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-list";
import type { AvailabilityTab } from "@/components/features/crm/schedule/edit-availability-types";

type FullViewRange = "day" | "week";
type ShiftType = "opening" | "closing" | "regular";
type LayerKey = "shifts" | "bookings" | "blocks" | "overrides";

type ShiftBlock = {
  id: string;
  date: string;
  type: ShiftType;
  label: string;
  start_time: string;
  end_time: string;
  source: "individual" | "group" | "override";
};

type DayModel = {
  date: string;
  isDayOff: boolean;
  dayOffReason: string | null;
  shifts: ShiftBlock[];
  bookings: StaffFullScheduleData["bookings"];
  blockedTimes: StaffFullScheduleData["blocked_times"];
  overrides: StaffFullScheduleData["custom_overrides"];
};

type BookingModel = StaffFullScheduleData["bookings"][number];

type Props = {
  branchId: string;
  branchName: string;
  date: string;
  staffRows: DailyScheduleStaffRow[];
  availabilityItems: StaffScheduleItem[];
  selectedStaffId: string | null;
  selectedBookingId: string | null;
  onSelectedStaffChange: (staffId: string | null) => void;
  onSelectedBookingChange: (bookingId: string | null) => void;
};

const TIMELINE_START = 6 * 60;
const TIMELINE_END = 26 * 60;
const TIMELINE_TOTAL = TIMELINE_END - TIMELINE_START;
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

const SHIFT_CLASS: Record<ShiftType, string> = {
  opening: "border-emerald-200 bg-emerald-50 text-emerald-900",
  closing: "border-sky-200 bg-sky-50 text-sky-900",
  regular: "border-amber-200 bg-amber-50 text-amber-950",
};

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

function toDateString(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeekMonday(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() + (day === 0 ? -6 : 1 - day));
  return next;
}

function getDateRange(anchorDate: string, range: FullViewRange): { startDate: string; endDate: string } {
  if (range === "day") return { startDate: anchorDate, endDate: anchorDate };
  const start = startOfWeekMonday(parseDate(anchorDate));
  return { startDate: toDateString(start), endDate: toDateString(addDays(start, 6)) };
}

function getVisibleDates(anchorDate: string, range: FullViewRange): string[] {
  if (range === "day") return [anchorDate];
  const start = startOfWeekMonday(parseDate(anchorDate));
  return Array.from({ length: 7 }, (_, index) => toDateString(addDays(start, index)));
}

function formatDateLabel(date: string): string {
  return parseDate(date).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatRangeLabel(startDate: string, endDate: string): string {
  if (startDate === endDate) {
    return parseDate(startDate).toLocaleDateString("en-PH", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  const start = parseDate(startDate).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
  const end = parseDate(endDate).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${start} - ${end}`;
}

function shiftTypeFromRaw(raw: string | null | undefined): ShiftType {
  if (raw === "opening" || raw === "closing") return raw;
  return "regular";
}

function shiftLabel(type: ShiftType): string {
  if (type === "opening") return "Opening Shift";
  if (type === "closing") return "Closing Shift";
  return "Regular Shift";
}

function normalizeTimelineEnd(start: string, end: string): number {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  return endMinutes <= startMinutes ? endMinutes + 1440 : endMinutes;
}

function timelineStyle(start: string, end: string) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = normalizeTimelineEnd(start, end);
  const clampedStart = Math.max(TIMELINE_START, startMinutes);
  const clampedEnd = Math.min(TIMELINE_END, endMinutes);
  const top = ((clampedStart - TIMELINE_START) / TIMELINE_TOTAL) * 100;
  const height = Math.max(((clampedEnd - clampedStart) / TIMELINE_TOTAL) * 100, 4);
  return { top: `${top}%`, height: `max(${height}%, 34px)` };
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < normalizeTimelineEnd(bStart, bEnd) && timeToMinutes(bStart) < normalizeTimelineEnd(aStart, aEnd);
}

function buildDayModel(date: string, data: StaffFullScheduleData): DayModel {
  const dayOfWeek = parseDate(date).getDay();
  const override = data.custom_overrides.find((item) => item.date === date);
  const bookings = data.bookings.filter((item) => item.date === date);
  const blockedTimes = data.blocked_times.filter((item) => item.date === date);
  const overrides = data.custom_overrides.filter((item) => item.date === date);

  if (override?.shift_type === "day_off") {
    return { date, isDayOff: true, dayOffReason: override.reason, shifts: [], bookings, blockedTimes, overrides };
  }

  if (override?.start_time && override.end_time) {
    return {
      date,
      isDayOff: false,
      dayOffReason: null,
      shifts: [{
        id: `override-${override.id}`,
        date,
        type: "regular",
        label: "Override Shift",
        start_time: override.start_time,
        end_time: override.end_time,
        source: "override",
      }],
      bookings,
      blockedTimes,
      overrides,
    };
  }

  const hasIndividualSchedule = data.schedules.some((row) => row.is_active);
  const individualRows = data.schedules.filter((row) => row.day_of_week === dayOfWeek);

  if (hasIndividualSchedule) {
    const activeRows = individualRows.filter((row) => row.is_active);
    const isDayOff = individualRows.length > 0 && activeRows.length === 0;
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
        };
      }),
      bookings,
      blockedTimes,
      overrides,
    };
  }

  const groupRows = data.groupRules.filter((row) => row.day_of_week === dayOfWeek && row.is_active);
  const isGroupDayOff = groupRows.some((row) => row.is_day_off);
  return {
    date,
    isDayOff: isGroupDayOff,
    dayOffReason: isGroupDayOff ? "Group day off" : null,
    shifts: isGroupDayOff
      ? []
      : groupRows
          .filter((row) => !row.is_day_off && row.start_time && row.end_time)
          .map((row) => {
            const type = shiftTypeFromRaw(row.shift_type);
            return {
              id: `group-${row.id}`,
              date,
              type,
              label: shiftLabel(type),
              start_time: row.start_time ?? "09:00",
              end_time: row.end_time ?? "18:00",
              source: "group" as const,
            };
          }),
    bookings,
    blockedTimes,
    overrides,
  };
}

function getBookingConflicts(day: DayModel, booking: BookingModel): string[] {
  const conflicts: string[] = [];
  if (day.isDayOff) conflicts.push("Booking during day off");
  const withinShift = day.shifts.some(
    (shift) =>
      timeToMinutes(booking.start_time) >= timeToMinutes(shift.start_time) &&
      normalizeTimelineEnd(booking.start_time, booking.end_time) <= normalizeTimelineEnd(shift.start_time, shift.end_time)
  );
  if (!day.isDayOff && day.shifts.length > 0 && !withinShift) conflicts.push("Booking outside staff shift");
  if (day.blockedTimes.some((block) => rangesOverlap(booking.start_time, booking.end_time, block.start_time, block.end_time))) {
    conflicts.push("Booking during blocked time");
  }
  if (
    day.bookings.some(
      (other) =>
        other.id !== booking.id &&
        rangesOverlap(booking.start_time, booking.end_time, other.start_time, other.end_time)
    )
  ) {
    conflicts.push("Overlapping booking");
  }
  return conflicts;
}

function LayerToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--cs-text-secondary)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3.5 accent-emerald-800"
      />
      {label}
    </label>
  );
}

function StaffList({
  staffRows,
  selectedStaffId,
  onSelect,
}: {
  staffRows: DailyScheduleStaffRow[];
  selectedStaffId: string | null;
  onSelect: (staffId: string) => void;
}) {
  return (
    <aside className="rounded-lg border border-[var(--cs-border)] bg-white shadow-sm">
      <div className="border-b border-[var(--cs-border-soft)] px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">Staff</p>
        <p className="mt-1 text-xs text-[var(--cs-text-secondary)]">{staffRows.length} in view</p>
      </div>
      <div className="max-h-[620px] overflow-auto p-2">
        {staffRows.map((row) => {
          const selected = selectedStaffId === row.staff_id;
          return (
            <button
              key={row.staff_id}
              type="button"
              onClick={() => onSelect(row.staff_id)}
              className={cn(
                "mb-1 flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition",
                selected ? "bg-emerald-50 text-emerald-950" : "text-[var(--cs-text)] hover:bg-stone-50"
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold">{row.staff_name}</span>
                <span className="block truncate text-[10px] text-[var(--cs-text-muted)]">
                  {row.schedule_is_day_off ? "Day off" : row.work_start && row.work_end ? `${formatScheduleTime(row.work_start)} - ${formatScheduleTime(row.work_end)}` : "No shift"}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-700">
                {row.bookings.length}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function DayScheduleColumn({
  day,
  layers,
  selectedBookingId,
  onBookingSelect,
}: {
  day: DayModel;
  layers: Record<LayerKey, boolean>;
  selectedBookingId: string | null;
  onBookingSelect: (bookingId: string) => void;
}) {
  const lanes = assignTimelineLanes(day.bookings);

  return (
    <div className="rounded-lg border border-[var(--cs-border-soft)] bg-white">
      <div className="border-b border-[var(--cs-border-soft)] px-3 py-2">
        <p className="text-xs font-bold text-[var(--cs-text)]">{formatDateLabel(day.date)}</p>
      </div>
      <div className="grid grid-cols-[64px_minmax(220px,1fr)]">
        <div className="relative min-h-[620px] border-r border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]">
          {TIME_LABELS.map((mark) => (
            <span
              key={mark.minutes}
              className="absolute right-2 -translate-y-1/2 text-[10px] font-semibold text-[var(--cs-text-muted)]"
              style={{ top: `${((mark.minutes - TIMELINE_START) / TIMELINE_TOTAL) * 100}%` }}
            >
              {mark.label}
            </span>
          ))}
        </div>
        <div className="relative min-h-[620px] overflow-hidden">
          {TIME_LABELS.map((mark) => (
            <span
              key={mark.minutes}
              className="absolute inset-x-0 border-t border-[var(--cs-border-soft)]"
              style={{ top: `${((mark.minutes - TIMELINE_START) / TIMELINE_TOTAL) * 100}%` }}
            />
          ))}

          {day.isDayOff ? (
            <div className="absolute inset-x-3 top-3 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
              Day Off
              {day.dayOffReason ? <span className="mt-1 block text-[10px] font-medium">{day.dayOffReason}</span> : null}
            </div>
          ) : null}

          {layers.shifts
            ? day.shifts.map((shift) => (
                <div
                  key={shift.id}
                  className={cn("absolute left-3 right-3 overflow-hidden rounded-lg border px-2 py-1 text-[11px] shadow-sm", SHIFT_CLASS[shift.type])}
                  style={timelineStyle(shift.start_time, shift.end_time)}
                >
                  <div className="truncate font-bold">{shift.label}</div>
                  <div className="truncate text-[10px]">{formatScheduleTime(shift.start_time)} - {formatScheduleTime(shift.end_time)}</div>
                </div>
              ))
            : null}

          {layers.overrides
            ? day.overrides.map((override) => (
                <div
                  key={override.id}
                  className="absolute right-3 top-3 z-20 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-800"
                >
                  {override.shift_type === "day_off" ? "Override: day off" : "Override shift"}
                </div>
              ))
            : null}

          {layers.blocks
            ? day.blockedTimes.map((block) => (
                <div
                  key={block.id}
                  className="absolute left-[62%] right-3 z-20 overflow-hidden rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-800 shadow-sm"
                  style={timelineStyle(block.start_time, block.end_time)}
                >
                  <div className="truncate font-bold">Blocked</div>
                  <div className="truncate text-[10px]">{formatScheduleTime(block.start_time)} - {formatScheduleTime(block.end_time)}</div>
                </div>
              ))
            : null}

          {layers.bookings
            ? day.bookings.map((booking) => {
                const lane = lanes.get(booking.id) ?? { lane: 0, laneCount: 1 };
                const conflicts = getBookingConflicts(day, booking);
                const width = 58 / lane.laneCount;
                const left = 4 + lane.lane * width;
                const selected = selectedBookingId === booking.id;
                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => onBookingSelect(booking.id)}
                    className={cn(
                      "absolute z-30 overflow-hidden rounded-lg border px-2 py-1 text-left text-[11px] shadow-sm",
                      conflicts.length > 0
                        ? "border-red-300 bg-red-100 text-red-900"
                        : selected
                          ? "border-emerald-300 bg-emerald-700 text-white"
                          : "border-[var(--cs-crm-text)]/20 bg-[var(--cs-crm-text)] text-[var(--cs-text-inverse)]"
                    )}
                    style={{
                      ...timelineStyle(booking.start_time, booking.end_time),
                      left: `${left}%`,
                      width: `calc(${Math.max(width - 1, 18)}% - 2px)`,
                    }}
                    title={`${conflicts.join("; ")} ${booking.service_name}`}
                    aria-label={`${conflicts.length > 0 ? `Conflict: ${conflicts.join(", ")}. ` : ""}${booking.service_name}`}
                  >
                    <div className="truncate font-bold">
                      {conflicts.length > 0 ? "! " : ""}
                      {formatScheduleTime(booking.start_time)} - {formatScheduleTime(booking.end_time)}
                    </div>
                    <div className="truncate">{booking.customer_name ?? "Customer"}</div>
                    <div className="truncate text-[10px] opacity-90">{booking.service_name}</div>
                  </button>
                );
              })
            : null}
        </div>
      </div>
    </div>
  );
}

function BookingDetailsPanel({ booking }: { booking: BookingModel | null }) {
  if (!booking) return null;
  return (
    <div className="rounded-lg border border-[var(--cs-border)] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
        <CheckCircle2 className="size-3.5" />
        Booking Details
      </div>
      <div className="mt-3 space-y-2 text-xs">
        <p className="font-bold text-[var(--cs-text)]">{booking.customer_name ?? "Customer"}</p>
        <p className="text-[var(--cs-text-secondary)]">{booking.service_name}</p>
        <p className="text-[var(--cs-text-muted)]">
          {formatScheduleTime(booking.start_time)} - {formatScheduleTime(booking.end_time)}
        </p>
        <p className="capitalize text-[var(--cs-text-muted)]">{booking.status ?? "scheduled"}</p>
      </div>
    </div>
  );
}

export function FullScheduleLiveBookingsView({
  branchId,
  branchName,
  date,
  staffRows,
  availabilityItems,
  selectedStaffId,
  selectedBookingId,
  onSelectedStaffChange,
  onSelectedBookingChange,
}: Props) {
  const router = useRouter();
  const { openBookingModal } = useAdministrativeBookingModal();
  const [rangeMode, setRangeMode] = useState<FullViewRange>("day");
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    shifts: true,
    bookings: true,
    blocks: true,
    overrides: true,
  });
  const [scheduleData, setScheduleData] = useState<StaffFullScheduleData | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [profileStaffId, setProfileStaffId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<CrmScheduleStaffProfileData | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [capabilitiesStaffId, setCapabilitiesStaffId] = useState<string | null>(null);
  const [capabilitiesData, setCapabilitiesData] = useState<CrmScheduleStaffProfileData | null>(null);
  const [capabilitiesDraft, setCapabilitiesDraft] = useState<string[]>([]);
  const [capabilitiesError, setCapabilitiesError] = useState<string | null>(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);
  const [availabilityEditor, setAvailabilityEditor] = useState<{ staffId: string; initialTab: AvailabilityTab } | null>(null);
  const [checkAvailabilityOpen, setCheckAvailabilityOpen] = useState(false);
  const [fullScheduleStaffId, setFullScheduleStaffId] = useState<string | null>(null);
  const [isSavingCapabilities, startSavingCapabilities] = useTransition();

  const selectedStaff = selectedStaffId ? staffRows.find((row) => row.staff_id === selectedStaffId) ?? null : null;
  const availabilityEditorItem = availabilityEditor
    ? availabilityItems.find((item) => item.staff.id === availabilityEditor.staffId) ?? null
    : null;
  const selectedAvailabilityItem = selectedStaffId
    ? availabilityItems.find((item) => item.staff.id === selectedStaffId) ?? null
    : null;
  const selectedBooking = scheduleData?.bookings.find((booking) => booking.id === selectedBookingId) ?? null;
  const range = useMemo(() => getDateRange(date, rangeMode), [date, rangeMode]);
  const visibleDates = useMemo(() => getVisibleDates(date, rangeMode), [date, rangeMode]);
  const dayModels = useMemo(
    () => (scheduleData ? visibleDates.map((visibleDate) => buildDayModel(visibleDate, scheduleData)) : []),
    [scheduleData, visibleDates]
  );
  const fullScheduleStaff = useMemo(() => {
    if (!fullScheduleStaffId) return null;
    const item = availabilityItems.find((candidate) => candidate.staff.id === fullScheduleStaffId);
    const row = staffRows.find((candidate) => candidate.staff_id === fullScheduleStaffId);
    if (!item && !row) return null;
    return {
      id: fullScheduleStaffId,
      full_name: item?.staff.full_name ?? row?.staff_name ?? "Staff member",
      nickname: item?.staff.nickname ?? null,
      avatar_url: null,
      staff_type: item?.staff.staff_type ?? null,
      system_role: null,
      branch_name: branchName,
    };
  }, [availabilityItems, branchName, fullScheduleStaffId, staffRows]);

  useEffect(() => {
    if (!selectedStaffId) return;
    if (staffRows.some((row) => row.staff_id === selectedStaffId)) return;
    onSelectedStaffChange(null);
    onSelectedBookingChange(null);
  }, [onSelectedBookingChange, onSelectedStaffChange, selectedStaffId, staffRows]);

  useEffect(() => {
    if (!selectedStaffId) return;

    let cancelled = false;
    const loadingTimer = window.setTimeout(() => {
      if (cancelled) return;
      setScheduleLoading(true);
      setScheduleError(null);
    }, 0);

    void getStaffFullScheduleAction({
      staffId: selectedStaffId,
      startDate: range.startDate,
      endDate: range.endDate,
    })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setScheduleData(result.data);
        else setScheduleError(result.error);
      })
      .catch(() => {
        if (!cancelled) setScheduleError("The staff schedule could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setScheduleLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimer);
    };
  }, [range.endDate, range.startDate, selectedStaffId]);

  useEffect(() => {
    if (!profileStaffId) return;
    let cancelled = false;
    void getCrmScheduleStaffProfileAction({ staffId: profileStaffId })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setProfileData(result.data);
        else setProfileError(result.error);
      })
      .catch(() => {
        if (!cancelled) setProfileError("Staff profile could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileStaffId]);

  useEffect(() => {
    if (!capabilitiesStaffId) return;
    let cancelled = false;
    void getCrmScheduleStaffProfileAction({ staffId: capabilitiesStaffId })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setCapabilitiesData(result.data);
          setCapabilitiesDraft(result.data.staffServiceIds);
        } else {
          setCapabilitiesError(result.error);
        }
      })
      .catch(() => {
        if (!cancelled) setCapabilitiesError("Service capabilities could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setCapabilitiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [capabilitiesStaffId]);

  const requireSelectedStaff = useCallback(
    (message: string): string | null => {
      if (selectedStaffId) return selectedStaffId;
      toast.error("Select a staff member first.", { description: message });
      return null;
    },
    [selectedStaffId]
  );

  const openCapabilitiesEditor = useCallback((staffId: string) => {
    setCapabilitiesData(null);
    setCapabilitiesDraft([]);
    setCapabilitiesError(null);
    setCapabilitiesLoading(true);
    setCapabilitiesStaffId(staffId);
  }, []);

  const handleSaveCapabilities = useCallback(
    (serviceIds: string[]) => {
      if (!capabilitiesStaffId) return;
      startSavingCapabilities(async () => {
        const result = await updateStaffServicesFromCrmAction({
          staffId: capabilitiesStaffId,
          serviceIds,
        });
        if (!result.ok) {
          toast.error(result.message ?? "Could not update service capabilities.");
          return;
        }
        toast.success("Service capabilities updated.");
        setCapabilitiesStaffId(null);
        setCapabilitiesData(null);
        setCapabilitiesDraft(result.serviceIds);
        router.refresh();
      });
    },
    [capabilitiesStaffId, router]
  );

  const actionButtons = [
    {
      label: "Add Booking",
      icon: CalendarPlus,
      onClick: () => openBookingModal({ mode: "standard_future", date, staffId: selectedStaffId ?? undefined }),
      requiresStaff: false,
    },
    {
      label: "Check Availability",
      icon: Search,
      onClick: () => setCheckAvailabilityOpen(true),
      requiresStaff: false,
    },
    {
      label: "Edit Profile",
      icon: UserRound,
      onClick: () => {
        const staffId = requireSelectedStaff("Choose a staff row before editing a profile.");
        if (!staffId) return;
        setProfileData(null);
        setProfileError(null);
        setProfileLoading(true);
        setProfileStaffId(staffId);
      },
      requiresStaff: true,
    },
    {
      label: "Edit Capabilities",
      icon: Sparkles,
      onClick: () => {
        const staffId = requireSelectedStaff("Choose a staff row before editing capabilities.");
        if (staffId) openCapabilitiesEditor(staffId);
      },
      requiresStaff: true,
    },
    {
      label: "View Full Schedule",
      icon: CalendarDays,
      onClick: () => {
        const staffId = requireSelectedStaff("Choose a staff row before opening the full schedule.");
        if (staffId) setFullScheduleStaffId(staffId);
      },
      requiresStaff: true,
    },
    {
      label: "Adjust Staff",
      icon: SlidersHorizontal,
      onClick: () => {
        const staffId = requireSelectedStaff("Choose a staff row before adjusting weekly hours.");
        if (!staffId) return;
        if (!selectedAvailabilityItem) {
          toast.error("Schedule details are not available for this staff member.");
          return;
        }
        setAvailabilityEditor({ staffId, initialTab: "weekly" });
      },
      requiresStaff: true,
    },
    {
      label: "Block Staff Time",
      icon: CalendarX2,
      onClick: () => {
        const staffId = requireSelectedStaff("Choose a staff row before blocking time.");
        if (!staffId) return;
        if (!selectedAvailabilityItem) {
          toast.error("Schedule details are not available for this staff member.");
          return;
        }
        setAvailabilityEditor({ staffId, initialTab: "blocks" });
      },
      requiresStaff: true,
    },
  ];

  return (
    <section className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)]" aria-label="Full Schedule and Live Bookings">
      <StaffList
        staffRows={staffRows}
        selectedStaffId={selectedStaffId}
        onSelect={(staffId) => {
          onSelectedStaffChange(staffId);
          onSelectedBookingChange(null);
        }}
      />

      <div className="min-w-0 space-y-3">
        <div className="rounded-lg border border-[var(--cs-border)] bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
                <Layers3 className="size-3.5" />
                Full Schedule + Live Bookings
              </div>
              <p className="mt-1 truncate text-sm font-bold text-[var(--cs-text)]">
                {selectedStaff?.staff_name ?? "Select a staff member"}
              </p>
              <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">{formatRangeLabel(range.startDate, range.endDate)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(["day", "week"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRangeMode(mode)}
                  className={cn(
                    "h-8 rounded-md px-3 text-xs font-bold capitalize transition",
                    rangeMode === mode ? "bg-emerald-800 text-white" : "border border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text-secondary)]"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <LayerToggle label="Shifts" checked={layers.shifts} onChange={(checked) => setLayers((current) => ({ ...current, shifts: checked }))} />
            <LayerToggle label="Bookings" checked={layers.bookings} onChange={(checked) => setLayers((current) => ({ ...current, bookings: checked }))} />
            <LayerToggle label="Blocks" checked={layers.blocks} onChange={(checked) => setLayers((current) => ({ ...current, blocks: checked }))} />
            <LayerToggle label="Overrides" checked={layers.overrides} onChange={(checked) => setLayers((current) => ({ ...current, overrides: checked }))} />
          </div>
        </div>

        <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0 space-y-3">
            {!selectedStaffId ? (
              <div className="flex min-h-80 items-center justify-center rounded-lg border border-dashed border-[var(--cs-border)] bg-white px-6 text-center">
                <div>
                  <CalendarDays className="mx-auto size-8 text-[var(--cs-text-muted)]" />
                  <p className="mt-3 text-sm font-bold text-[var(--cs-text)]">Select a staff member to view their complete schedule and live bookings.</p>
                  <p className="mt-1 text-xs text-[var(--cs-text-muted)]">Staff-specific actions stay disabled until a row is selected.</p>
                </div>
              </div>
            ) : scheduleLoading && !scheduleData ? (
              <div className="flex min-h-80 items-center justify-center rounded-lg border border-[var(--cs-border)] bg-white text-sm font-semibold text-[var(--cs-text-muted)]">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Loading staff schedule...
              </div>
            ) : scheduleError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
                <AlertTriangle className="mr-2 inline size-4" />
                {scheduleError}
              </div>
            ) : dayModels.length > 0 ? (
              <div className={cn("grid gap-3", rangeMode === "week" ? "xl:grid-cols-2 2xl:grid-cols-1" : "")}>
                {dayModels.map((day) => (
                  <DayScheduleColumn
                    key={day.date}
                    day={day}
                    layers={layers}
                    selectedBookingId={selectedBookingId}
                    onBookingSelect={(bookingId) => {
                      onSelectedBookingChange(bookingId);
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <aside className="space-y-3">
            <div className="rounded-lg border border-[var(--cs-border)] bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">Actions</p>
              <div className="mt-3 grid gap-1.5">
                {actionButtons.map((action) => {
                  const Icon = action.icon;
                  const disabled = action.requiresStaff && !selectedStaffId;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      disabled={disabled}
                      onClick={action.onClick}
                      className="flex h-9 items-center gap-2 rounded-md bg-stone-50 px-2 text-left text-[10px] font-semibold text-[var(--cs-text-secondary)] transition hover:bg-stone-100 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <Icon className="size-3.5 shrink-0" />
                      {action.label}
                    </button>
                  );
                })}
              </div>
              {!selectedStaffId ? (
                <p className="mt-3 text-[11px] leading-4 text-[var(--cs-text-muted)]">Select a staff member first.</p>
              ) : null}
            </div>
            <BookingDetailsPanel booking={selectedBooking} />
          </aside>
        </div>
      </div>

      <CheckAvailabilityModal
        open={checkAvailabilityOpen}
        onOpenChange={setCheckAvailabilityOpen}
        initialDate={date}
        initialStaffId={selectedStaffId ?? undefined}
      />
      <EditAvailabilityModal
        item={availabilityEditorItem}
        open={availabilityEditor !== null && availabilityEditorItem !== null}
        branchId={branchId}
        branchName={branchName}
        initialTab={availabilityEditor?.initialTab}
        initialDate={date}
        onOpenChange={(open) => {
          if (!open) setAvailabilityEditor(null);
        }}
        onSaved={(message) => {
          toast.success(message ?? "Availability updated.");
          setAvailabilityEditor(null);
          router.refresh();
        }}
      />
      <StaffScheduleCalendarModal
        open={fullScheduleStaffId !== null}
        onOpenChange={(open) => {
          if (!open) setFullScheduleStaffId(null);
        }}
        staff={fullScheduleStaff}
        initialDate={date}
        branchName={branchName}
      />
      <CrmEditStaffProfileModal
        open={profileStaffId !== null && profileData !== null}
        onOpenChange={(open) => {
          if (!open) setProfileStaffId(null);
        }}
        staffMember={profileData?.staffMember ?? null}
        branches={profileData?.branches ?? []}
        services={profileData?.services ?? []}
        staffServiceIds={profileData?.staffServiceIds ?? []}
        serviceAssignmentsError={profileData?.serviceAssignmentsError}
        reviewerSystemRole={profileData?.reviewerSystemRole ?? "staff"}
        onEditServices={() => {
          const staffId = profileData?.staffMember.id;
          if (!staffId) return;
          setProfileStaffId(null);
          setProfileData(null);
          openCapabilitiesEditor(staffId);
        }}
        onSuccess={() => {
          toast.success("Staff profile updated.");
          setProfileStaffId(null);
          setProfileData(null);
          router.refresh();
        }}
      />
      <StaffServiceEditorSheet
        open={capabilitiesStaffId !== null && capabilitiesData !== null}
        services={capabilitiesData?.services ?? []}
        selectedIds={capabilitiesDraft}
        onToggle={(serviceId) => {
          setCapabilitiesDraft((current) =>
            current.includes(serviceId)
              ? current.filter((id) => id !== serviceId)
              : [...current, serviceId]
          );
        }}
        onClose={() => {
          setCapabilitiesStaffId(null);
          setCapabilitiesData(null);
        }}
        onSave={handleSaveCapabilities}
        saving={isSavingCapabilities}
        staffName={capabilitiesData ? getStaffAdminName(capabilitiesData.staffMember) : undefined}
      />
      <LoadingDialog
        open={profileStaffId !== null && profileData === null}
        title={profileError ? "Profile Unavailable" : "Loading Staff Profile"}
        description={profileError ?? "Preparing staff profile details."}
        loading={profileLoading}
        onClose={() => setProfileStaffId(null)}
      />
      <LoadingDialog
        open={capabilitiesStaffId !== null && capabilitiesData === null}
        title={capabilitiesError ? "Capabilities Unavailable" : "Loading Service Capabilities"}
        description={capabilitiesError ?? "Preparing assigned and available services."}
        loading={capabilitiesLoading}
        onClose={() => setCapabilitiesStaffId(null)}
      />
    </section>
  );
}

function LoadingDialog({
  open,
  title,
  description,
  loading,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <AdminDialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()} size="sm" placement="center">
      <AdminOverlayHeader title={title} description={description} />
      <AdminOverlayBody className="bg-[var(--cs-surface-warm)]">
        <div className="flex min-h-28 items-center justify-center rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-4 py-6 text-sm font-semibold text-[var(--cs-text-muted)]">
          {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading...
            </>
          ) : (
            description
          )}
        </div>
      </AdminOverlayBody>
    </AdminDialog>
  );
}
