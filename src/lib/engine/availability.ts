import { createAdminClient } from "@/lib/supabase/admin";
import type { AvailabilitySlot } from "@/types";
import { SlotUnavailableError } from "@/types/errors";
import { canActAsBookingServiceProvider } from "@/lib/staff/service-providers";
import {
  filterPastSlotsForDate,
  rangesOverlap,
  timeToMinutes,
  toLocalYmd,
} from "./slot-time";

type StaffProviderRow = {
  id: string;
  branch_id: string;
  is_active: boolean;
  staff_type: string | null;
  system_role: string | null;
};

type StaffServiceRow = {
  staff_id: string;
  service_id: string;
};

function isMissingStaffProviderColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("staff_type") &&
    (lower.includes("does not exist") ||
      lower.includes("schema cache") ||
      lower.includes("could not find"))
  );
}

async function getActiveStaffProviderRows(branchId: string): Promise<StaffProviderRow[]> {
  const supabase = createAdminClient();
  const primary = await supabase
    .from("staff")
    .select("id, branch_id, is_active, staff_type, system_role")
    .eq("branch_id", branchId)
    .eq("is_active", true);

  if (!primary.error) {
    return (primary.data ?? []) as StaffProviderRow[];
  }

  if (!isMissingStaffProviderColumnError(primary.error.message)) {
    throw new Error(`Staff provider query failed: ${primary.error.message}`);
  }

  const fallback = await supabase
    .from("staff")
    .select("id, branch_id, is_active, system_role")
    .eq("branch_id", branchId)
    .eq("is_active", true);

  if (fallback.error) {
    throw new Error(`Staff provider fallback query failed: ${fallback.error.message}`);
  }

  return ((fallback.data ?? []) as Array<Omit<StaffProviderRow, "staff_type">>).map(
    (member) => ({
      ...member,
      staff_type: null,
    })
  );
}

function serviceCapabilitySets(rows: StaffServiceRow[]) {
  const staffIdsByService = new Map<string, Set<string>>();
  const serviceIdsByStaff = new Map<string, Set<string>>();

  for (const row of rows) {
    const staffSet = staffIdsByService.get(row.service_id) ?? new Set<string>();
    staffSet.add(row.staff_id);
    staffIdsByService.set(row.service_id, staffSet);

    const serviceSet = serviceIdsByStaff.get(row.staff_id) ?? new Set<string>();
    serviceSet.add(row.service_id);
    serviceIdsByStaff.set(row.staff_id, serviceSet);
  }

  return { staffIdsByService, serviceIdsByStaff };
}

async function filterSlotsForQualifiedProviders(params: {
  branchId: string;
  serviceIds: string[];
  slots: AvailabilitySlot[];
}): Promise<AvailabilitySlot[]> {
  if (params.slots.length === 0 || params.serviceIds.length === 0) return params.slots;

  const supabase = createAdminClient();
  const [staffRows, capabilityResult] = await Promise.all([
    getActiveStaffProviderRows(params.branchId),
    supabase
      .from("staff_services")
      .select("staff_id, service_id")
      .in("service_id", params.serviceIds),
  ]);

  if (capabilityResult.error) {
    throw new Error(`Staff service capability query failed: ${capabilityResult.error.message}`);
  }

  const staffById = new Map(staffRows.map((member) => [member.id, member]));
  const { staffIdsByService, serviceIdsByStaff } = serviceCapabilitySets(
    (capabilityResult.data ?? []) as StaffServiceRow[]
  );

  return params.slots.filter((slot) => {
    const staff = staffById.get(slot.staff_id);
    if (!staff) return false;

    const staffServiceIds = serviceIdsByStaff.get(slot.staff_id) ?? new Set<string>();
    const hasMatchingCapability = params.serviceIds.some((serviceId) =>
      staffServiceIds.has(serviceId)
    );

    if (!canActAsBookingServiceProvider(staff, hasMatchingCapability)) {
      return false;
    }

    return params.serviceIds.every((serviceId) => {
      const qualifiedStaffIds = staffIdsByService.get(serviceId);
      return !qualifiedStaffIds || qualifiedStaffIds.has(slot.staff_id);
    });
  });
}

/**
 * Calls the get_available_slots RPC and returns all slots.
 * If staff_services rows exist for the selected service, slots are filtered to
 * those staff members. When no capability rows exist, legacy fallback still
 * excludes drivers, utility, CSR, admin, and manager-only staff.
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

  slots = await filterSlotsForQualifiedProviders({
    branchId: params.branchId,
    serviceIds: [params.serviceId],
    slots,
  });

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

  // 2. Get base slots using first service (provides correct slot intervals)
  const baseSlots = await getAvailableSlots({ branchId, serviceId: serviceIds[0]!, date });
  if (baseSlots.length === 0) return [];

  // 3. Fetch existing bookings for the day to validate full combined window
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

  const combinedSlots = baseSlots.map((slot) => {
    if (!slot.available) return slot;

    const slotStart = timeToMinutes(slot.slot_time);
    const slotEnd   = slotStart + totalMinutes;

    const staffBookings = bookingsByStaff.get(slot.staff_id) ?? [];
    const hasConflict = staffBookings.some((b) =>
      rangesOverlap(slotStart, slotEnd, b.start, b.end)
    );

    return { ...slot, available: !hasConflict };
  });

  return filterSlotsForQualifiedProviders({
    branchId,
    serviceIds,
    slots: combinedSlots,
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

export async function assertMultiServiceSlotAvailable(params: {
  branchId: string;
  serviceIds: string[];
  staffId: string;
  date: string;
  startTime: string;
}): Promise<void> {
  const slots = await getAvailableSlotsMulti({
    branchId: params.branchId,
    serviceIds: params.serviceIds,
    date: params.date,
  });

  const slot = slots.find(
    (candidate) =>
      candidate.staff_id === params.staffId &&
      candidate.available &&
      candidate.slot_time.startsWith(params.startTime.substring(0, 5))
  );

  if (!slot) throw new SlotUnavailableError();
}
