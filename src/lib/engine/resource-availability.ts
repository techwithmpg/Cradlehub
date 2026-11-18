import { createAdminClient } from "@/lib/supabase/admin";
import { bookingBlocksAvailability } from "@/lib/bookings/hold-status";
import { getActiveRoomTurnoversForDate } from "@/lib/optimization/onsite-availability-adapter";
import { rangesOverlap, timeToMinutes } from "./slot-time";

type BookingResourceRow = {
  id: string;
  resource_id?: string | null;
  start_time: string;
  end_time: string;
  status: string | null;
  hold_expires_at: string | null;
};

async function getBranchRoomResetBuffer(
  supabase: ReturnType<typeof createAdminClient>,
  branchId: string
): Promise<number> {
  try {
    const tbl = (supabase as unknown as { from: (t: string) => unknown }).from(
      "scheduling_rules"
    ) as {
      select?: (c: string) => {
        eq?: (k: string, v: unknown) => {
          maybeSingle?: () => Promise<{ data?: { room_reset_buffer_minutes?: number | null } | null; error?: unknown }>;
        };
      };
    };
    const res = await tbl?.select?.("room_reset_buffer_minutes")?.eq?.("branch_id", branchId)?.maybeSingle?.();
    if (!res || res.error) return 0;
    return res.data?.room_reset_buffer_minutes != null
      ? Math.max(0, Number(res.data.room_reset_buffer_minutes))
      : 10;
  } catch {
    return 0;
  }
}

/**
 * Checks if a physical resource (room/bed) has enough capacity for a new booking
 * during the requested time window.
 */
export async function isResourceAvailable(
  params: {
    resourceId: string;
    date: string;
    startTime: string;
    endTime: string;
    excludeBookingId?: string;
  },
  options?: { throwOnError?: boolean }
): Promise<boolean> {
  const supabase = createAdminClient();

  // 1. Get resource capacity & branch
  const { data: resource, error: resourceError } = await supabase
    .from("branch_resources")
    .select("branch_id, capacity")
    .eq("id", params.resourceId)
    .single();

  if (resourceError && options?.throwOnError) throw resourceError;
  if (!resource) return false;

  const start = timeToMinutes(params.startTime);
  const end = timeToMinutes(params.endTime);

  const [turnovers, resetBuffer] = resource.branch_id
    ? await Promise.all([
        getActiveRoomTurnoversForDate({
          supabase,
          branchId: resource.branch_id,
          date: params.date,
        }),
        getBranchRoomResetBuffer(supabase, resource.branch_id),
      ])
    : [new Map<string, number>(), 0];

  const turnUntil = turnovers.get(params.resourceId);
  if (turnUntil !== undefined && start < turnUntil) {
    return false;
  }

  // 2. Get overlapping bookings using this resource
  const { data: overlaps, error: overlapsError } = await supabase
    .from("bookings")
    .select("id, start_time, end_time, status, hold_expires_at")
    .eq("resource_id", params.resourceId)
    .eq("booking_date", params.date);

  if (overlapsError && options?.throwOnError) throw overlapsError;
  if (!overlaps) return true;

  const now = new Date();
  const conflictingBookings = ((overlaps ?? []) as BookingResourceRow[]).filter((b) => {
    if (params.excludeBookingId && b.id === params.excludeBookingId) return false;
    if (!bookingBlocksAvailability(b, now)) return false;
    return rangesOverlap(
      start,
      end + resetBuffer,
      timeToMinutes(b.start_time),
      timeToMinutes(b.end_time) + resetBuffer
    );
  });

  // Resource is available if current conflicts are less than capacity
  return conflictingBookings.length < resource.capacity;
}

/**
 * Finds the first available physical resource (room/bed) in a branch for a given time.
 * Returns the resource ID or null if none available.
 */
export async function autoAssignBookingResource(params: {
  branchId: string;
  date: string;
  startTime: string;
  endTime: string;
  excludeBookingId?: string;
}): Promise<string | null> {
  const supabase = createAdminClient();

  // 1. Fetch all active resources for this branch
  const { data: resources, error: resErr } = await supabase
    .from("branch_resources")
    .select("id, capacity")
    .eq("branch_id", params.branchId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (resErr || !resources || resources.length === 0) return null;

  // 2. Fetch all potentially conflicting bookings for the whole branch that day
  // (Optimization: instead of calling isResourceAvailable in a loop)
  const { data: bookings, error: bookErr } = await supabase
    .from("bookings")
    .select("id, resource_id, start_time, end_time, status, hold_expires_at")
    .eq("branch_id", params.branchId)
    .eq("booking_date", params.date)
    .not("resource_id", "is", "null");

  if (bookErr) return null;

  const start = timeToMinutes(params.startTime);
  const end = timeToMinutes(params.endTime);
  const now = new Date();
  const [turnovers, resetBuffer] = await Promise.all([
    getActiveRoomTurnoversForDate({
      supabase,
      branchId: params.branchId,
      date: params.date,
      now,
    }),
    getBranchRoomResetBuffer(supabase, params.branchId),
  ]);

  // 3. Find the first resource where current occupancy < capacity and no active turnover overlaps
  for (const res of resources) {
    const turnUntil = turnovers.get(res.id);
    if (turnUntil !== undefined && start < turnUntil) {
      continue;
    }
    const occupancy = ((bookings ?? []) as BookingResourceRow[]).filter((b) => {
      if (b.resource_id !== res.id) return false;
      if (params.excludeBookingId && b.id === params.excludeBookingId) return false;
      if (!bookingBlocksAvailability(b, now)) return false;
      return rangesOverlap(
        start,
        end + resetBuffer,
        timeToMinutes(b.start_time),
        timeToMinutes(b.end_time) + resetBuffer
      );
    }).length;

    if (occupancy < res.capacity) {
      return res.id;
    }
  }

  return null;
}

/** Reserve capacity across concurrent attendees before the atomic insert. */
export async function allocateResourcesForAttendees(params: {
  branchId: string;
  date: string;
  windows: Array<{ startTime: string; endTime: string }>;
}): Promise<Array<string | null> | null> {
  const supabase = createAdminClient();
  const { data: resources, error: resourceError } = await supabase
    .from("branch_resources")
    .select("id, capacity")
    .eq("branch_id", params.branchId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (resourceError) throw resourceError;
  if (!resources?.length) return params.windows.map(() => null);

  const { data: bookings, error: bookingError } = await supabase
    .from("bookings")
    .select("id, resource_id, start_time, end_time, status, hold_expires_at")
    .eq("branch_id", params.branchId)
    .eq("booking_date", params.date)
    .not("resource_id", "is", "null");
  if (bookingError) throw bookingError;

  const now = new Date();
  const [turnovers, resetBuffer] = await Promise.all([
    getActiveRoomTurnoversForDate({
      supabase,
      branchId: params.branchId,
      date: params.date,
      now,
    }),
    getBranchRoomResetBuffer(supabase, params.branchId),
  ]);
  const reservations: Array<{ resourceId: string; start: number; end: number }> = [];
  const assigned: Array<string | null> = [];
  for (const window of params.windows) {
    const start = timeToMinutes(window.startTime);
    const end = timeToMinutes(window.endTime);
    const resource = resources.find((candidate) => {
      const turnUntil = turnovers.get(candidate.id);
      if (turnUntil !== undefined && start < turnUntil) return false;
      const existing = ((bookings ?? []) as BookingResourceRow[]).filter((booking) =>
        booking.resource_id === candidate.id && bookingBlocksAvailability(booking, now) &&
        rangesOverlap(
          start,
          end + resetBuffer,
          timeToMinutes(booking.start_time),
          timeToMinutes(booking.end_time) + resetBuffer
        )
      ).length;
      const inRequest = reservations.filter((reservation) =>
        reservation.resourceId === candidate.id &&
        rangesOverlap(start, end + resetBuffer, reservation.start, reservation.end + resetBuffer)
      ).length;
      return existing + inRequest < candidate.capacity;
    });
    if (!resource) return null;
    reservations.push({ resourceId: resource.id, start, end });
    assigned.push(resource.id);
  }
  return assigned;
}

/**
 * Checks if a physical resource currently has an active (open or in_progress) room turnover task.
 * Never fails open on database error: throws rather than silently assuming ready.
 * Note: Broad scheduling engine integration for dynamic calendar buffers is tracked as
 * RESOURCE AVAILABILITY FOLLOW-UP REQUIRED.
 */
export { isResourceInActiveTurnover } from "@/lib/staff-pwa/utility-turnover";
