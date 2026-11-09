import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

export const MAX_DRIVER_ROUTE_STOPS = 8;
export type RoutePoint = { lat: number; lng: number };
export type DrivingMatrixCell = { originIndex: number; destinationIndex: number; seconds: number };
export type DriverRouteOrdering = {
  ordered: RealDispatchItem[];
  basis: "driving_time" | "schedule_fallback";
  timingWarnings: string[];
};

/** Only trips still requiring a drive qualify for the optimized itinerary. */
export function isNavigableDriverTrip(job: RealDispatchItem): boolean {
  return (
    ["confirmed", "in_progress"].includes(job.bookingStatus) &&
    !["cancelled", "completed"].includes(job.dispatchStatus) &&
    ["not_started", "travel_started"].includes(job.bookingProgressStatus)
  );
}
export function isValidDriverDestination(job: RealDispatchItem): boolean {
  return !job.needsLocationReview &&
    job.lat !== null && job.lng !== null &&
    Number.isFinite(job.lat) && Number.isFinite(job.lng) &&
    Math.abs(job.lat) <= 90 && Math.abs(job.lng) <= 180;
}

function appointmentMillis(job: RealDispatchItem, time: "startTime" | "endTime"): number {
  // Booking clock times are branch-local Philippines wall-clock, not UTC.
  const value = Date.parse(`${job.bookingDate}T${job[time]}+08:00`);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}
function byAppointment(a: RealDispatchItem, b: RealDispatchItem) {
  return appointmentMillis(a, "startTime") - appointmentMillis(b, "startTime") || a.id.localeCompare(b.id);
}

/**
 * Greedy nearest next road stop, with driver already en route locked first.
 * When an upcoming appointment will become time-critical, prefer earliest
 * commitment over proximity rather than silently changing the booking.
 *
 * Matrix origin 0 = device GPS; origins 1..N = job coordinates.
 * Matrix destinations 0..N-1 = job coordinates.
 * Missing roads -> chronological order explicitly labeled as fallback.
 */
export function orderDriverStops(
  jobs: RealDispatchItem[],
  matrix: DrivingMatrixCell[],
  nowMs: number
): DriverRouteOrdering {
  // Preserve the input indices exactly: the road matrix's destinationIndex
  // refers to these positions, not a newly sorted copy of the bookings.
  const candidates = jobs.filter(isNavigableDriverTrip).filter(isValidDriverDestination)
    .slice(0, MAX_DRIVER_ROUTE_STOPS);
  const routeDuration = new Map(matrix.filter((cell) =>
    Number.isInteger(cell.originIndex) && Number.isInteger(cell.destinationIndex) &&
    cell.originIndex >= 0 && cell.destinationIndex >= 0 &&
    Number.isFinite(cell.seconds) && cell.seconds >= 0
  ).map((cell) => [`${cell.originIndex}:${cell.destinationIndex}`, cell.seconds]));
  const hasRoadData = candidates.every((_job, index) => routeDuration.has(`0:${index}`));
  if (!hasRoadData) {
    return {
      ordered: [...candidates].sort(byAppointment),
      basis: "schedule_fallback",
      timingWarnings: appointmentWarnings([...candidates].sort(byAppointment)),
    };
  }
  const remaining = new Map(candidates.map((job, index) => [index, job]));
  const ordered: RealDispatchItem[] = [];
  let originIndex = 0;

  while (remaining.size) {
    const choices = [...remaining.entries()];
    // Never switch away from a trip that the driver has actively started.
    const active = choices.find(([, job]) => job.bookingProgressStatus === "travel_started");
    const byDistance = choices.sort((a, b) => {
      const da = routeDuration.get(`${originIndex}:${a[0]}`) ?? Number.POSITIVE_INFINITY;
      const db = routeDuration.get(`${originIndex}:${b[0]}`) ?? Number.POSITIVE_INFINITY;
      return da - db || byAppointment(a[1], b[1]);
    });
    const nearest = byDistance[0]!;
    const urgent = [...remaining.entries()].filter(([index, job]) => {
      const travelMs = (routeDuration.get(`${originIndex}:${index}`) ?? Infinity) * 1000;
      return appointmentMillis(job, "startTime") <= nowMs + travelMs + 15 * 60000;
    }).sort((a, b) => byAppointment(a[1], b[1]))[0];
    const chosen = active ?? urgent ?? nearest;
    ordered.push(chosen[1]);
    originIndex = chosen[0] + 1;
    remaining.delete(chosen[0]);
  }
  return { ordered, basis: "driving_time", timingWarnings: appointmentWarnings(ordered) };
}

/** Conservatively flag any service end after the next confirmed start.
 * Travel minutes only increase the risk; no schedule is mutated.
 */
export function appointmentWarnings(jobs: RealDispatchItem[]): string[] {
  const warnings: string[] = [];
  for (let i = 1; i < jobs.length; i++) {
    const previous = jobs[i - 1]!;
    const next = jobs[i]!;
    if (appointmentMillis(previous, "endTime") > appointmentMillis(next, "startTime")) {
      warnings.push(`Check booking times: ${previous.id} may overlap ${next.id}.`);
    }
  }
  return warnings;
}
