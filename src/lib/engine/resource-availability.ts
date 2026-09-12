import { createAdminClient } from "@/lib/supabase/admin";
import { bookingBlocksAvailability } from "@/lib/bookings/hold-status";
import { rangesOverlap, timeToMinutes } from "./slot-time";

type BookingResourceRow = {
  id: string;
  resource_id?: string | null;
  start_time: string;
  end_time: string;
  status: string | null;
  hold_expires_at: string | null;
};

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

  // 1. Get resource capacity
  const { data: resource, error: resourceError } = await supabase
    .from("branch_resources")
    .select("capacity")
    .eq("id", params.resourceId)
    .single();

  if (resourceError && options?.throwOnError) throw resourceError;
  if (!resource) return false;

  // 2. Get overlapping bookings using this resource
  const { data: overlaps, error: overlapsError } = await supabase
    .from("bookings")
    .select("id, start_time, end_time, status, hold_expires_at")
    .eq("resource_id", params.resourceId)
    .eq("booking_date", params.date);

  if (overlapsError && options?.throwOnError) throw overlapsError;
  if (!overlaps) return true;

  const start = timeToMinutes(params.startTime);
  const end = timeToMinutes(params.endTime);

  const now = new Date();
  const conflictingBookings = ((overlaps ?? []) as BookingResourceRow[]).filter((b) => {
    if (params.excludeBookingId && b.id === params.excludeBookingId) return false;
    if (!bookingBlocksAvailability(b, now)) return false;
    return rangesOverlap(start, end, timeToMinutes(b.start_time), timeToMinutes(b.end_time));
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

  // 3. Find the first resource where current occupancy < capacity
  for (const res of resources) {
    const occupancy = ((bookings ?? []) as BookingResourceRow[]).filter((b) => {
      if (b.resource_id !== res.id) return false;
      if (params.excludeBookingId && b.id === params.excludeBookingId) return false;
      if (!bookingBlocksAvailability(b, now)) return false;
      return rangesOverlap(start, end, timeToMinutes(b.start_time), timeToMinutes(b.end_time));
    }).length;

    if (occupancy < res.capacity) {
      return res.id;
    }
  }

  return null;
}

/**
 * Checks if a physical resource currently has an active (open or in_progress) room turnover task.
 * Note: Broad scheduling engine integration for dynamic calendar buffers is tracked as
 * RESOURCE AVAILABILITY FOLLOW-UP REQUIRED.
 */
export async function isResourceInActiveTurnover(resourceId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("workflow_tasks")
    .select("id")
    .eq("workspace_scope", "utility")
    .eq("task_type", "room_turnover")
    .eq("entity_type", "branch_resource")
    .eq("entity_id", resourceId)
    .in("status", ["open", "in_progress"])
    .limit(1);

  if (error || !data) return false;
  return data.length > 0;
}
