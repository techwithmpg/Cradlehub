import type { BookingRowWithResource } from "@/lib/queries/booking-resources";
import { getStaffAdminName } from "@/lib/staff/display-name";

export type TodayBooking = BookingRowWithResource<{
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  travel_buffer_mins: number | null;
  resource_id: string | null;
  services: { name: string; duration_minutes?: number } | { name: string; duration_minutes?: number }[] | null;
  staff:
    | { id: string; full_name: string; nickname?: string | null }
    | { id: string; full_name: string; nickname?: string | null }[]
    | null;
  customers: { full_name: string } | { full_name: string }[] | null;
}>;

export type TodayKpiData = {
  totalBookings: number;
  inProgress: number;
  staffAvailable: number;
  missingRooms: number;
  conflicts: number;
};

export type TodayAlert = {
  id: string;
  label: string;
  count: number;
  href: string;
  severity: "critical" | "warning" | "info";
};

export type StaffAvailability = {
  id: string;
  full_name: string;
  nickname?: string | null;
  tier: string | null;
  staff_type: string | null;
  status: "available" | "in_service" | "off_duty";
  currentBooking?: { start_time: string; end_time: string; service_name: string };
};

export function readRelation<T>(relation: T | T[] | null): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const hr = h ?? 0;
  const ampm = hr >= 12 ? "PM" : "AM";
  const display = hr % 12 === 0 ? 12 : hr % 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime12(start)} – ${formatTime12(end)}`;
}

export function computeKpiData(
  bookings: TodayBooking[],
  staffCount: number
): TodayKpiData {
  const activeBookings = bookings.filter(
    (b) => b.status !== "cancelled" && b.status !== "no_show"
  );

  const inProgressCount = activeBookings.filter(
    (b) => b.status === "in_progress" || b.status === "confirmed"
  ).length;

  const missingRooms = activeBookings.filter((b) => !b.resource_id).length;

  // Conflicts = overlaps + missing assignments
  const conflicts = computeOverlapCount(activeBookings) + missingRooms;

  // Staff available = total staff minus those currently in a booking
  const busyStaffIds = new Set<string>();
  for (const b of activeBookings) {
    const s = readRelation(b.staff);
    if (s && b.status === "in_progress") {
      busyStaffIds.add(s.id);
    }
  }
  const availableStaff = Math.max(0, staffCount - busyStaffIds.size);

  return {
    totalBookings: activeBookings.length,
    inProgress: inProgressCount,
    staffAvailable: availableStaff,
    missingRooms,
    conflicts,
  };
}

export function computeAlerts(bookings: TodayBooking[], nowMins: number): TodayAlert[] {
  const alerts: TodayAlert[] = [];
  const active = bookings.filter((b) => b.status !== "cancelled" && b.status !== "no_show");

  // Missing room assignments
  const missingRooms = active.filter((b) => !b.resource_id);
  if (missingRooms.length > 0) {
    alerts.push({
      id: "missing-rooms",
      label: "Bookings missing room assignment",
      count: missingRooms.length,
      href: "/manager/bookings",
      severity: "warning",
    });
  }

  // Pending confirmation
  const pending = active.filter((b) => b.status === "pending");
  if (pending.length > 0) {
    alerts.push({
      id: "pending",
      label: "Pending confirmation",
      count: pending.length,
      href: "/manager/bookings",
      severity: "critical",
    });
  }

  // Unassigned staff
  const unassigned = active.filter((b) => !readRelation(b.staff));
  if (unassigned.length > 0) {
    alerts.push({
      id: "unassigned-staff",
      label: "Bookings without assigned therapist",
      count: unassigned.length,
      href: "/manager/bookings",
      severity: "critical",
    });
  }

  // Overlapping schedules
  const overlaps = computeOverlapCount(active);
  if (overlaps > 0) {
    alerts.push({
      id: "overlaps",
      label: "Overlapping bookings detected",
      count: overlaps,
      href: "/manager/schedule",
      severity: "critical",
    });
  }

  // Home service prep
  const homeServices = active.filter(
    (b) => b.type === "home_service" && b.status === "confirmed"
  );
  if (homeServices.length > 0) {
    alerts.push({
      id: "home-prep",
      label: "Home service bookings need prep",
      count: homeServices.length,
      href: "/manager/bookings",
      severity: "warning",
    });
  }

  // Starting soon (within 2 hours)
  const soon = active.filter(
    (b) =>
      b.status === "confirmed" &&
      timeToMinutes(b.start_time) > nowMins &&
      timeToMinutes(b.start_time) <= nowMins + 120
  );
  if (soon.length > 0) {
    alerts.push({
      id: "starting-soon",
      label: "Bookings starting within 2 hours",
      count: soon.length,
      href: "/manager/schedule",
      severity: "info",
    });
  }

  return alerts;
}

function computeOverlapCount(bookings: TodayBooking[]): number {
  const staffBookings = new Map<string, TodayBooking[]>();
  for (const b of bookings) {
    const s = readRelation(b.staff);
    if (!s) continue;
    const list = staffBookings.get(s.id) ?? [];
    list.push(b);
    staffBookings.set(s.id, list);
  }

  let overlapCount = 0;
  for (const [, list] of staffBookings) {
    const sorted = [...list].sort(
      (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
    );
    for (let i = 1; i < sorted.length; i++) {
      if (
        timeToMinutes(sorted[i]!.start_time) <
        timeToMinutes(sorted[i - 1]!.end_time)
      ) {
        overlapCount++;
      }
    }
  }
  return overlapCount;
}

export function computeStaffAvailability(
  staff: { id: string; full_name: string; nickname?: string | null; tier: string | null; staff_type: string | null }[],
  bookings: TodayBooking[],
  nowMins: number
): StaffAvailability[] {
  const activeBookings = bookings.filter(
    (b) => b.status !== "cancelled" && b.status !== "no_show"
  );

  return staff.map((s) => {
    const staffBookings = activeBookings.filter((b) => {
      const sb = readRelation(b.staff);
      return sb?.id === s.id;
    });

    const current = staffBookings.find(
      (b) =>
        timeToMinutes(b.start_time) <= nowMins &&
        timeToMinutes(b.end_time) > nowMins
    );

    if (current) {
      const svc = readRelation(current.services);
      return {
        id: s.id,
        full_name: getStaffAdminName(s),
        nickname: s.nickname ?? null,
        tier: s.tier,
        staff_type: s.staff_type,
        status: "in_service" as const,
        currentBooking: {
          start_time: current.start_time,
          end_time: current.end_time,
          service_name: svc?.name ?? "Service",
        },
      };
    }

    // Check if they have any booking today
    const hasBookingToday = staffBookings.length > 0;

    return {
      id: s.id,
      full_name: getStaffAdminName(s),
      nickname: s.nickname ?? null,
      tier: s.tier,
      staff_type: s.staff_type,
      status: hasBookingToday ? ("available" as const) : ("off_duty" as const),
    };
  });
}

export function getUrgencyScore(booking: TodayBooking, nowMins: number): number {
  const startMins = timeToMinutes(booking.start_time);
  const isPast = startMins < nowMins;
  const isSoon = startMins >= nowMins && startMins <= nowMins + 120;

  if (booking.status === "pending") return 100;
  if (!booking.resource_id && booking.type !== "home_service") return 90;
  if (!readRelation(booking.staff)) return 85;
  if (booking.status === "confirmed" && isSoon) return 70;
  if (booking.status === "confirmed" && isPast) return 60;
  if (booking.type === "home_service" && booking.status === "confirmed") return 50;
  return 0;
}
