import type { Database } from "@/types/supabase";
import { firstRelation, type WeekBooking } from "./week";

type BlockedTimeRow = Database["public"]["Tables"]["blocked_times"]["Row"];

export type StaffScheduleEventType = "booking" | "blocked";

export type StaffScheduleEvent = {
  id: string;
  type: StaffScheduleEventType;
  title: string;
  subtitle?: string;
  customerName?: string;
  serviceName?: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status?: string;
  bookingType?: string;
  bookingId?: string;
  isHomeService?: boolean;
  reason?: string;
};

function toMinutes(time: string): number {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

function durationBetween(start: string, end: string): number {
  const diff = toMinutes(end) - toMinutes(start);
  return diff > 0 ? diff : 0;
}

function bookingToEvent(booking: WeekBooking): StaffScheduleEvent {
  const service = firstRelation(booking.services);
  const customer = firstRelation(booking.customers);
  const duration =
    booking.start_time && booking.end_time
      ? durationBetween(booking.start_time, booking.end_time)
      : (service?.duration_minutes ?? 60);
  const isHome = booking.type === "home_service";

  return {
    id: booking.id,
    type: "booking",
    title: service?.name ?? "Appointment",
    subtitle: customer?.full_name ?? undefined,
    customerName: customer?.full_name ?? undefined,
    serviceName: service?.name ?? undefined,
    date: booking.booking_date,
    startTime: booking.start_time,
    endTime: booking.end_time,
    durationMinutes: duration,
    status: booking.status,
    bookingType: booking.type,
    bookingId: booking.id,
    isHomeService: isHome,
  };
}

function blockToEvent(block: BlockedTimeRow): StaffScheduleEvent {
  const duration = durationBetween(block.start_time, block.end_time);
  return {
    id: block.id,
    type: "blocked",
    title: block.reason ?? "Blocked",
    date: block.block_date,
    startTime: block.start_time,
    endTime: block.end_time,
    durationMinutes: duration,
    reason: block.reason,
  };
}

type BuildDayEventsArgs = {
  date: string;
  bookings: WeekBooking[];
  blocks: BlockedTimeRow[];
};

export function buildDayEvents({ date, bookings, blocks }: BuildDayEventsArgs): StaffScheduleEvent[] {
  const events: StaffScheduleEvent[] = [
    ...bookings.filter((b) => b.booking_date === date).map(bookingToEvent),
    ...blocks.filter((b) => b.block_date === date).map(blockToEvent),
  ];
  events.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return events;
}

type BuildWeekEventsArgs = {
  days: string[];
  bookings: WeekBooking[];
  blocks: BlockedTimeRow[];
};

export function buildWeekEvents({ days, bookings, blocks }: BuildWeekEventsArgs): Record<string, StaffScheduleEvent[]> {
  const result: Record<string, StaffScheduleEvent[]> = {};
  for (const date of days) {
    result[date] = buildDayEvents({ date, bookings, blocks });
  }
  return result;
}
