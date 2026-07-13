import { formatTime } from "@/lib/utils";
import {
  resolveScheduleForStaffDay,
  type IndividualScheduleSourceRow,
  type ScheduleOverrideSourceRow,
} from "@/lib/schedule/resolve-staff-schedule";
import type { Database } from "@/types/supabase";

const SHORT_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const FULL_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type ScheduleRow = Database["public"]["Tables"]["staff_schedules"]["Row"];
type OverrideRow = Database["public"]["Tables"]["schedule_overrides"]["Row"];
type BlockedTimeRow = Database["public"]["Tables"]["blocked_times"]["Row"];
type StaffRow = Database["public"]["Tables"]["staff"]["Row"];

type OneOrMany<T> = T | T[] | null;

export type WeekBooking = Pick<
  BookingRow,
  "id" | "booking_date" | "start_time" | "end_time" | "type" | "status" | "metadata"
> & {
  services: OneOrMany<Pick<ServiceRow, "id" | "name" | "duration_minutes">>;
  customers: OneOrMany<Pick<CustomerRow, "id" | "full_name">>;
};

export type WeekResult =
  | { error: string }
  | {
      bookings: WeekBooking[];
      schedule: ScheduleRow[];
      overrides: OverrideRow[];
      blocks: BlockedTimeRow[];
      staff: Pick<StaffRow, "id" | "full_name" | "tier" | "system_role" | "branch_id"> & {
        nickname: string | null;
        staff_type: string | null;
        avatar_url?: string | null;
        avatar_path?: string | null;
      };
    };

export type StaffWeekNavigation = {
  fromDate: string;
  toDate: string;
  days: string[];
  selectedWeekStart: string;
  previousWeekStart: string;
  nextWeekStart: string;
  currentWeekStart: string;
  isCurrentWeek: boolean;
};

export type StaffWeekAppointmentType = "in_spa" | "home_service" | "walk_in" | "online" | string;

export type StaffWeekAppointment = {
  id: string;
  startTime: string;
  endTime: string;
  timeLabel: string;
  customerName: string;
  serviceName: string;
  durationMinutes: number;
  bookingType: StaffWeekAppointmentType;
  status: string;
  roomName?: string | null;
  hasNote: boolean;
};

export type StaffWeekDay = {
  date: string;
  dayLabel: string;
  dayNumber: string;
  dayNameShort: (typeof SHORT_DAY_NAMES)[number];
  dayNameFull: (typeof FULL_DAY_NAMES)[number];
  dayOfWeek: number;
  dayOfMonth: number;
  isToday: boolean;
  appointments: StaffWeekAppointment[];
  appointmentCount: number;
  totalMinutes: number;
  bookedHours: number;
  workHoursLabel: string | null;
  isDayOff: boolean;
  hasOverride: boolean;
};

export type StaffWeekSummary = {
  totalAppointments: number;
  homeService: number;
  inSpa: number;
  walkIn: number;
  online: number;
  hoursBooked: number;
  upcoming: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function toLocalIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseIsoDate(value?: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function startOfMondayWeek(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = copy.getDay();
  const delta = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  copy.setDate(copy.getDate() + delta);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function getWeekNavigation(weekStartParam?: string): StaffWeekNavigation {
  const now = new Date();
  const currentWeekStartDate = startOfMondayWeek(now);
  const requestedDate = parseIsoDate(weekStartParam);
  const selectedWeekStartDate = requestedDate
    ? startOfMondayWeek(requestedDate)
    : currentWeekStartDate;

  const days: string[] = [];
  for (let index = 0; index < 7; index += 1) {
    days.push(toLocalIsoDate(addDays(selectedWeekStartDate, index)));
  }

  const selectedWeekStart = toLocalIsoDate(selectedWeekStartDate);
  const currentWeekStart = toLocalIsoDate(currentWeekStartDate);

  return {
    fromDate: days[0] ?? selectedWeekStart,
    toDate: days[6] ?? selectedWeekStart,
    days,
    selectedWeekStart,
    previousWeekStart: toLocalIsoDate(addDays(selectedWeekStartDate, -7)),
    nextWeekStart: toLocalIsoDate(addDays(selectedWeekStartDate, 7)),
    currentWeekStart,
    isCurrentWeek: selectedWeekStart === currentWeekStart,
  };
}

export function formatWeekRange(fromDate: string, toDate: string): string {
  const from = parseIsoDate(fromDate);
  const to = parseIsoDate(toDate);
  if (!from || !to) return `${fromDate} — ${toDate}`;

  const shortFormatter = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" });
  const longFormatter = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${shortFormatter.format(from)} — ${longFormatter.format(to)}`;
}

export function firstRelation<T>(relation: OneOrMany<T>): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

function toMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const [hoursRaw, minutesRaw] = time.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function getBookingDurationMinutes(booking: WeekBooking): number {
  const start = toMinutes(booking.start_time);
  const end = toMinutes(booking.end_time);
  if (start !== null && end !== null && end > start) {
    return end - start;
  }

  const service = firstRelation(booking.services);
  if (service?.duration_minutes && service.duration_minutes > 0) {
    return service.duration_minutes;
  }

  return 60;
}

function getBookingType(type: string): StaffWeekAppointmentType {
  const normalized = type.toLowerCase();
  if (normalized === "home_service") return "home_service";
  if (normalized === "walkin" || normalized === "walk_in") return "walk_in";
  if (normalized === "online") return "online";
  return "in_spa";
}

function formatWorkHours(startTime: string | null | undefined, endTime: string | null | undefined): string {
  const start = startTime?.slice(0, 5) ?? "--:--";
  const end = endTime?.slice(0, 5) ?? "--:--";
  return `${start} — ${end}`;
}

function formatResolvedWorkHours(
  windows: Array<{ startTime: string; endTime: string; endsNextDay?: boolean }>
): string {
  return windows
    .map((window) => {
      const suffix = window.endsNextDay ? " +1 day" : "";
      return `${formatWorkHours(window.startTime, window.endTime)}${suffix}`;
    })
    .join(", ");
}

function toSafeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function hasBookingNote(metadata: unknown): boolean {
  const record = toSafeMetadata(metadata);
  const fields = ["customer_notes", "notes", "internal_note", "memo"];
  return fields.some((field) => {
    const value = record[field];
    return typeof value === "string" && value.trim().length > 0;
  });
}

function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  if (Number.isInteger(rounded)) return `${rounded}h`;
  return `${rounded.toFixed(1)}h`;
}

type BuildPlannerArgs = {
  days: string[];
  bookings: WeekBooking[];
  schedule: ScheduleRow[];
  overrides: OverrideRow[];
  todayIso?: string;
};

export function buildStaffWeekPlanner({
  days,
  bookings,
  schedule,
  overrides,
  todayIso = toLocalIsoDate(new Date()),
}: BuildPlannerArgs): { days: StaffWeekDay[]; summary: StaffWeekSummary } {
  const scheduleByDay: Partial<Record<number, ScheduleRow[]>> = {};
  for (const scheduleRow of schedule) {
    const list = scheduleByDay[scheduleRow.day_of_week] ?? [];
    list.push(scheduleRow);
    scheduleByDay[scheduleRow.day_of_week] = list;
  }

  const overrideByDate: Record<string, OverrideRow> = {};
  for (const override of overrides) {
    overrideByDate[override.override_date] = override;
  }

  const bookingsByDate: Record<string, WeekBooking[]> = {};
  for (const day of days) {
    bookingsByDate[day] = [];
  }

  for (const booking of bookings) {
    const list = bookingsByDate[booking.booking_date];
    if (list) {
      list.push(booking);
    }
  }

  const dayModels: StaffWeekDay[] = [];
  let homeService = 0;
  let inSpa = 0;
  let walkIn = 0;
  let online = 0;
  let hoursBooked = 0;

  for (const date of days) {
    const parsedDate = parseIsoDate(date);
    if (!parsedDate) continue;

    const dayOfWeek = parsedDate.getDay();
    const override = overrideByDate[date];
    const scheduleRows = scheduleByDay[dayOfWeek] ?? [];
    const dayBookings = (bookingsByDate[date] ?? []).slice().sort((a, b) => a.start_time.localeCompare(b.start_time));

    const appointments: StaffWeekAppointment[] = dayBookings.map((booking) => {
      const service = firstRelation(booking.services);
      const customer = firstRelation(booking.customers);
      const durationMinutes = getBookingDurationMinutes(booking);
      const bookingType = getBookingType(booking.type);

      if (bookingType === "home_service") homeService += 1;
      if (bookingType === "walk_in") walkIn += 1;
      if (bookingType === "online") online += 1;
      if (bookingType !== "home_service") inSpa += 1;

      return {
        id: booking.id,
        startTime: booking.start_time,
        endTime: booking.end_time,
        timeLabel: formatTime(booking.start_time),
        customerName: customer?.full_name ?? "Guest client",
        serviceName: service?.name ?? "Service",
        durationMinutes,
        bookingType,
        status: booking.status,
        roomName: null,
        hasNote: hasBookingNote(booking.metadata),
      };
    });

    const totalMinutes = appointments.reduce((sum, appointment) => sum + appointment.durationMinutes, 0);
    const bookedHours = roundHours(totalMinutes / 60);
    hoursBooked += bookedHours;

    let workHoursLabel: string | null = null;
    let isDayOff = false;
    const resolved = resolveScheduleForStaffDay({
      override: override
        ? ({
            id: override.id,
            is_day_off: override.is_day_off,
            shift_type: override.shift_type,
            start_time: override.start_time,
            end_time: override.end_time,
          } satisfies ScheduleOverrideSourceRow)
        : null,
      individualRows: scheduleRows.map(
        (scheduleRow): IndividualScheduleSourceRow => ({
          id: scheduleRow.id,
          shift_type: scheduleRow.shift_type,
          start_time: scheduleRow.start_time,
          end_time: scheduleRow.end_time,
          is_active: scheduleRow.is_active,
          window_order: scheduleRow.window_order,
          ends_next_day: scheduleRow.ends_next_day,
        })
      ),
    });

    if (resolved.isDayOff) {
      isDayOff = true;
      workHoursLabel = "Day off";
    } else if (resolved.isWorking) {
      workHoursLabel = formatResolvedWorkHours(resolved.windows);
    }

    dayModels.push({
      date,
      dayLabel: SHORT_DAY_NAMES[dayOfWeek] ?? SHORT_DAY_NAMES[0],
      dayNumber: String(parsedDate.getDate()),
      dayNameShort: SHORT_DAY_NAMES[dayOfWeek] ?? SHORT_DAY_NAMES[0],
      dayNameFull: FULL_DAY_NAMES[dayOfWeek] ?? FULL_DAY_NAMES[0],
      dayOfWeek,
      dayOfMonth: parsedDate.getDate(),
      isToday: date === todayIso,
      appointments,
      appointmentCount: appointments.length,
      totalMinutes,
      bookedHours,
      workHoursLabel,
      isDayOff,
      hasOverride: Boolean(override),
    });
  }

  const totalAppointments = bookings.length;
  const upcoming = dayModels
    .filter((day) => day.date >= todayIso)
    .reduce((sum, day) => sum + day.appointmentCount, 0);

  return {
    days: dayModels,
    summary: {
      totalAppointments,
      homeService,
      inSpa,
      walkIn,
      online,
      hoursBooked: roundHours(hoursBooked),
      upcoming,
    },
  };
}
