import { createAdminClient } from "@/lib/supabase/admin";
import type { AvailabilitySlot } from "@/types";
import { SlotUnavailableError } from "@/types/errors";
import {
  filterPastSlotsForDate,
  rangesOverlap,
  timeToMinutes,
  toLocalYmd,
} from "./slot-time";

/**
 * Calls the get_available_slots RPC and returns all slots.
 * If staff_services rows exist for the selected service, slots are filtered
 * to only qualified staff members. If no rows exist, legacy behavior applies
 * (all staff are considered eligible).
 */
export async function getAvailableSlots(params: {
  branchId:  string;
  serviceId: string;
  staffId?:  string;
  date:      string;
}): Promise<AvailabilitySlot[]> {
  const today = toLocalYmd(new Date());
  if (params.date < today) return [];

  const supabase = createAdminClient();

  const rpcArgs = {
    p_branch_id:  params.branchId,
    p_service_id: params.serviceId,
    p_staff_id:   (params.staffId ?? null) as unknown as string,
    p_date:       params.date,
  };

  const { data, error } = await supabase.rpc("get_available_slots", rpcArgs);

  if (error) throw new Error(`Availability query failed: ${error.message}`);
  let slots = (data ?? []) as AvailabilitySlot[];

  // ── Safe service-capability filter ────────────────────────────────────────
  // Only filter if staff_services has explicit rows for this service.
  // Empty staff_services table = fallback to legacy behavior.
  const { data: capabilityRows, error: capErr } = await supabase
    .from("staff_services")
    .select("staff_id")
    .eq("service_id", params.serviceId);

  if (!capErr && capabilityRows && capabilityRows.length > 0) {
    const qualifiedIds = new Set(capabilityRows.map((r) => r.staff_id));
    slots = slots.filter((s) => qualifiedIds.has(s.staff_id));
  }

  return filterPastSlotsForDate({
    selectedDate: params.date,
    slots,
  });
}

/**
 * When customer selects "any therapist", we call get_available_slots
 * with no staffId (returns all staff), then pick by seniority rule:
 *   Senior → Mid → Junior
 *   Tie-break: alphabetical by staff_name
 *
 * Returns the assigned staff_id, or throws SlotUnavailableError if none available.
 */
export async function assignTherapistBySeniority(params: {
  branchId:  string;
  serviceId: string;
  date:      string;
  startTime: string;
}): Promise<string> {
  const slots = await getAvailableSlots({
    branchId:  params.branchId,
    serviceId: params.serviceId,
    date:      params.date,
    // No staffId — returns all staff
  });

  // Filter to the requested time that is still available
  const candidates = slots.filter(
    (s) =>
      s.available &&
      s.slot_time.startsWith(params.startTime.substring(0, 5)) // compare HH:MM
  );

  if (candidates.length === 0) throw new SlotUnavailableError();

  // Sort by seniority then name
  const TIER_ORDER: Record<string, number> = { senior: 0, mid: 1, junior: 2 };
  candidates.sort((a, b) => {
    const tierDiff =
      (TIER_ORDER[a.staff_tier] ?? 9) - (TIER_ORDER[b.staff_tier] ?? 9);
    if (tierDiff !== 0) return tierDiff;
    return a.staff_name.localeCompare(b.staff_name);
  });

  return candidates[0]!.staff_id;
}

/**
 * Multi-service variant of getAvailableSlots.
 * Combines durations of all selected services and post-filters slots so only
 * (staff, slot_time) pairs with the full combined window free are marked available.
 */
export async function getAvailableSlotsMulti(params: {
  branchId:   string;
  serviceIds: string[];
  date:       string;
}): Promise<AvailabilitySlot[]> {
  const { branchId, serviceIds, date } = params;

  if (serviceIds.length === 0) return [];
  if (serviceIds.length === 1) {
    return getAvailableSlots({ branchId, serviceId: serviceIds[0]!, date });
  }

  const supabase = createAdminClient();

  // 1. Total effective duration across all services
  const { data: svcs, error: svcsErr } = await supabase
    .from("services")
    .select("id, duration_minutes, buffer_before, buffer_after")
    .in("id", serviceIds);

  if (svcsErr) throw new Error(`Failed to fetch services: ${svcsErr.message}`);

  const totalMinutes = (svcs ?? []).reduce(
    (sum, s) => sum + s.duration_minutes + s.buffer_before + s.buffer_after,
    0
  );

  // 2. Staff qualification intersection — only staff qualified for ALL services
  const qualifiedIds = new Set<string>();
  let hasCapabilityRows = false;

  for (const serviceId of serviceIds) {
    const { data: rows, error: capErr } = await supabase
      .from("staff_services")
      .select("staff_id")
      .eq("service_id", serviceId);

    if (!capErr && rows && rows.length > 0) {
      const ids = new Set(rows.map((r) => r.staff_id));
      if (!hasCapabilityRows) {
        ids.forEach((id) => qualifiedIds.add(id));
        hasCapabilityRows = true;
      } else {
        for (const id of qualifiedIds) {
          if (!ids.has(id)) qualifiedIds.delete(id);
        }
      }
    }
  }

  // 3. Get base slots using first service (provides correct slot intervals)
  const baseSlots = await getAvailableSlots({ branchId, serviceId: serviceIds[0]!, date });
  if (baseSlots.length === 0) return [];

  // 4. Fetch existing bookings for the day to validate full combined window
  const { data: dayBookings } = await supabase
    .from("bookings")
    .select("staff_id, start_time, end_time")
    .eq("branch_id", branchId)
    .eq("booking_date", date)
    .neq("status", "cancelled");

  const bookingsByStaff = new Map<string, Array<{ start: number; end: number }>>();
  for (const b of dayBookings ?? []) {
    if (!bookingsByStaff.has(b.staff_id)) bookingsByStaff.set(b.staff_id, []);
    bookingsByStaff.get(b.staff_id)!.push({
      start: timeToMinutes(b.start_time),
      end:   timeToMinutes(b.end_time),
    });
  }

  return baseSlots
    .filter((slot) => !hasCapabilityRows || qualifiedIds.has(slot.staff_id))
    .map((slot) => {
      if (!slot.available) return slot;

      const slotStart = timeToMinutes(slot.slot_time);
      const slotEnd   = slotStart + totalMinutes;

      const staffBookings = bookingsByStaff.get(slot.staff_id) ?? [];
      const hasConflict = staffBookings.some((b) =>
        rangesOverlap(slotStart, slotEnd, b.start, b.end)
      );

      return { ...slot, available: !hasConflict };
    });
}

/**
 * Multi-service variant of assignTherapistBySeniority.
 * Finds available therapists for the combined duration and assigns by tier priority.
 */
export async function assignTherapistBySeniorityMulti(params: {
  branchId:   string;
  serviceIds: string[];
  date:       string;
  startTime:  string;
}): Promise<string> {
  const slots = await getAvailableSlotsMulti({
    branchId:   params.branchId,
    serviceIds: params.serviceIds,
    date:       params.date,
  });

  const candidates = slots.filter(
    (s) =>
      s.available &&
      s.slot_time.startsWith(params.startTime.substring(0, 5))
  );

  if (candidates.length === 0) throw new SlotUnavailableError();

  const TIER_ORDER: Record<string, number> = { senior: 0, mid: 1, junior: 2 };
  candidates.sort((a, b) => {
    const tierDiff =
      (TIER_ORDER[a.staff_tier] ?? 9) - (TIER_ORDER[b.staff_tier] ?? 9);
    if (tierDiff !== 0) return tierDiff;
    return a.staff_name.localeCompare(b.staff_name);
  });

  return candidates[0]!.staff_id;
}

/**
 * Verifies a specific slot is still available.
 * Throws SlotUnavailableError if taken (race condition protection).
 */
export async function assertSlotAvailable(params: {
  branchId:  string;
  serviceId: string;
  staffId:   string;
  date:      string;
  startTime: string;
}): Promise<void> {
  const slots = await getAvailableSlots({
    branchId:  params.branchId,
    serviceId: params.serviceId,
    staffId:   params.staffId,
    date:      params.date,
  });

  const slot = slots.find(
    (s) =>
      s.staff_id === params.staffId &&
      s.slot_time.startsWith(params.startTime.substring(0, 5))
  );

  if (!slot?.available) throw new SlotUnavailableError();
}
