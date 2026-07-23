import { bookingBlocksAvailability } from "@/lib/bookings/hold-status";
import { rangesOverlap, timeToMinutes } from "@/lib/engine/slot-time";
import { staffTypeCanPerformService } from "@/lib/staff/service-providers";

export type ScheduledProviderService = {
  id: string;
  name?: string | null;
  categoryName?: string | null;
};

export type ScheduledProviderBooking = {
  start_time: string;
  end_time: string | null;
  status: string | null;
  hold_expires_at: string | null;
};

export type ScheduledProviderConflict = {
  startMinutes: number;
  endMinutes: number;
  nextAvailableAt: string;
};

function normalizedRange(
  startTime: string,
  endTime: string | null
): {
  start: number;
  end: number;
} {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime ?? startTime);
  if (end <= start) end += 24 * 60;
  return { start, end };
}

export function formatMinutesAsClock(minutes: number): string {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function canScheduledProviderPerformServices(params: {
  staffType: string | null | undefined;
  explicitlyAssignedServiceIds: ReadonlySet<string>;
  selectedServices: ScheduledProviderService[];
}): boolean {
  if (params.selectedServices.length === 0) return false;

  return params.selectedServices.every(
    (service) =>
      params.explicitlyAssignedServiceIds.has(service.id) ||
      staffTypeCanPerformService(params.staffType, service)
  );
}

export function findScheduledProviderConflict(params: {
  requestedStartTime: string;
  requestedDurationMinutes: number;
  bookings: ScheduledProviderBooking[];
  now?: Date;
}): ScheduledProviderConflict | null {
  const requestedStart = timeToMinutes(params.requestedStartTime);
  const requestedEnd = requestedStart + Math.max(1, params.requestedDurationMinutes);
  const now = params.now ?? new Date();

  const overlapping = params.bookings
    .filter((booking) => bookingBlocksAvailability(booking, now))
    .map((booking) => normalizedRange(booking.start_time, booking.end_time))
    .filter((booking) => rangesOverlap(requestedStart, requestedEnd, booking.start, booking.end))
    .sort((left, right) => left.end - right.end);

  if (overlapping.length === 0) return null;

  const latestEnd = overlapping.reduce(
    (latest, booking) => Math.max(latest, booking.end),
    overlapping[0]!.end
  );

  return {
    startMinutes: overlapping[0]!.start,
    endMinutes: latestEnd,
    nextAvailableAt: formatMinutesAsClock(latestEnd),
  };
}
