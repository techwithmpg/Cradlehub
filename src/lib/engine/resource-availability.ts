import { createAdminClient } from "@/lib/supabase/admin";
import { rangesOverlap, timeToMinutes } from "./slot-time";

/**
 * Checks if a physical resource (room/bed) has enough capacity for a new booking
 * during the requested time window.
 */
export async function isResourceAvailable(params: {
  resourceId: string;
  date: string;
  startTime: string;
  endTime: string;
  excludeBookingId?: string;
}): Promise<boolean> {
  const supabase = createAdminClient();
  
  // 1. Get resource capacity
  const { data: resource } = await supabase
    .from("branch_resources")
    .select("capacity")
    .eq("id", params.resourceId)
    .single();
    
  if (!resource) return false;
  
  // 2. Get overlapping bookings using this resource
  const { data: overlaps } = await supabase
    .from("bookings")
    .select("id, start_time, end_time")
    .eq("resource_id", params.resourceId)
    .eq("booking_date", params.date)
    .not("status", "in", '("cancelled","no_show")');
    
  if (!overlaps) return true;
  
  const start = timeToMinutes(params.startTime);
  const end = timeToMinutes(params.endTime);
  
  const conflictingBookings = overlaps.filter(b => {
    if (params.excludeBookingId && b.id === params.excludeBookingId) return false;
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
    .select("id, resource_id, start_time, end_time")
    .eq("branch_id", params.branchId)
    .eq("booking_date", params.date)
    .not("status", "in", '("cancelled","no_show")')
    .not("resource_id", "is", "null");

  if (bookErr) return null;

  const start = timeToMinutes(params.startTime);
  const end = timeToMinutes(params.endTime);

  // 3. Find the first resource where current occupancy < capacity
  for (const res of resources) {
    const occupancy = (bookings ?? []).filter((b) => {
      if (b.resource_id !== res.id) return false;
      if (params.excludeBookingId && b.id === params.excludeBookingId) return false;
      return rangesOverlap(start, end, timeToMinutes(b.start_time), timeToMinutes(b.end_time));
    }).length;

    if (occupancy < res.capacity) {
      return res.id;
    }
  }

  return null;
}
