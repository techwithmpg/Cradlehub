import type { DailyScheduleBooking, DailyScheduleStaffRow } from "@/lib/queries/schedule";
import { getRequiredResourceType } from "@/lib/schedule/live-schedule-conflicts";

export type DailyTimelineAlert = {
  id: string;
  type: "travel" | "missing_resource" | "resource_conflict" | "staff_conflict";
  staffId: string;
  bookingIds: string[];
  title: string;
};

function isActiveBooking(booking: DailyScheduleBooking): boolean {
  return booking.status !== "cancelled" && booking.status !== "no_show";
}

function overlaps(a: DailyScheduleBooking, b: DailyScheduleBooking): boolean {
  return a.start_time < b.end_time && b.start_time < a.end_time;
}

export function buildDailyTimelineAlerts(rows: DailyScheduleStaffRow[]): DailyTimelineAlert[] {
  const alerts: DailyTimelineAlert[] = [];
  const resourceBookings = new Map<string, Array<{ staffId: string; booking: DailyScheduleBooking }>>();

  for (const row of rows) {
    const activeBookings = row.bookings.filter(isActiveBooking);
    for (const booking of activeBookings) {
      if (booking.type === "home_service") {
        alerts.push({
          id: `travel-${booking.id}`,
          type: "travel",
          staffId: row.staff_id,
          bookingIds: [booking.id],
          title: `${row.staff_name} has a home-service trip`,
        });
      }
      if (getRequiredResourceType(booking) && !booking.resource_id) {
        alerts.push({
          id: `resource-${booking.id}`,
          type: "missing_resource",
          staffId: row.staff_id,
          bookingIds: [booking.id],
          title: `${booking.service} has no assigned room`,
        });
      }
      if (booking.resource_id) {
        const list = resourceBookings.get(booking.resource_id) ?? [];
        list.push({ staffId: row.staff_id, booking });
        resourceBookings.set(booking.resource_id, list);
      }
    }

    for (let index = 0; index < activeBookings.length; index++) {
      for (let other = index + 1; other < activeBookings.length; other++) {
        const a = activeBookings[index]!;
        const b = activeBookings[other]!;
        if (!overlaps(a, b)) continue;
        alerts.push({
          id: `staff-${a.id}-${b.id}`,
          type: "staff_conflict",
          staffId: row.staff_id,
          bookingIds: [a.id, b.id],
          title: `${row.staff_name} has overlapping bookings`,
        });
      }
    }
  }

  for (const assignments of resourceBookings.values()) {
    for (let index = 0; index < assignments.length; index++) {
      for (let other = index + 1; other < assignments.length; other++) {
        const a = assignments[index]!;
        const b = assignments[other]!;
        if (!overlaps(a.booking, b.booking)) continue;
        alerts.push({
          id: `room-${a.booking.id}-${b.booking.id}`,
          type: "resource_conflict",
          staffId: a.staffId,
          bookingIds: [a.booking.id, b.booking.id],
          title: `${a.booking.resource_name ?? "Room"} is double-booked`,
        });
      }
    }
  }

  return alerts;
}

export function getConflictingBookingIds(alerts: DailyTimelineAlert[]): Set<string> {
  return new Set(
    alerts
      .filter((alert) => alert.type === "resource_conflict" || alert.type === "staff_conflict")
      .flatMap((alert) => alert.bookingIds)
  );
}
